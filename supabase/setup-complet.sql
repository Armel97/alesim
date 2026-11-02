-- ALESIM : schéma complet (toutes les migrations, dans l'ordre).
-- À coller dans Supabase > SQL Editor > New query, puis Run. À exécuter UNE seule fois sur un projet vide.

-- ===== 20260725070644_0d579d94-7b06-4544-9fb4-20ac6a89e880.sql =====

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


-- ===== 20260725070653_f5726e8d-b6ce-409a-a86a-caf4069830cc.sql =====

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;


-- ===== 20260725071332_dd0e6bd7-38e1-4444-8d4d-a28f47af6f06.sql =====

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_push_subscriptions_updated
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_hour_utc smallint NOT NULL DEFAULT 17,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;


-- ===== 20260725072418_c7a6e301-1a7c-4d15-b8a1-9269696dc1f4.sql =====

-- ============ EXTENSIONS TO EXISTING TABLES ============
ALTER TABLE public.lesson_completions
  ADD COLUMN IF NOT EXISTS quiz_score integer,
  ADD COLUMN IF NOT EXISTS quiz_total integer;

ALTER TABLE public.streaks
  ADD COLUMN IF NOT EXISTS grace_last_used date;

-- ============ QUIZZES ============
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  questions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id)
);
GRANT SELECT ON public.quizzes TO anon, authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quizzes public read" ON public.quizzes FOR SELECT USING (true);

-- ============ BADGES ============
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  icon text NOT NULL,
  title_fr text NOT NULL,
  title_en text NOT NULL,
  desc_fr text NOT NULL,
  desc_en text NOT NULL,
  condition_type text NOT NULL, -- streak | lessons_completed | content_views | quiz_perfect | theme_completed
  condition_value integer NOT NULL,
  condition_meta text,           -- e.g. theme name for theme_completed
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges public read" ON public.badges FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own user_badges all" ON public.user_badges FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ CONTENT LIBRARY ============
CREATE TABLE IF NOT EXISTS public.content_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  theme text NOT NULL,           -- confidence | communication | language (or breathing/articulation)
  level text NOT NULL,           -- beginner | intermediate | advanced
  duration_min integer NOT NULL DEFAULT 5,
  tags text[] NOT NULL DEFAULT '{}',
  title_fr text NOT NULL,
  title_en text NOT NULL,
  body_fr text NOT NULL,
  body_en text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_library TO anon, authenticated;
