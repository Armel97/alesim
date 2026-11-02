CREATE TABLE public.interview_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interview_type text NOT NULL DEFAULT 'rh',
  target_role text,
  sector text,
  difficulty text NOT NULL DEFAULT 'standard',
  format text NOT NULL DEFAULT 'audio',
  lang text NOT NULL DEFAULT 'fr',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_simulations TO authenticated;
GRANT ALL ON public.interview_simulations TO service_role;
ALTER TABLE public.interview_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own interview_simulations all" ON public.interview_simulations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.interview_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id uuid NOT NULL REFERENCES public.interview_simulations(id) ON DELETE CASCADE,
  question_index integer NOT NULL DEFAULT 0,
  question_text text NOT NULL,
  transcript text NOT NULL DEFAULT '',
  duration_sec integer NOT NULL DEFAULT 0,
  lang text NOT NULL DEFAULT 'fr',
  star jsonb NOT NULL DEFAULT '{}'::jsonb,
  structure_score integer NOT NULL DEFAULT 0,
  overall_note text NOT NULL DEFAULT '',
  form_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_responses TO authenticated;
GRANT ALL ON public.interview_responses TO service_role;
ALTER TABLE public.interview_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own interview_responses all" ON public.interview_responses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_interview_responses_user ON public.interview_responses(user_id, created_at DESC);
CREATE INDEX idx_interview_simulations_user ON public.interview_simulations(user_id, created_at DESC);

INSERT INTO public.badges (code, icon, title_fr, title_en, desc_fr, desc_en, condition_type, condition_value)
VALUES
 ('first_interview', '🎤', 'Premier entretien simulé', 'First mock interview', 'Tu as terminé ta première réponse en simulation d''entretien.', 'You completed your first mock interview answer.', 'interview_responses', 1),
 ('star_master', '⭐', 'STAR maîtrisé', 'STAR mastered', 'Trois réponses consécutives bien structurées selon la méthode STAR.', 'Three consecutive answers well structured with the STAR method.', 'star_streak', 3)
ON CONFLICT DO NOTHING;