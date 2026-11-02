import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Question complete (serveur uniquement) : contient la bonne reponse. */
type StoredQuizQuestion = {
  q_fr: string;
  q_en: string;
  options_fr: string[];
  options_en: string[];
  answer: number;
  exp_fr: string;
  exp_en: string;
};

/** Question envoyee au client : sans la bonne reponse ni l'explication. */
export type QuizQuestion = {
  q_fr: string;
  q_en: string;
  options_fr: string[];
  options_en: string[];
};

async function loadQuestions(lessonId: string): Promise<StoredQuizQuestion[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("quizzes")
    .select("questions")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (row?.questions as unknown as StoredQuizQuestion[]) ?? [];
}

export const getQuizForLesson = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => z.object({ lessonId: z.string().uuid() }).parse(v))
  .handler(async ({ data }): Promise<QuizQuestion[]> => {
    const questions = await loadQuestions(data.lessonId);
    // La bonne reponse et l'explication ne quittent jamais le serveur avant la validation.
    return questions.map((q) => ({
      q_fr: q.q_fr,
      q_en: q.q_en,
      options_fr: q.options_fr,
      options_en: q.options_en,
    }));
  });

export type QuizCheckResult = {
  correct: boolean;
  answer: number;
  exp_fr: string;
  exp_en: string;
};

/** Valide une reponse cote serveur et revele alors seulement la solution. */
export const checkQuizAnswer = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) =>
    z
      .object({
        lessonId: z.string().uuid(),
        questionIndex: z.number().int().min(0).max(200),
        choice: z.number().int().min(0).max(50),
      })
      .parse(v),
  )
  .handler(async ({ data }): Promise<QuizCheckResult> => {
    const questions = await loadQuestions(data.lessonId);
    const q = questions[data.questionIndex];
    if (!q) throw new Error("Question introuvable");
    return {
      correct: data.choice === q.answer,
      answer: q.answer,
      exp_fr: q.exp_fr,
      exp_en: q.exp_en,
    };
  });
