export interface Source {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
}

export interface ContentChunk {
  id: string;
  source_id: string;
  chunk_index: number;
  text: string;
  subject: string | null;
  topic: string | null;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  source_id: string | null;
  source_chunk_id: string | null;
  question_hash: string | null;
  question: string;
  type: string | null;
  options: string[] | null;
  answer: string;
  difficulty: string | null;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  student_id: string;
  question_id: string | null;
  selected_answer: string;
  is_correct: boolean;
  difficulty_at_time: string | null;
  created_at: string;
}

export interface StudentProgress {
  student_id: string;
  topic: string;
  correct_count: number;
  wrong_count: number;
  mastery_level: string;
}

export type PipelineStatus = "idle" | "uploading" | "ingesting" | "generating" | "complete" | "error";
