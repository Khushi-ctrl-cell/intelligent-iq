import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Rate Limiting ---
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
}

function hashQuestion(q: string): string {
  let hash = 0;
  for (let i = 0; i < q.length; i++) {
    const char = q.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "qh_" + Math.abs(hash).toString(36);
}

// --- AI call with retry ---
async function callAI(
  aiApiKey: string,
  prompt: string,
  retries = 1
): Promise<{ ok: boolean; content?: string; status?: number }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return { ok: true, content };
      }

      if (response.status === 402) {
        return { ok: false, status: 402 };
      }

      console.warn(`[generate-quiz] AI attempt ${attempt + 1} failed: ${response.status}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    } catch (e) {
      console.error(`[generate-quiz] AI network error attempt ${attempt + 1}:`, e);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  return { ok: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  console.log(`[generate-quiz] Request from IP: ${clientIP}`);

  if (isRateLimited(clientIP)) {
    console.warn(`[generate-quiz] Rate limited: ${clientIP}`);
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Max 5 quiz generations per minute." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aiApiKey = Deno.env.get("LOVABLE_API_KEY")!; // AI Gateway API key
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { source_id } = body;
    if (!source_id || typeof source_id !== "string") {
      return new Response(JSON.stringify({ error: "source_id is required and must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate source exists
    const { data: source, error: srcErr } = await supabase
      .from("sources")
      .select("id, title")
      .eq("id", source_id)
      .single();

    if (srcErr || !source) {
      console.error("[generate-quiz] Source not found:", source_id);
      return new Response(JSON.stringify({ error: "Source not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[generate-quiz] Processing source: ${source.title} (${source_id})`);

    // Get chunks
    const { data: chunks, error: chunkError } = await supabase
      .from("content_chunks")
      .select("*")
      .eq("source_id", source_id)
      .order("chunk_index");

    if (chunkError || !chunks || chunks.length === 0) {
      console.error("[generate-quiz] No chunks found for source:", source_id);
      return new Response(JSON.stringify({ error: "No chunks found for this source." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[generate-quiz] Found ${chunks.length} chunks`);

    // Select 1 chunk from the middle of the document for a focused set of 3 questions
    const selectedChunk = chunks[Math.floor(chunks.length / 2)];

    if (!selectedChunk.text || selectedChunk.text.trim().length < 20) {
      console.error("[generate-quiz] Selected chunk too short");
      return new Response(JSON.stringify({ error: "Selected chunk has insufficient text." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allQuestions: Record<string, unknown>[] = [];
    let aiFailed = false;

    const prompt = `Based on the following educational text, generate exactly 3 quiz questions: one easy, one medium, and one hard.

IMPORTANT: Return ONLY a valid JSON array with exactly 3 objects, each with this structure:
[
  {
    "question": "easy question text",
    "type": "MCQ",
    "options": ["option A", "option B", "option C", "option D"],
    "answer": "the correct option text (must match one of the options exactly)",
    "difficulty": "easy"
  },
  {
    "question": "medium question text",
    "type": "MCQ",
    "options": ["option A", "option B", "option C", "option D"],
    "answer": "the correct option text (must match one of the options exactly)",
    "difficulty": "medium"
  },
  {
    "question": "hard question text",
    "type": "MCQ",
    "options": ["option A", "option B", "option C", "option D"],
    "answer": "the correct option text (must match one of the options exactly)",
    "difficulty": "hard"
  }
]

Easy = recall/definition. Medium = application/analysis. Hard = synthesis/evaluation.
Make questions educational and meaningful. Each question must have 4 distinct options.

Text: ${selectedChunk.text}`;

    console.log(`[generate-quiz] Generating 3 questions from 1 chunk`);

    const result = await callAI(aiApiKey, prompt, 1);

      if (!result.ok) {
        if (result.status === 402) {
          aiFailed = true;
          break;
        }
        console.warn(`[generate-quiz] AI failed for chunk ${i} after retry, skipping`);
        aiFailed = true;
        continue;
      }

      if (!result.content) {
        console.warn(`[generate-quiz] Empty AI response for chunk ${i}`);
        continue;
      }

      // Parse JSON array
      let jsonStr = result.content;
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      jsonStr = jsonStr.trim();

      let parsedArray: Record<string, unknown>[];
      try {
        const parsed = JSON.parse(jsonStr);
        parsedArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        console.error(`[generate-quiz] Failed to parse AI JSON for chunk ${i}:`, jsonStr.slice(0, 200));
        continue;
      }

      for (const parsed of parsedArray) {
        if (!parsed.question || !parsed.answer || typeof parsed.question !== "string" || typeof parsed.answer !== "string") {
          console.warn(`[generate-quiz] Invalid question structure, skipping`);
          continue;
        }

        const questionHash = hashQuestion(parsed.question as string);

        const { error: insertError } = await supabase.from("quiz_questions").insert({
          source_id,
          source_chunk_id: chunk.id,
          question_hash: questionHash,
          question: parsed.question,
          type: parsed.type || "MCQ",
          options: parsed.options || null,
          answer: parsed.answer,
          difficulty: parsed.difficulty || "medium",
        });

        if (insertError) {
          if (insertError.code === "23505") {
            console.log(`[generate-quiz] Duplicate question skipped (hash: ${questionHash})`);
          } else {
            console.error("[generate-quiz] DB insert error:", insertError);
          }
        } else {
          console.log(`[generate-quiz] ✓ Question stored (${parsed.difficulty}): ${(parsed.question as string).slice(0, 60)}...`);
          allQuestions.push({
            question: parsed.question,
            type: parsed.type,
            options: parsed.options,
            answer: parsed.answer,
            difficulty: parsed.difficulty || "medium",
            source_chunk_id: chunk.id,
          });
        }
      }
    }

    // --- Fallback: if AI failed and no new questions, return cached questions ---
    if (allQuestions.length === 0 && aiFailed) {
      console.warn("[generate-quiz] AI failed, falling back to cached questions for source");
      const { data: cached } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("source_id", source_id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (cached && cached.length > 0) {
        console.log(`[generate-quiz] Returning ${cached.length} cached questions`);
        return new Response(
          JSON.stringify({
            success: true,
            questions_generated: cached.length,
            questions: cached,
            fallback: true,
            message: "AI unavailable. Returning previously generated questions.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service unavailable and no cached questions found. Try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-quiz] Complete: ${allQuestions.length} questions generated for source ${source_id}`);

    return new Response(
      JSON.stringify({ success: true, questions_generated: allQuestions.length, questions: allQuestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[generate-quiz] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
