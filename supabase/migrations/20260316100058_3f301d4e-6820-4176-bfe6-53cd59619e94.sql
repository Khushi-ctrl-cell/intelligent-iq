
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT true;

CREATE TABLE public.ai_quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questions_generated integer NOT NULL DEFAULT 0,
  questions_rejected integer NOT NULL DEFAULT 0,
  questions_verified integer NOT NULL DEFAULT 0,
  accuracy_rate numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_quality_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access" ON public.ai_quality_metrics FOR ALL TO public USING (false) WITH CHECK (false);