GRANT ALL ON public.content_library TO service_role;
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_library public read" ON public.content_library FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.content_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_id uuid NOT NULL REFERENCES public.content_library(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_id)
);
GRANT SELECT, INSERT, DELETE ON public.content_views TO authenticated;
GRANT ALL ON public.content_views TO service_role;
ALTER TABLE public.content_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own content_views all" ON public.content_views FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ SEED: QUIZZES for the 10 lessons ============
INSERT INTO public.quizzes (lesson_id, questions)
SELECT l.id, q.questions FROM public.lessons l
JOIN (VALUES
  ('breath-1', '[
    {"q_fr":"À quel endroit doit se gonfler votre corps lors de la respiration diaphragmatique ?","q_en":"Where should your body expand during diaphragmatic breathing?","options_fr":["La poitrine","Le ventre","Les épaules"],"options_en":["The chest","The belly","The shoulders"],"answer":1,"exp_fr":"L''air descend dans le diaphragme : le ventre se gonfle, pas la poitrine.","exp_en":"Air fills the diaphragm: the belly expands, not the chest."},
    {"q_fr":"Quel est le principal bénéfice de cette respiration avant de parler ?","q_en":"What is the main benefit of this breath before speaking?","options_fr":["Parler plus vite","Calmer le stress et poser la voix","Augmenter le volume"],"options_en":["Speak faster","Calm stress and ground the voice","Increase volume"],"answer":1,"exp_fr":"Elle apaise le système nerveux et stabilise la voix.","exp_en":"It calms the nervous system and stabilizes the voice."}
  ]'::jsonb),
  ('breath-2', '[
    {"q_fr":"À quoi sert le soupir sonore ?","q_en":"What is the sighed exhale for?","options_fr":["Relâcher les tensions","Chanter plus juste","Parler plus fort"],"options_en":["Release tension","Sing in tune","Speak louder"],"answer":0,"exp_fr":"Le soupir décharge la tension du haut du corps.","exp_en":"The sigh releases upper-body tension."},
    {"q_fr":"Combien de soupirs sont recommandés ?","q_en":"How many sighs are recommended?","options_fr":["1","3 à 5","10"],"options_en":["1","3 to 5","10"],"answer":1,"exp_fr":"Trois à cinq soupirs suffisent pour se recentrer.","exp_en":"Three to five sighs are enough to reset."}
  ]'::jsonb),
  ('breath-3', '[
    {"q_fr":"Que faites-vous en expirant lentement ?","q_en":"What do you do while exhaling slowly?","options_fr":["Retenir votre souffle","Compter à voix haute","Chanter"],"options_en":["Hold your breath","Count out loud","Sing"],"answer":1,"exp_fr":"Compter allonge et régule l''expiration.","exp_en":"Counting extends and steadies the exhale."},
    {"q_fr":"Que travaille cet exercice ?","q_en":"What does this exercise train?","options_fr":["Le débit et le contrôle du souffle","La mémoire","La grammaire"],"options_en":["Pace and breath control","Memory","Grammar"],"answer":0,"exp_fr":"On apprend à doser son souffle pour un débit stable.","exp_en":"You learn to meter breath for a steady pace."}
  ]'::jsonb),
  ('artic-1', '[
    {"q_fr":"Comment prononcer un virelangue efficacement ?","q_en":"How to say a tongue twister effectively?","options_fr":["Le plus vite possible","Lentement puis progressivement plus vite","En criant"],"options_en":["As fast as possible","Slowly, then gradually faster","By shouting"],"answer":1,"exp_fr":"On commence lentement pour installer l''articulation, puis on accélère.","exp_en":"Start slow to lock articulation in, then speed up."},
    {"q_fr":"Quel muscle est principalement sollicité ?","q_en":"Which muscle is mainly used?","options_fr":["La langue et les lèvres","Le diaphragme","Les cordes vocales seules"],"options_en":["Tongue and lips","Diaphragm","Vocal cords only"],"answer":0,"exp_fr":"L''articulation dépend surtout de la mobilité de la langue et des lèvres.","exp_en":"Articulation mostly relies on tongue and lip mobility."}
  ]'::jsonb),
  ('artic-2', '[
    {"q_fr":"Que fait-on avec des voyelles ouvertes ?","q_en":"What do open vowels do?","options_fr":["Fermer la bouche","Ouvrir davantage la mâchoire","Baisser la voix"],"options_en":["Close the mouth","Open the jaw more","Lower the voice"],"answer":1,"exp_fr":"Ouvrir la mâchoire libère la résonance et la clarté.","exp_en":"Opening the jaw frees resonance and clarity."},
    {"q_fr":"Quel bénéfice principal ?","q_en":"Main benefit?","options_fr":["Voix plus timbrée","Vocabulaire plus riche","Grammaire meilleure"],"options_en":["Fuller voice","Richer vocabulary","Better grammar"],"answer":0,"exp_fr":"On gagne en projection et en timbre.","exp_en":"You gain projection and tone."}
  ]'::jsonb),
  ('artic-3', '[
    {"q_fr":"Où place-t-on le bouchon en liège ?","q_en":"Where do you place the cork?","options_fr":["Sur la langue","Entre les incisives","Dans la joue"],"options_en":["On the tongue","Between the front teeth","In the cheek"],"answer":1,"exp_fr":"On mord légèrement le bouchon entre les incisives.","exp_en":"You lightly bite the cork between front teeth."},
    {"q_fr":"Que force cette contrainte ?","q_en":"What does this constraint force?","options_fr":["Une meilleure articulation","Une voix plus grave","Une respiration plus rapide"],"options_en":["Sharper articulation","A lower voice","Faster breathing"],"answer":0,"exp_fr":"On force la précision des consonnes et des voyelles.","exp_en":"You force precise consonants and vowels."}
  ]'::jsonb),
  ('artic-4', '[
    {"q_fr":"Que travaille cet exercice ?","q_en":"What does this exercise train?","options_fr":["Le rythme et les pauses","Le vocabulaire","La grammaire"],"options_en":["Rhythm and pauses","Vocabulary","Grammar"],"answer":0,"exp_fr":"Les pauses structurent le discours.","exp_en":"Pauses give structure to speech."},
    {"q_fr":"À quoi sert une pause volontaire ?","q_en":"What is a deliberate pause for?","options_fr":["Combler un vide","Marquer une idée clé","Reprendre son souffle uniquement"],"options_en":["Fill silence","Emphasize a key idea","Only to breathe"],"answer":1,"exp_fr":"La pause souligne les idées et capte l''attention.","exp_en":"A pause emphasizes ideas and captures attention."}
  ]'::jsonb),
  ('conf-1', '[
    {"q_fr":"Que doit contenir un pitch en 30 secondes ?","q_en":"What should a 30-second pitch contain?","options_fr":["Qui / quoi / pourquoi","Votre CV complet","Une blague"],"options_en":["Who / what / why","Your full resume","A joke"],"answer":0,"exp_fr":"Un bon pitch répond à qui vous êtes, ce que vous faites et pourquoi.","exp_en":"A great pitch covers who you are, what you do and why."},
    {"q_fr":"Quel est le meilleur début ?","q_en":"Best opening?","options_fr":["Une accroche claire","Une excuse","Un long préambule"],"options_en":["A crisp hook","An apology","A long preamble"],"answer":0,"exp_fr":"Accrocher dès la première phrase capte l''attention.","exp_en":"A crisp opening grabs attention."}
  ]'::jsonb),
  ('conf-2', '[
    {"q_fr":"Pour défendre une opinion, on commence par…","q_en":"To defend an opinion, start with…","options_fr":["Une affirmation claire","Une longue liste de doutes","Une question rhétorique vague"],"options_en":["A clear claim","A long list of doubts","A vague rhetorical question"],"answer":0,"exp_fr":"Une affirmation nette pose le cadre.","exp_en":"A clear claim sets the frame."},
    {"q_fr":"Que faut-il ajouter à une affirmation ?","q_en":"What should follow the claim?","options_fr":["Un exemple concret","Un silence gêné","Une excuse"],"options_en":["A concrete example","An awkward silence","An apology"],"answer":0,"exp_fr":"Un exemple concret rend l''idée crédible.","exp_en":"A concrete example makes it credible."}
  ]'::jsonb),
  ('conf-3', '[
    {"q_fr":"Face à une question difficile, on…","q_en":"Facing a hard question, you…","options_fr":["Répond immédiatement","Prend une pause pour structurer","Change de sujet"],"options_en":["Answer immediately","Pause to structure the answer","Change the topic"],"answer":1,"exp_fr":"Une courte pause vaut mieux qu''une réponse confuse.","exp_en":"A short pause beats a confused answer."},
    {"q_fr":"Structure recommandée ?","q_en":"Recommended structure?","options_fr":["Idée principale puis exemple","Longue introduction","Détails d''abord"],"options_en":["Main point then example","Long introduction","Details first"],"answer":0,"exp_fr":"Idée principale + exemple = réponse claire.","exp_en":"Main point + example = clear answer."}
  ]'::jsonb)
) AS q(slug, questions) ON q.slug = l.slug
ON CONFLICT (lesson_id) DO NOTHING;

