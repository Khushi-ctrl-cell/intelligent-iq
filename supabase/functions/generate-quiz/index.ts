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

// --- Hallucination Detection ---
function isGroundedInChunk(answer: string, chunkText: string): boolean {
  const normalizedAnswer = answer.toLowerCase().trim();
  const normalizedChunk = chunkText.toLowerCase();
  
  // Check if the answer (or significant parts) appear in the chunk
  if (normalizedChunk.includes(normalizedAnswer)) return true;
  
  // Check word-level overlap for longer answers
  const answerWords = normalizedAnswer.split(/\s+/).filter(w => w.length > 3);
  if (answerWords.length === 0) return true;
  
  const matchedWords = answerWords.filter(word => normalizedChunk.includes(word));
  const overlapRatio = matchedWords.length / answerWords.length;
  
  // At least 60% of significant words must appear in the chunk
  return overlapRatio >= 0.6;
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
    const aiApiKey = Deno.env.get("LOVABLE_API_KEY")!;
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

    const selectedChunk = chunks[Math.floor(chunks.length / 2)];

    if (!selectedChunk.text || selectedChunk.text.trim().length < 20) {
      console.error("[generate-quiz] Selected chunk too short");
      return new Response(JSON.stringify({ error: "Selected chunk has insufficient text." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Metrics tracking
    let totalGenerated = 0;
    let totalRejected = 0;
    let totalVerified = 0;

    const allQuestions: Record<string, unknown>[] = [];
    let aiFailed = false;
    const MAX_ATTEMPTS = 3;
    let attemptCount = 0;

    while (allQuestions.length < 3 && attemptCount < MAX_ATTEMPTS) {
      attemptCount++;
      const neededDifficulties = ["easy", "medium", "hard"].filter(
        d => !allQuestions.some(q => q.difficulty === d)
      );

      if (neededDifficulties.length === 0) break;

      const prompt = `Based on the following educational text, generate exactly ${neededDifficulties.length} quiz question(s) with difficulties: ${neededDifficulties.join(", ")}.

CRITICAL RULES:
1. The correct answer MUST be directly stated or clearly derivable from the provided text.
2. Do NOT invent facts, numbers, or concepts not present in the text.
3. Return ONLY a valid JSON array with objects having this structure:

[
  {
    "question": "question text",
    "type": "MCQ",
    "options": ["option A", "option B", "option C", "option D"],
    "answer": "the correct option text (must match one of the options exactly)",
    "difficulty": "${neededDifficulties[0]}"
  }
]

Easy = recall/definition. Medium = application/analysis. Hard = synthesis/evaluation.
Each question must have 4 distinct options. The answer must come from the source text below.

Text: ${selectedChunk.text}`;

      console.log(`[generate-quiz] Attempt ${attemptCount}: generating ${neededDifficulties.length} questions`);

      const result = await callAI(aiApiKey, prompt, 1);

      if (!result.ok) {
        if (result.status === 402) aiFailed = true;
        else {
          console.warn(`[generate-quiz] AI failed on attempt ${attemptCount}`);
          aiFailed = true;
        }
        break;
      }

      if (!result.content) {
        console.warn(`[generate-quiz] Empty AI response on attempt ${attemptCount}`);
        continue;
      }

      let jsonStr = result.content;
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      jsonStr = jsonStr.trim();

      let parsedArray: Record<string, unknown>[];
      try {
        const parsed = JSON.parse(jsonStr);
        parsedArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        console.error(`[generate-quiz] Failed to parse AI JSON:`, jsonStr.slice(0, 200));
        continue;
      }

      for (const parsed of parsedArray) {
        if (!parsed.question || !parsed.answer || typeof parsed.question !== "string" || typeof parsed.answer !== "string") {
          console.warn(`[generate-quiz] Invalid question structure, skipping`);
          continue;
        }

        totalGenerated++;

        // --- Hallucination Detection ---
        console.log(`[AI-VERIFY] Checking grounding for question: "${(parsed.question as string).slice(0, 60)}..."`);
        
        const isGrounded = isGroundedInChunk(parsed.answer as string, selectedChunk.text);

        if (!isGrounded) {
          totalRejected++;
          console.warn(`[AI-VERIFY] Hallucinated question rejected ⚠ Answer "${(parsed.answer as string).slice(0, 40)}" not grounded in chunk`);
          continue;
        }

        console.log(`[AI-VERIFY] Question verified ✔ (${parsed.difficulty})`);

        // Skip if we already have this difficulty
        if (allQuestions.some(q => q.difficulty === parsed.difficulty)) continue;

        const questionHash = hashQuestion(parsed.question as string);

        const { error: insertError } = await supabase.from("quiz_questions").insert({
          source_id,
          source_chunk_id: selectedChunk.id,
          question_hash: questionHash,
          question: parsed.question,
          type: parsed.type || "MCQ",
          options: parsed.options || null,
          answer: parsed.answer,
          difficulty: parsed.difficulty || "medium",
          is_verified: true,
        });

        if (insertError) {
          if (insertError.code === "23505") {
            console.log(`[generate-quiz] Duplicate question skipped (hash: ${questionHash})`);
          } else {
            console.error("[generate-quiz] DB insert error:", insertError);
          }
        } else {
        totalVerified++;
          console.log(`[generate-quiz] ✓ Verified question stored (${parsed.difficulty}): ${(parsed.question as string).slice(0, 60)}...`);
          allQuestions.push({
            id: crypto.randomUUID(),
            question: parsed.question,
            type: parsed.type,
            options: parsed.options,
            difficulty: parsed.difficulty || "medium",
            source_chunk_id: selectedChunk.id,
            is_verified: true,
          });
        }
      }
    }

    // --- Store AI Quality Metrics ---
    if (totalGenerated > 0) {
      const accuracyRate = totalGenerated > 0 ? (totalVerified / totalGenerated) * 100 : 0;
      const { error: metricsError } = await supabase.from("ai_quality_metrics").insert({
        questions_generated: totalGenerated,
        questions_rejected: totalRejected,
        questions_verified: totalVerified,
        accuracy_rate: Math.round(accuracyRate * 100) / 100,
      });
      if (metricsError) {
        console.error("[generate-quiz] Failed to store AI quality metrics:", metricsError);
      } else {
        console.log(`[generate-quiz] AI Quality Metrics: generated=${totalGenerated}, rejected=${totalRejected}, verified=${totalVerified}, accuracy=${accuracyRate.toFixed(1)}%`);
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

    console.log(`[generate-quiz] Complete: ${allQuestions.length} verified questions for source ${source_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        questions_generated: totalGenerated,
        questions_verified: totalVerified,
        questions_rejected: totalRejected,
        accuracy_rate: totalGenerated > 0 ? Math.round((totalVerified / totalGenerated) * 10000) / 100 : 100,
        questions: allQuestions,
      }),
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
