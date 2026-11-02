
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