-- ============ SEED: BADGES (10) ============
INSERT INTO public.badges (code, icon, title_fr, title_en, desc_fr, desc_en, condition_type, condition_value, condition_meta) VALUES
  ('first-step','footprints','Premier pas','First Step','Terminez votre première leçon.','Complete your first lesson.','lessons_completed',1,NULL),
  ('week-streak','flame','Une semaine engagé','On Fire','7 jours d''affilée.','7-day streak.','streak',7,NULL),
  ('marathon','trophy','Marathonien','Marathoner','30 jours d''affilée.','30-day streak.','streak',30,NULL),
  ('century','crown','Centenaire','Centurion','100 jours d''affilée.','100-day streak.','streak',100,NULL),
  ('explorer','compass','Explorateur','Explorer','Consultez 5 contenus dans Explorer.','View 5 pieces of content in Explore.','content_views',5,NULL),
  ('curious','book-open','Curieux','Curious','Consultez 10 contenus dans Explorer.','View 10 pieces of content in Explore.','content_views',10,NULL),
  ('quiz-ace','sparkles','As du quiz','Quiz Ace','Obtenez un quiz parfait.','Get a perfect quiz.','quiz_perfect',1,NULL),
  ('breath-master','wind','Souffle maîtrisé','Breath Master','Terminez 3 leçons de respiration.','Complete 3 breathing lessons.','theme_completed',3,'breathing'),
  ('articulator','mic','Articulateur','Articulator','Terminez 3 leçons d''articulation.','Complete 3 articulation lessons.','theme_completed',3,'articulation'),
  ('confident-voice','shield-check','Voix assurée','Confident Voice','Terminez 3 leçons de confiance.','Complete 3 confidence lessons.','theme_completed',3,'confidence')
