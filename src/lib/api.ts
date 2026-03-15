const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const headers = {
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

export async function ingestPDF(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest`, {
    method: "POST",
    headers: { ...headers },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Ingestion failed");
  }
  return res.json();
}

export async function generateQuiz(sourceId: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-quiz`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ source_id: sourceId }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Quiz generation failed");
  }
  return res.json();
}

export async function fetchQuiz(params?: { source_id?: string; difficulty?: string }) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/quiz`);
  if (params?.source_id) url.searchParams.set("source_id", params.source_id);
  if (params?.difficulty) url.searchParams.set("difficulty", params.difficulty);

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to fetch quiz");
  }
  return res.json();
}

export async function submitAnswer(studentId: string, questionId: string, selectedAnswer: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-answer`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: studentId, question_id: questionId, selected_answer: selectedAnswer }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to submit answer");
  }
  return res.json();
}

export async function generateExplanation(question: string, correctAnswer: string, chunkText?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-explanation`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ question, correct_answer: correctAnswer, chunk_text: chunkText }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to generate explanation");
  }
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/health`, { headers });
  if (!res.ok) {
    throw new Error("Health check failed");
  }
  return res.json();
}

export async function fetchAdminData() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-data`, { headers });
  if (!res.ok) {
    throw new Error("Failed to fetch admin data");
  }
  return res.json();
}

export async function fetchStudentStats(studentId: string) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/student-stats`);
  url.searchParams.set("student_id", studentId);
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    throw new Error("Failed to fetch student stats");
  }
  return res.json();
}
