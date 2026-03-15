
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Rate Limiting ---
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 10;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  console.log(`[generate-explanation] Request from IP: ${clientIP}`);

  if (isRateLimited(clientIP)) {
    console.warn(`[generate-explanation] Rate limited: ${clientIP}`);
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Max 10 explanation requests per minute." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const aiApiKey = Deno.env.get("LOVABLE_API_KEY")!; // AI Gateway API key

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { question, correct_answer, chunk_text } = body;

    if (!question || typeof question !== "string" || !correct_answer || typeof correct_answer !== "string") {
      return new Response(
        JSON.stringify({ error: "question (string) and correct_answer (string) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize input lengths
    const safeQuestion = (question as string).slice(0, 1000);
    const safeAnswer = (correct_answer as string).slice(0, 500);
    const safeChunk = chunk_text && typeof chunk_text === "string" ? (chunk_text as string).slice(0, 2000) : "";

    console.log(`[generate-explanation] Question: ${safeQuestion.slice(0, 80)}...`);

    const prompt = `You are an educational tutor. A student answered a quiz question. Explain why the correct answer is right in 2-3 concise sentences.

Question: ${safeQuestion}
Correct Answer: ${safeAnswer}
${safeChunk ? `\nSource Material: ${safeChunk}` : ""}

Provide a clear, educational explanation.`;

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

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[generate-explanation] AI gateway rate limited");
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.warn("[generate-explanation] AI credits exhausted");
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("[generate-explanation] AI error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Failed to generate explanation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content || "No explanation available.";

    console.log(`[generate-explanation] ✓ Explanation generated (${explanation.length} chars)`);

    return new Response(
      JSON.stringify({ explanation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[generate-explanation] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