ON CONFLICT (code) DO NOTHING;

-- ============ SEED: CONTENT LIBRARY (15) ============
INSERT INTO public.content_library (slug, theme, level, duration_min, tags, title_fr, title_en, body_fr, body_en) VALUES
  ('breathing-4-7-8','breathing','beginner',3,ARRAY['stress','calme'],'La respiration 4-7-8','The 4-7-8 breath','Inspirez 4s, retenez 7s, expirez 8s. Répétez 4 cycles pour apaiser le stress.','Inhale 4s, hold 7s, exhale 8s. Do 4 cycles to calm stress.'),
  ('breathing-box','breathing','beginner',4,ARRAY['focus'],'La respiration carrée','Box breathing','Inspirez 4s, retenez 4s, expirez 4s, retenez 4s. Utilisée par les militaires pour rester concentré.','Inhale 4s, hold 4s, exhale 4s, hold 4s. Used by military for laser focus.'),
  ('breathing-warmup','breathing','intermediate',5,ARRAY['échauffement'],'Échauffement du souffle','Breath warm-up','Trois séries d''expirations sonores croissantes pour ouvrir la voix avant une prise de parole.','Three sets of rising sighed exhales to open the voice before speaking.'),
  ('articulation-consonnes','articulation','beginner',5,ARRAY['consonnes'],'Cadence de consonnes','Consonant drills','Répétez p-t-k, b-d-g lentement puis rapidement. Excellent réveil articulatoire.','Repeat p-t-k, b-d-g slowly then quickly. Great articulation wake-up.'),
  ('articulation-lips','articulation','beginner',3,ARRAY['lèvres'],'Réveil des lèvres','Lip wake-up','Vibration des lèvres 30s + moue exagérée + sourire large. Ouvre la résonance.','30s of lip trills, exaggerated pouts, wide smile. Opens resonance.'),
  ('articulation-jaw','articulation','intermediate',4,ARRAY['mâchoire'],'Libérer la mâchoire','Free the jaw','Massez la mâchoire puis prononcez « ma-ba-la » ample. Réduit la tension.','Massage the jaw then say a rounded "ma-ba-la". Reduces tension.'),
  ('articulation-diction','articulation','advanced',6,ARRAY['diction'],'Diction pointue','Sharp diction','Enregistrez-vous en lisant un texte technique. Écoutez et repérez les fins de mots avalées.','Record yourself reading a technical text. Listen for swallowed word endings.'),
  ('confidence-elevator','confidence','beginner',5,ARRAY['pitch'],'Elevator pitch','Elevator pitch','Structure : accroche, ce que vous faites, pour qui, différence. 45 secondes max.','Structure: hook, what you do, for whom, difference. 45 seconds max.'),
  ('confidence-stage','confidence','intermediate',7,ARRAY['scène'],'Prendre la scène','Own the stage','Occupez l''espace, respirez, ancrez vos pieds, balayez la salle du regard. Trois respirations avant de commencer.','Own the space, breathe, ground your feet, sweep the room. Three breaths before starting.'),
  ('confidence-hard-q','confidence','advanced',6,ARRAY['questions'],'Encaisser une question piège','Handle a tough question','Répétez la question pour gagner du temps, structurez : « Point principal, exemple, conclusion ».','Repeat the question to buy time, structure: "Main point, example, close".'),
  ('confidence-body','confidence','beginner',4,ARRAY['posture'],'Posture d''ouverture','Open posture','Épaules basses, mains visibles, poids également réparti. Le corps ouvre la voix.','Shoulders down, hands visible, weight even. Body opens the voice.'),
  ('communication-listen','confidence','intermediate',5,ARRAY['écoute'],'Écoute active','Active listening','Reformulez ce que dit votre interlocuteur avant de répondre. Vous serez perçu plus posé et plus clair.','Rephrase what the other person says before answering. You will sound calmer and clearer.'),
  ('communication-story','confidence','advanced',8,ARRAY['storytelling'],'Raconter en 3 actes','3-act storytelling','Situation → complication → résolution. Toute anecdote pro peut suivre ce schéma.','Situation → complication → resolution. Any work anecdote fits this arc.'),
  ('breathing-morning','breathing','beginner',3,ARRAY['matin'],'Réveil vocal du matin','Morning vocal wake-up','10 respirations ventrales + 30s de vibration des lèvres. Prête pour la première réunion.','10 belly breaths + 30s of lip trills. Ready for the first meeting.'),
  ('articulation-tongue','articulation','intermediate',5,ARRAY['langue'],'Gym de la langue','Tongue gym','Touchez chaque coin de la bouche 10 fois avec la langue. Réactive la clarté.','Touch each corner of the mouth 10 times with the tongue. Restores clarity.')
