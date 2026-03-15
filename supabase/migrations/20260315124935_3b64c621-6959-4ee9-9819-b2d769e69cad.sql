
-- Add deny-all policies: RLS is enabled, no direct client access allowed.
-- Edge functions use service_role which bypasses RLS.

CREATE POLICY "No direct access" ON public.quiz_attempts FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY "No direct access" ON public.student_topic_progress FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY "No direct access" ON public.quiz_questions FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY "No direct access" ON public.sources FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY "No direct access" ON public.content_chunks FOR ALL TO public USING (false) WITH CHECK (false);
