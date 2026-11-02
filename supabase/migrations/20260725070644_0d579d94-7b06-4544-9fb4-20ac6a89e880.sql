
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  goal TEXT,
  level TEXT,
  availability TEXT,
  baseline_wpm INTEGER,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- lessons (public read)
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  theme TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_fr TEXT NOT NULL,
  content_en TEXT NOT NULL,
  exercise_prompt_fr TEXT NOT NULL,
  exercise_prompt_en TEXT NOT NULL,
  target_seconds INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lessons TO anon, authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons public read" ON public.lessons FOR SELECT TO anon, authenticated USING (true);

-- lesson_completions
CREATE TABLE public.lesson_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  wpm INTEGER,
  duration_sec INTEGER,
  transcript TEXT,
  feedback TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_completions TO authenticated;
GRANT ALL ON public.lesson_completions TO service_role;
ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own completions all" ON public.lesson_completions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- streaks
CREATE TABLE public.streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streaks TO authenticated;
GRANT ALL ON public.streaks TO service_role;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own streak all" ON public.streaks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_streaks_updated BEFORE UPDATE ON public.streaks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.streaks (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed 10 lessons across 3 themes
INSERT INTO public.lessons (slug, theme, order_index, title_fr, title_en, content_fr, content_en, exercise_prompt_fr, exercise_prompt_en, target_seconds) VALUES
('breath-1','breathing',1,'Respiration diaphragmatique','Diaphragmatic breathing','Placez une main sur le ventre. Inspirez 4s par le nez, gonflez le ventre, expirez 6s par la bouche. Répétez 5 fois pour ancrer votre voix.','Place one hand on your belly. Inhale 4s through the nose, expand belly, exhale 6s through the mouth. Repeat 5 times to anchor your voice.','Décrivez à voix haute votre respiration pendant que vous la faites, en une minute.','Describe your breathing out loud while doing it, in one minute.',60),
('breath-2','breathing',2,'Soupir sonore','Voiced sigh','Inspirez profondément, puis expirez sur un "ahhh" prolongé. Relâchez la mâchoire. Cet exercice libère la tension avant de parler.','Breathe deeply, then exhale on a long "ahhh". Release your jaw. This exercise relieves tension before speaking.','Racontez un moment où vous vous êtes senti détendu, pendant une minute.','Tell about a time you felt relaxed, for one minute.',60),
('breath-3','breathing',3,'Compter en expiration','Counting on exhale','Inspirez 4s. En expirant, comptez lentement de 1 à 10 sans reprendre votre souffle. Progressez à 15 puis 20.','Inhale 4s. On the exhale, count slowly from 1 to 10 without breathing. Progress to 15 then 20.','Comptez à voix haute de 1 à 20 en variant votre intonation.','Count out loud from 1 to 20 varying your intonation.',60),
('artic-1','articulation',1,'Virelangues','Tongue twisters','Répétez 3 fois de plus en plus vite : "Six chiens chassent six chats." Articulez chaque consonne.','Repeat 3 times, faster each time: "Six slippery snakes slid silently south." Articulate each consonant.','Inventez un virelangue et prononcez-le 3 fois.','Invent a tongue twister and say it 3 times.',60),
('artic-2','articulation',2,'Voyelles ouvertes','Open vowels','Prononcez A, E, I, O, U en ouvrant grand la bouche. Tenez chaque voyelle 3 secondes.','Say A, E, I, O, U opening your mouth wide. Hold each vowel 3 seconds.','Lisez un paragraphe préféré en exagérant vos voyelles.','Read a favorite paragraph exaggerating your vowels.',60),
('artic-3','articulation',3,'Bouchon en liège','Cork exercise','Serrez un stylo entre vos dents et lisez une phrase. Retirez-le : vous articulerez plus clairement.','Hold a pen between your teeth and read a sentence. Remove it — you will articulate more clearly.','Décrivez votre pièce préférée en articulant chaque mot.','Describe your favorite room articulating each word.',60),
('artic-4','articulation',4,'Rythme et pause','Rhythm and pause','Lisez un texte en marquant une pause d''une seconde à chaque virgule. Le silence donne du poids à vos mots.','Read a text pausing one second at each comma. Silence adds weight to your words.','Racontez un souvenir en insérant des pauses volontaires.','Tell a memory inserting deliberate pauses.',60),
('conf-1','confidence',1,'Pitch en 30 secondes','30-second pitch','Présentez-vous en 30 secondes : qui vous êtes, ce qui vous passionne, ce que vous cherchez.','Introduce yourself in 30 seconds: who you are, what you love, what you seek.','Faites votre pitch de 30 secondes maintenant.','Do your 30-second pitch now.',45),
('conf-2','confidence',2,'Défendre une opinion','Defend an opinion','Choisissez un sujet du quotidien. Défendez votre position avec 3 arguments clairs pendant une minute.','Pick a daily topic. Defend your view with 3 clear arguments for one minute.','Défendez : "Le meilleur moment de la journée est le matin."','Defend: "The best time of day is the morning."',60),
('conf-3','confidence',3,'Répondre à une question difficile','Answer a hard question','Une question inconfortable arrive. Prenez 2 secondes, respirez, puis répondez avec assurance.','A tough question comes. Take 2 seconds, breathe, then answer with confidence.','Répondez : "Quelle est votre plus grande faiblesse ?"','Answer: "What is your greatest weakness?"',60);