ON CONFLICT (slug) DO NOTHING;


-- ===== 20260725084231_8bbf6eae-02c2-4186-9d11-b0fc5af27541.sql =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ===== 20260725084457_90ffd811-9007-4326-9ac8-e0481359c547.sql =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_prefs_updated jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ===== 20260725093405_b4a8ce1f-412b-41fe-ae5b-00dd6ad33fc6.sql =====

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_reminder_dow smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS weekly_reminder_hour_utc smallint NOT NULL DEFAULT 17,
  ADD COLUMN IF NOT EXISTS quiet_start_hour_utc smallint,
  ADD COLUMN IF NOT EXISTS quiet_end_hour_utc smallint,
  ADD COLUMN IF NOT EXISTS last_weekly_reminder_at timestamptz;


-- ===== 20260728154203_f5cf6194-ed69-4b28-a4be-4b657622f6f1.sql =====

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


-- ===== 20260729165542_241b1c51-8c47-4bee-be4e-6057ef5b42e5.sql =====
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

-- ===== 20260729170433_76ebed9e-f890-44e8-9f66-40be83c5e66f.sql =====
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

-- ===== 20260731221200_fe2a88c1-44d8-4420-9269-581f337c8829.sql =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_lang text NOT NULL DEFAULT 'fr' CHECK (ui_lang IN ('fr','en'));

-- ===== 20260731234927_69c98c19-5043-4a26-9738-e934ea5346e3.sql =====
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

-- ===== 20260803183330_376e3cb5-8c46-4158-bd7d-b651818b0c08.sql =====
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id text NOT NULL,
  session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL,
  step text,
  path text,
  lang text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX funnel_events_occurred_at_idx ON public.funnel_events (occurred_at DESC);
CREATE INDEX funnel_events_event_idx ON public.funnel_events (event);
CREATE INDEX funnel_events_anon_idx ON public.funnel_events (anon_id);

GRANT INSERT ON public.funnel_events TO anon;
GRANT INSERT ON public.funnel_events TO authenticated;
GRANT ALL ON public.funnel_events TO service_role;
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a funnel event" ON public.funnel_events FOR INSERT TO anon, authenticated WITH CHECK (
  length(anon_id) BETWEEN 8 AND 64
  AND length(session_id) BETWEEN 8 AND 64
  AND length(event) <= 64
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- ===== 20260803183356_005aaeb9-00bf-43c7-95df-237adf2f98fb.sql =====
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- ===== 20260803183823_87a6e92a-faa1-4335-9e88-3eb1627afd6d.sql =====
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'maximedewassonou@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- ===== 20260804062841_b405e745-3aae-4e99-8b72-c3b9d4992064.sql =====
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

-- ===== 20260818160016_6aa9a3ca-4975-4398-844b-4302307285ed.sql =====
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
