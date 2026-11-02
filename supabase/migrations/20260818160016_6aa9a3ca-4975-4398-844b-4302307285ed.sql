CREATE TABLE public.email_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  event_type text NOT NULL,
  recipient text,
  message_id text,
  template text,
  status text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_delivery_events_occurred_at_idx ON public.email_delivery_events (occurred_at DESC);
CREATE INDEX email_delivery_events_type_idx ON public.email_delivery_events (event_type);

GRANT SELECT ON public.email_delivery_events TO authenticated;
GRANT ALL ON public.email_delivery_events TO service_role;

ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email delivery events"
ON public.email_delivery_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));