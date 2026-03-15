
-- Restrict SELECT on quiz_attempts to authenticated users
DROP POLICY IF EXISTS "Attempts are publicly readable" ON public.quiz_attempts;
CREATE POLICY "Attempts readable by authenticated users"
  ON public.quiz_attempts FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

-- Tighten INSERT to match student_id (for when auth is used)
DROP POLICY IF EXISTS "Attempts can be inserted by authenticated users" ON public.quiz_attempts;
CREATE POLICY "Attempts inserted by authenticated users"
  ON public.quiz_attempts FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

-- Restrict SELECT on student_topic_progress to authenticated users
DROP POLICY IF EXISTS "Progress is publicly readable" ON public.student_topic_progress;
CREATE POLICY "Progress readable by authenticated users"
  ON public.student_topic_progress FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

-- Tighten INSERT/UPDATE on student_topic_progress
DROP POLICY IF EXISTS "Progress can be inserted by authenticated users" ON public.student_topic_progress;
CREATE POLICY "Progress inserted by authenticated users"
  ON public.student_topic_progress FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Progress can be updated by authenticated users" ON public.student_topic_progress;
CREATE POLICY "Progress updated by authenticated users"
  ON public.student_topic_progress FOR UPDATE TO public
  USING (auth.uid() IS NOT NULL);

-- Restrict SELECT on quiz_questions to authenticated (hides answers from public)
DROP POLICY IF EXISTS "Questions are publicly readable" ON public.quiz_questions;
CREATE POLICY "Questions readable by authenticated users"
  ON public.quiz_questions FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

-- Tighten INSERT on quiz_questions
DROP POLICY IF EXISTS "Questions can be inserted by authenticated users" ON public.quiz_questions;
CREATE POLICY "Questions inserted by authenticated users"
  ON public.quiz_questions FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

-- Restrict SELECT on sources to authenticated users
DROP POLICY IF EXISTS "Sources are publicly readable" ON public.sources;
CREATE POLICY "Sources readable by authenticated users"
  ON public.sources FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

-- Tighten INSERT on sources
DROP POLICY IF EXISTS "Sources can be inserted by authenticated users" ON public.sources;
CREATE POLICY "Sources inserted by authenticated users"
  ON public.sources FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

-- Restrict SELECT on content_chunks to authenticated users
DROP POLICY IF EXISTS "Chunks are publicly readable" ON public.content_chunks;
CREATE POLICY "Chunks readable by authenticated users"
  ON public.content_chunks FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

-- Tighten INSERT on content_chunks
DROP POLICY IF EXISTS "Chunks can be inserted by authenticated users" ON public.content_chunks;
CREATE POLICY "Chunks inserted by authenticated users"
  ON public.content_chunks FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);
