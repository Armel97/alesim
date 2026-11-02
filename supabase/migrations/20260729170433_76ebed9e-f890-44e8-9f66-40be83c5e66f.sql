CREATE TABLE public.cv_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_kind text NOT NULL,
  extracted_text text NOT NULL,
  target_role text,
  lang text NOT NULL DEFAULT 'fr',
  score integer NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  tone_note text NOT NULL DEFAULT '',
  axes jsonb NOT NULL DEFAULT '[]'::jsonb,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_lesson_theme text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cv_analyses TO authenticated;
GRANT ALL ON public.cv_analyses TO service_role;

ALTER TABLE public.cv_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cv_analyses all" ON public.cv_analyses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX cv_analyses_user_created_idx ON public.cv_analyses (user_id, created_at DESC);

CREATE TRIGGER cv_analyses_set_updated_at
  BEFORE UPDATE ON public.cv_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.badges (code, icon, title_fr, title_en, desc_fr, desc_en, condition_type, condition_value)
VALUES ('cv_optimized', '📄', 'CV optimisé', 'Polished résumé', 'Tu as analysé ton CV pour l''améliorer.', 'You ran an AI review of your résumé.', 'cv_analyses', 1)
ON CONFLICT DO NOTHING;