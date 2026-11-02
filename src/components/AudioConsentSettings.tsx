import { useEffect, useState } from "react";
import { Mic, MicOff, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import {
  AUDIO_CONSENT_EVENT,
  clearAudioConsentLog,
  downloadAudioConsentLog,
  readAudioConsent,
  readAudioConsentLog,
  revokeAudioConsent,
  setAudioConsent,
  type AudioConsentLogEntry,
  type AudioConsentRecord,
} from "@/lib/audio-consent";

const ACTION_FR: Record<string, string> = {
  granted: "Consentement donné",
  refused: "Consentement refusé",
  revoked: "Consentement retiré",
  expired: "Consentement expiré",
  capture_started: "Capture micro démarrée",
  capture_blocked: "Capture bloquée (pas de consentement)",
  prompt_shown: "Demande de consentement affichée",
};
const ACTION_EN: Record<string, string> = {
  granted: "Consent given",
  refused: "Consent declined",
  revoked: "Consent withdrawn",
  expired: "Consent expired",
  capture_started: "Microphone capture started",
  capture_blocked: "Capture blocked (no consent)",
  prompt_shown: "Consent prompt shown",
};

/** Gestion du consentement audio : état, retrait, journal local. */
export function AudioConsentSettings() {
  const { lang } = useLang();
  const fr = lang !== "en";
  const [record, setRecord] = useState<AudioConsentRecord | null>(null);
  const [log, setLog] = useState<AudioConsentLogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);

  const refresh = () => {
    setRecord(readAudioConsent());
    setLog(readAudioConsentLog().slice().reverse());
  };

  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener(AUDIO_CONSENT_EVENT, on);
    return () => window.removeEventListener(AUDIO_CONSENT_EVENT, on);
  }, []);

  const status = record?.decision === "granted";
  const labels = fr ? ACTION_FR : ACTION_EN;

  return (
    <section className="mt-10 rounded-2xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-serif text-2xl">
        {status ? (
          <Mic className="h-5 w-5 text-primary" />
        ) : (
          <MicOff className="h-5 w-5 text-primary" />
        )}
        {fr ? "Consentement audio" : "Audio consent"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {fr
          ? "Votre accord explicite est requis avant toute capture ou analyse de votre voix. Vous pouvez le retirer à tout moment."
          : "Your explicit consent is required before any voice capture or analysis. You can withdraw it at any time."}
      </p>

      <p className="mt-3 text-sm">
        <span className="font-medium text-foreground">
          {fr ? "État actuel : " : "Current status: "}
        </span>
        <span className="text-muted-foreground">
          {status
            ? fr
              ? `Autorisé le ${new Date(record.date).toLocaleDateString("fr-FR")}`
              : `Allowed on ${new Date(record.date).toLocaleDateString("en-GB")}`
            : record?.decision === "refused"
              ? fr
                ? "Refusé — aucune capture possible"
                : "Declined — no capture possible"
              : fr
                ? "Aucun consentement enregistré"
                : "No consent recorded"}
        </span>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {status ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              revokeAudioConsent("profile");
              toast.success(fr ? "Consentement retiré." : "Consent withdrawn.");
            }}
          >
            {fr ? "Retirer mon consentement" : "Withdraw consent"}
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={() => {
              setAudioConsent("granted", "profile");
              toast.success(fr ? "Micro autorisé." : "Microphone allowed.");
            }}
          >
            {fr ? "Autoriser l'analyse vocale" : "Allow voice analysis"}
          </button>
        )}
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setShowLog((v) => !v)}
        >
          {showLog ? (fr ? "Masquer le journal" : "Hide log") : fr ? "Voir le journal" : "View log"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => downloadAudioConsentLog()}
        >
          <Download className="h-4 w-4" />
          {fr ? "Exporter" : "Export"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => {
            clearAudioConsentLog();
            refresh();
            toast.success(fr ? "Journal effacé." : "Log cleared.");
          }}
        >
          <Trash2 className="h-4 w-4" />
          {fr ? "Effacer le journal" : "Clear log"}
        </button>
      </div>

      {showLog && (
        <ul className="mt-4 max-h-64 space-y-1.5 overflow-y-auto rounded-xl bg-secondary/50 p-3 text-xs">
          {log.length === 0 && (
            <li className="text-muted-foreground">{fr ? "Journal vide." : "Empty log."}</li>
          )}
          {log.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex flex-wrap justify-between gap-2">
              <span className="text-foreground/80">
                {labels[e.action] ?? e.action}
                <span className="ml-1 text-muted-foreground">· {e.context}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {new Date(e.at).toLocaleString(fr ? "fr-FR" : "en-GB")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {fr
          ? "Ce journal est conservé uniquement sur cet appareil et n'est jamais transmis à nos serveurs."
          : "This log is stored on this device only and never sent to our servers."}
      </p>
    </section>
  );
}
