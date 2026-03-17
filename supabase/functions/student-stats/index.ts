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

    const url = new URL(req.url);
    const studentId = url.searchParams.get("student_id");

    if (!studentId) {
      return new Response(JSON.stringify({ error: "student_id query parameter required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [prog, countRes, recentRes] = await Promise.all([
      supabase.from("student_topic_progress").select("*").eq("student_id", studentId).single(),
      supabase.from("quiz_attempts").select("*", { count: "exact", head: true }).eq("student_id", studentId),
      supabase.from("quiz_attempts").select("difficulty_at_time").eq("student_id", studentId).order("created_at", { ascending: false }).limit(1),
    ]);

    return new Response(
      JSON.stringify({
        progress: prog.data || null,
        total_attempts: countRes.count || 0,
        recent_difficulty: recentRes.data?.[0]?.difficulty_at_time || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[student-stats] Error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
