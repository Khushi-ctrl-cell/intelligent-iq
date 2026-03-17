import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const isAdmin = req.headers.get("x-admin-key") === Deno.env.get("ADMIN_SECRET");

  const checks: Record<string, string> = {
    database: "unavailable",
    ai: "unavailable",
    storage: "unavailable",
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbErr } = await supabase.from("sources").select("id").limit(1);
    checks.database = dbErr ? "error" : "connected";

    const aiApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (aiApiKey) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${aiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        });
        checks.ai = aiRes.ok || aiRes.status === 200 ? "available" : "error";
      } catch {
        checks.ai = "unreachable";
      }
    } else {
      checks.ai = "not_configured";
    }

    const { error: storageErr } = await supabase.storage.from("pdfs").list("", { limit: 1 });
    checks.storage = storageErr ? "error" : "available";

    const allHealthy = checks.database === "connected" && checks.ai === "available" && checks.storage === "available";

    // Public callers get minimal info; admin gets full details
    const responseBody: Record<string, unknown> = {
      status: allHealthy ? "ok" : "degraded",
      services: checks,
      timestamp: new Date().toISOString(),
    };

    if (isAdmin) {
      responseBody.config = {
        embedding_model: "text-embedding-3-small",
        quiz_model: "google/gemini-3-flash-preview",
        rate_limit_quiz: "5/min",
        rate_limit_explanation: "10/min",
      };
    }

    return new Response(JSON.stringify(responseBody), {
      status: allHealthy ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[health] Check failed:", e);
    return new Response(
      JSON.stringify({
        status: "error",
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
