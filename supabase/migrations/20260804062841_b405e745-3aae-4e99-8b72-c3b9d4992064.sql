-- 1) funnel_events: explicit owner-scoped SELECT, no anon reads
REVOKE SELECT ON public.funnel_events FROM anon;
GRANT SELECT ON public.funnel_events TO authenticated;
GRANT ALL ON public.funnel_events TO service_role;

DROP POLICY IF EXISTS "Users can read their own funnel events" ON public.funnel_events;
CREATE POLICY "Users can read their own funnel events"
ON public.funnel_events
FOR SELECT
TO authenticated
USING (user_id IS NOT NULL AND user_id = auth.uid());

-- 2) quizzes: no direct Data API reads (answers must stay server-side)
DROP POLICY IF EXISTS "quizzes public read" ON public.quizzes;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.quizzes FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.quizzes FROM authenticated;
GRANT ALL ON public.quizzes TO service_role;