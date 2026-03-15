import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DIFFICULTY_LADDER: Record<string, { correct: string; incorrect: string }> = {
  easy: { correct: "medium", incorrect: "easy" },
  medium: { correct: "hard", incorrect: "easy" },
  hard: { correct: "hard", incorrect: "medium" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const { student_id, question_id, selected_answer } = body;

    if (!student_id || typeof student_id !== "string") {
      return new Response(
        JSON.stringify({ error: "student_id is required (UUID string)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!question_id || typeof question_id !== "string") {
      return new Response(
        JSON.stringify({ error: "question_id is required (UUID string)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!selected_answer || typeof selected_answer !== "string" || (selected_answer as string).trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "selected_answer is required (non-empty string)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[submit-answer] Student: ${student_id}, Question: ${question_id}`);

    // Fetch question
    const { data: question, error: qError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("id", question_id)
      .single();

    if (qError || !question) {
      console.error("[submit-answer] Question not found:", question_id);
      return new Response(JSON.stringify({ error: "Question not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCorrect = question.answer.trim().toLowerCase() === (selected_answer as string).trim().toLowerCase();
    const difficulty = question.difficulty || "medium";
    const ladder = DIFFICULTY_LADDER[difficulty] || DIFFICULTY_LADDER.medium;
    const nextDifficulty = isCorrect ? ladder.correct : ladder.incorrect;

    console.log(`[submit-answer] Answer: ${isCorrect ? "CORRECT ✓" : "INCORRECT ✗"} | Difficulty: ${difficulty} → ${nextDifficulty}`);

    // Log attempt
    const { error: attemptError } = await supabase.from("quiz_attempts").insert({
      student_id,
      question_id,
      selected_answer,
      is_correct: isCorrect,
      difficulty_at_time: difficulty,
    });

    if (attemptError) {
      console.error("[submit-answer] Attempt insert error:", attemptError);
    }

    // Update student progress
    const topic = "general";
    const { data: existing } = await supabase
      .from("student_topic_progress")
      .select("*")
      .eq("student_id", student_id)
      .eq("topic", topic)
      .single();

    if (existing) {
      const correctCount = (existing.correct_count || 0) + (isCorrect ? 1 : 0);
      const wrongCount = (existing.wrong_count || 0) + (isCorrect ? 0 : 1);
      const total = correctCount + wrongCount;
      const accuracy = total > 0 ? correctCount / total : 0;
      let mastery = "beginner";
      if (accuracy > 0.8) mastery = "mastered";
      else if (accuracy >= 0.5) mastery = "improving";
      else mastery = "weak";

      console.log(`[submit-answer] Progress: ${correctCount}/${total} (${(accuracy * 100).toFixed(0)}%) → ${mastery}`);

      await supabase
        .from("student_topic_progress")
        .update({ correct_count: correctCount, wrong_count: wrongCount, mastery_level: mastery })
        .eq("student_id", student_id)
        .eq("topic", topic);
    } else {
      console.log("[submit-answer] Creating new progress record");
      await supabase.from("student_topic_progress").insert({
        student_id,
        topic,
        correct_count: isCorrect ? 1 : 0,
        wrong_count: isCorrect ? 0 : 1,
        mastery_level: "beginner",
      });
    }

    return new Response(
      JSON.stringify({
        correct: isCorrect,
        correct_answer: question.answer,
        next_difficulty: nextDifficulty,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[submit-answer] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
