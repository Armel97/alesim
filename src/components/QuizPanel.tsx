import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import {
  checkQuizAnswer,
  getQuizForLesson,
  type QuizCheckResult,
  type QuizQuestion,
} from "@/lib/quizzes.functions";
import { Check, X } from "lucide-react";

export function QuizPanel({
  lessonId,
  onDone,
  onSkip,
}: {
  lessonId: string;
  onDone: (score: number, total: number) => void;
  onSkip: () => void;
}) {
  const { t, lang } = useLang();
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<QuizCheckResult | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    (async () => {
      const qs = await getQuizForLesson({ data: { lessonId } });
      setQuestions(qs);
      if (!qs.length) onSkip();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  if (!questions) return null;
  if (!questions.length) return null;

  if (finished) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.quizScore}</p>
        <p className="mt-3 font-serif text-5xl">
          {score}
          <span className="text-muted-foreground text-2xl"> / {questions.length}</span>
        </p>
        {score === questions.length && <p className="mt-3 text-primary text-sm">{t.quizPerfect}</p>}
      </div>
    );
  }

  const q = questions[i];
  const opts = lang === "fr" ? q.options_fr : q.options_en;
  const stem = lang === "fr" ? q.q_fr : q.q_en;
  const exp = result ? (lang === "fr" ? result.exp_fr : result.exp_en) : "";
  const isRight = result?.correct === true;

  return (
    <div className="rounded-2xl border bg-card p-6 md:p-8">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t.question} {i + 1} {t.of} {questions.length}
        </span>
        <button onClick={onSkip} className="hover:text-foreground">
          {t.skipQuiz}
        </button>
      </div>
      <h3 className="mt-3 font-serif text-xl">{stem}</h3>
      <div className="mt-5 space-y-2">
        {opts.map((o, idx) => {
          const isChosen = selected === idx;
          const isAnswer = result != null && idx === result.answer;
          const state =
            selected === null
              ? "border bg-background hover:bg-secondary"
              : isAnswer
                ? "border-primary bg-primary/10"
                : isChosen
                  ? "border-destructive bg-destructive/10"
                  : "border bg-background opacity-60";
          return (
            <button
              key={idx}
              disabled={selected !== null}
              onClick={async () => {
                setSelected(idx);
                const check = await checkQuizAnswer({
                  data: { lessonId, questionIndex: i, choice: idx },
                });
                setResult(check);
                if (check.correct) setScore((s) => s + 1);
              }}
              className={`w-full rounded-xl px-4 py-3 text-left text-sm transition ${state}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {result !== null && (
        <div className="mt-4 rounded-xl bg-secondary p-4 text-sm">
          <p
            className={`flex items-center gap-2 font-medium ${
              isRight ? "text-primary" : "text-destructive"
            }`}
          >
            {isRight ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {isRight ? t.correct : t.incorrect}
          </p>
          <p className="mt-2 text-muted-foreground">{exp}</p>
          <button
            onClick={() => {
              if (i + 1 >= questions.length) {
                setFinished(true);
                onDone(score, questions.length);
              } else {
                setI(i + 1);
                setSelected(null);
                setResult(null);
              }
            }}
            className="mt-4 rounded-full bg-primary px-6 py-2 text-sm text-primary-foreground"
          >
            {i + 1 >= questions.length ? t.finishQuiz : t.nextQuestion}
          </button>
        </div>
      )}
    </div>
  );
}
