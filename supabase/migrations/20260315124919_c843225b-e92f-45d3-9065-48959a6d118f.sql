
-- quiz_attempts: no direct client access needed, edge functions use service_role
DROP POLICY IF EXISTS "Attempts readable by authenticated users" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Attempts inserted by authenticated users" ON public.quiz_attempts;

-- student_topic_progress: no direct client access needed
DROP POLICY IF EXISTS "Progress readable by authenticated users" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Progress inserted by authenticated users" ON public.student_topic_progress;
DROP POLICY IF EXISTS "Progress updated by authenticated users" ON public.student_topic_progress;

-- quiz_questions: no direct client access needed
DROP POLICY IF EXISTS "Questions readable by authenticated users" ON public.quiz_questions;
DROP POLICY IF EXISTS "Questions inserted by authenticated users" ON public.quiz_questions;

-- sources: no direct client access needed
DROP POLICY IF EXISTS "Sources readable by authenticated users" ON public.sources;
DROP POLICY IF EXISTS "Sources inserted by authenticated users" ON public.sources;

-- content_chunks: no direct client access needed
DROP POLICY IF EXISTS "Chunks readable by authenticated users" ON public.content_chunks;
DROP POLICY IF EXISTS "Chunks inserted by authenticated users" ON public.content_chunks;
