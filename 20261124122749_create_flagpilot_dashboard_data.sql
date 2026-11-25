/*
# Create FlagPilot dashboard data

1. New Tables
- `feature_flags` stores the shared feature flag rows displayed in the dashboard.
- `id` is a stable text key for each flag.
- `name` is the human-readable feature flag name.
- `state` stores whether the flag is on, off, or paused.
- `targeting` describes the audience or split used by the flag.
- `value` describes the active variation or percentage.
- `users` stores the current exposed user count.
- `conversion` stores the conversion delta shown in the dashboard.
- `accent` stores the visual treatment used for the flag row.
- `created_at` and `updated_at` store record timestamps.
- `assistant_messages` stores shared assistant conversation history.
- `id` is the generated message identifier.
- `role` stores whether a message came from the assistant or the operator.
- `content` stores the message text.
- `created_at` stores when the message was created.

2. Security
- Row-level security is enabled on both tables.
- This is a no-sign-in, single-workspace demo, so anon and authenticated roles can use the shared dashboard data.
- Four explicit CRUD policies are added per table.
- Data API grants are limited to the verbs used by the dashboard.

3. Important Notes
- The frontend can load and update flags without an account because this first version does not include sign-in.
- Seed rows are inserted only when their stable ids are missing, so applying this migration again does not duplicate them.
*/

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id text PRIMARY KEY,
  name text NOT NULL,
  state text NOT NULL CHECK (state IN ('on', 'off', 'paused')),
  targeting text NOT NULL,
  value text NOT NULL,
  users integer NOT NULL DEFAULT 0,
  conversion text NOT NULL,
  accent text NOT NULL DEFAULT 'green',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('assistant', 'operator')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_messages TO anon, authenticated;

DROP POLICY IF EXISTS "Shared users can read feature flags" ON public.feature_flags;
CREATE POLICY "Shared users can read feature flags" ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Shared users can create feature flags" ON public.feature_flags;
CREATE POLICY "Shared users can create feature flags" ON public.feature_flags FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Shared users can update feature flags" ON public.feature_flags;
CREATE POLICY "Shared users can update feature flags" ON public.feature_flags FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Shared users can delete feature flags" ON public.feature_flags;
CREATE POLICY "Shared users can delete feature flags" ON public.feature_flags FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Shared users can read assistant messages" ON public.assistant_messages;
CREATE POLICY "Shared users can read assistant messages" ON public.assistant_messages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Shared users can create assistant messages" ON public.assistant_messages;
CREATE POLICY "Shared users can create assistant messages" ON public.assistant_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Shared users can update assistant messages" ON public.assistant_messages;
CREATE POLICY "Shared users can update assistant messages" ON public.assistant_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Shared users can delete assistant messages" ON public.assistant_messages;
CREATE POLICY "Shared users can delete assistant messages" ON public.assistant_messages FOR DELETE TO anon, authenticated USING (true);

INSERT INTO public.feature_flags (id, name, state, targeting, value, users, conversion, accent)
VALUES
  ('checkout_v2', 'checkout_v2', 'on', '50/50 split', 'Variant A / B', 15480, '+4.2%', 'green'),
  ('ai_suggestions', 'ai_suggestions', 'on', 'Segment: beta', '20% enabled', 2430, '+8.7%', 'amber'),
  ('pricing_test', 'pricing_test', 'on', '45/55 split', 'Control / Test', 11920, '+0.9%', 'green'),
  ('search_algos', 'search_algos', 'on', '50/50 split', 'Algo A / B', 7895, '+2.3%', 'green'),
  ('dark_mode_beta', 'dark_mode_beta', 'on', '30/70 split', 'Light / Dark', 3210, '+10.5%', 'amber'),
  ('new_onboarding', 'new_onboarding', 'off', 'All users', 'Enabled (100%)', 9105, '-1.1%', 'red'),
  ('mobile_ui_refresh', 'mobile_ui_refresh', 'off', 'iOS only', 'Enabled (100%)', 4650, '-0.5%', 'red'),
  ('video_autoplay', 'video_autoplay', 'paused', 'All users', 'Disabled (0%)', 0, '—', 'amber')
ON CONFLICT (id) DO NOTHING;
