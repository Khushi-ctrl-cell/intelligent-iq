import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [s, c, q, a, m] = await Promise.all([
      supabase.from("sources").select("*").order("created_at", { ascending: false }),
      supabase.from("content_chunks").select("id, source_id, chunk_index, text, subject, topic, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("quiz_questions").select("*").order("created_at", { ascending: false }),
      supabase.from("quiz_attempts").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("ai_quality_metrics").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    return new Response(
      JSON.stringify({
        sources: s.data || [],
        chunks: c.data || [],
        questions: q.data || [],
        attempts: a.data || [],
        ai_metrics: m.data || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[admin-data] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
