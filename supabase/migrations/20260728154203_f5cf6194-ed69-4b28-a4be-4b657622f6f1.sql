
CREATE TABLE public.weekly_coaching (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  lang text NOT NULL DEFAULT 'fr',
  summary text NOT NULL,
  priority_skill text NOT NULL,
  progress_note text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  progression jsonb NOT NULL DEFAULT '{}'::jsonb,
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  sample_size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_coaching TO authenticated;
GRANT ALL ON public.weekly_coaching TO service_role;

ALTER TABLE public.weekly_coaching ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own weekly_coaching all"
  ON public.weekly_coaching
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER weekly_coaching_set_updated_at
  BEFORE UPDATE ON public.weekly_coaching
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX weekly_coaching_user_week_idx
  ON public.weekly_coaching (user_id, week_start DESC);
