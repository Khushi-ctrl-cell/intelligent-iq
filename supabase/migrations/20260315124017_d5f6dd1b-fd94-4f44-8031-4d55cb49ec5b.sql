
-- Fix quiz_attempts: restrict INSERT to authenticated users only
DROP POLICY IF EXISTS "Attempts can be inserted by anyone" ON public.quiz_attempts;
CREATE POLICY "Attempts can be inserted by authenticated users"
  ON public.quiz_attempts FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix content_chunks: restrict INSERT to authenticated users only
DROP POLICY IF EXISTS "Chunks can be inserted by anyone" ON public.content_chunks;
CREATE POLICY "Chunks can be inserted by authenticated users"
  ON public.content_chunks FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix quiz_questions: restrict INSERT to authenticated users only
DROP POLICY IF EXISTS "Questions can be inserted by anyone" ON public.quiz_questions;
CREATE POLICY "Questions can be inserted by authenticated users"
  ON public.quiz_questions FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix sources: restrict INSERT to authenticated users only
DROP POLICY IF EXISTS "Sources can be inserted by anyone" ON public.sources;
CREATE POLICY "Sources can be inserted by authenticated users"
  ON public.sources FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix student_topic_progress: restrict INSERT and UPDATE to authenticated users only
DROP POLICY IF EXISTS "Progress can be inserted by anyone" ON public.student_topic_progress;
CREATE POLICY "Progress can be inserted by authenticated users"
  ON public.student_topic_progress FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Progress can be updated by anyone" ON public.student_topic_progress;
CREATE POLICY "Progress can be updated by authenticated users"
  ON public.student_topic_progress FOR UPDATE TO public
  USING (auth.uid() IS NOT NULL);
