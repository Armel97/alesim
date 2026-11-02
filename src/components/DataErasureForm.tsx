import { useState } from "react";
import { AlertTriangle, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { anonId } from "@/lib/analytics";
import { useAuthSession } from "@/hooks/useAuthSession";
import { eraseAnalyticsTrail, eraseMyVoiceData } from "@/lib/erasure.functions";
import {
  eraseLocalAnalyticsData,
  eraseLocalAudioData,
  eraseLocalConsentLog,
} from "@/lib/local-erasure";
import { revokeAudioConsent } from "@/lib/audio-consent";

const CONFIRM_WORD = "SUPPRIMER";

type Report = { audio: string[]; analytics: string[] };

/** Formulaire d'effacement (art. 17 RGPD) : données audio et trace analytics. */
export function DataErasureForm() {
  const { signedIn } = useAuthSession();
  const [audio, setAudio] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const [withdraw, setWithdraw] = useState(true);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const nothingSelected = !audio && !analytics;
  const canSubmit = !busy && !nothingSelected && word.trim().toUpperCase() === CONFIRM_WORD;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const next: Report = { audio: [], analytics: [] };

    try {
      if (audio) {
        const local = eraseLocalAudioData();
        next.audio.push(`${local} élément(s) effacé(s) sur cet appareil`);
        if (signedIn) {
          const { counts } = await eraseMyVoiceData();
          next.audio.push(
            `Analyses vidéo : ${counts["video_sessions"] ?? 0} · Entretiens : ${
              counts["interview_responses"] ?? 0
            } · CV : ${counts["cv_analyses"] ?? 0} · Plans du coach : ${
              counts["weekly_coaching"] ?? 0
            }`,
          );
          next.audio.push(
            `Transcriptions de leçons anonymisées : ${counts["lesson_completions"] ?? 0}`,
          );
        } else {
          next.audio.push("Aucun compte connecté : rien à supprimer côté serveur");
        }
        if (withdraw) {
          revokeAudioConsent("erasure_form");
          eraseLocalConsentLog();
          next.audio.push("Consentement audio retiré et journal effacé");
        }
      }

      if (analytics) {
        const id = anonId();
        const { deleted } = await eraseAnalyticsTrail({ data: { anonId: id } });
        eraseLocalAnalyticsData();
        next.analytics.push(`${deleted} événement(s) de suivi supprimé(s) définitivement`);
        next.analytics.push("Identifiant de mesure d'audience réinitialisé sur cet appareil");
      }

      setReport(next);
      setWord("");
      toast.success("Suppression effectuée.");
    } catch (err) {
      console.error(err);
      toast.error("La suppression a échoué. Réessayez ou écrivez-nous.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="effacement" className="scroll-mt-6 rounded-2xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-serif text-2xl text-foreground">
        <Trash2 className="h-5 w-5 text-primary" />
        Demander l'effacement de mes données
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        La suppression est immédiate et définitive : elle s'applique à cet appareil et, si vous êtes
        connecté, à votre compte. Aucune sauvegarde ne permet de revenir en arrière.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Que souhaitez-vous effacer ?
          </legend>

          <Choice
            checked={audio}
            onChange={setAudio}
            title="Mes données audio et vocales"
            desc="Enregistrements analysés, transcriptions, feedbacks, analyses vidéo, entretiens et CV."
          />
          <Choice
            checked={analytics}
            onChange={setAnalytics}
            title="Mon historique de suivi analytics"
            desc="Tous les événements de parcours associés à cet appareil, puis réinitialisation de l'identifiant anonyme."
          />
          {audio ? (
            <Choice
              checked={withdraw}
              onChange={setWithdraw}
              title="Retirer aussi mon consentement audio"
              desc="Aucune nouvelle capture micro ne pourra démarrer sans un nouvel accord explicite."
            />
          ) : null}
        </fieldset>

        <div>
          <label htmlFor="erasure-confirm" className="text-sm font-medium text-foreground">
            Pour confirmer, saisissez « {CONFIRM_WORD} »
          </label>
          <input
            id="erasure-confirm"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            autoComplete="off"
            placeholder={CONFIRM_WORD}
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-4 text-sm outline-none focus:border-primary"
          />
        </div>

        {nothingSelected ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Sélectionnez au moins une catégorie de données.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-destructive px-5 text-sm font-medium text-destructive-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Supprimer définitivement
        </button>
      </form>

      {report ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"
        >
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Check className="h-4 w-4 text-primary" />
            Suppression confirmée
          </p>
          {report.audio.length ? (
            <>
              <p className="mt-3 font-medium text-foreground">Données audio et vocales</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground/80">
                {report.audio.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </>
          ) : null}
          {report.analytics.length ? (
            <>
              <p className="mt-3 font-medium text-foreground">Historique de suivi analytics</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground/80">
                {report.analytics.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="mt-3 text-muted-foreground">
            Une question sur cette suppression ? Écrivez-nous et nous confirmerons par écrit.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Choice({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border p-4 hover:border-foreground/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
      />
      <span>
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{desc}</span>
      </span>
    </label>
  );
}
