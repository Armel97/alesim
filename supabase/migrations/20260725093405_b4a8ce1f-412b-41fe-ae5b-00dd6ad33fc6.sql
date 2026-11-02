
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_reminder_dow smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS weekly_reminder_hour_utc smallint NOT NULL DEFAULT 17,
  ADD COLUMN IF NOT EXISTS quiet_start_hour_utc smallint,
  ADD COLUMN IF NOT EXISTS quiet_end_hour_utc smallint,
  ADD COLUMN IF NOT EXISTS last_weekly_reminder_at timestamptz;
