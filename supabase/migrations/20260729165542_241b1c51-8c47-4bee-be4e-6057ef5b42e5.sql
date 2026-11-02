CREATE TABLE public.video_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT,
  lang TEXT NOT NULL DEFAULT 'fr',
  duration_sec INTEGER NOT NULL,
  transcript TEXT,
  posture_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  gaze_camera_pct INTEGER NOT NULL DEFAULT 0,
  hesitation_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  markers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_sessions TO authenticated;
GRANT ALL ON public.video_sessions TO service_role;
ALTER TABLE public.video_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own video_sessions all" ON public.video_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX video_sessions_user_created_idx ON public.video_sessions(user_id, created_at DESC);