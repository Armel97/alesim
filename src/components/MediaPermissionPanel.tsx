import { useState } from "react";
import { ExternalLink, Info, RefreshCw, ShieldCheck, Copy, Check } from "lucide-react";
import { useLang } from "@/lib/i18n";
import {
  permissionCopy,
  settingsUrl,
  type MediaKind,
  type MediaPermissionError,
} from "@/lib/media-permissions";

/**
 * Explains why mic/camera access failed, offers a retry and — when the browser
 * allows it — a shortcut to the permission settings, otherwise written steps.
 */
export function MediaPermissionPanel({
  error,
  onRetry,
  retrying,
}: {
  error: MediaPermissionError;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const { lang } = useLang();
  const fr = lang === "fr";
  const copy = permissionCopy(error, lang);
  const url = error.issue === "denied" ? settingsUrl() : null;
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="alert"
      className="w-full rounded-3xl border border-accent/30 bg-accent/10 p-5 text-left"
    >
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0">
          <h3 className="font-serif text-lg text-foreground">{copy.title}</h3>
          <p className="mt-1 text-sm text-foreground/80">{copy.body}</p>
        </div>
      </div>

      {copy.steps.length > 0 && (
        <ol className="mt-4 space-y-2 pl-1 text-sm text-foreground/80">
          {copy.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} aria-hidden />
          {fr ? "Réessayer" : "Retry"}
        </button>

        {url && (
          <button
            type="button"
            onClick={copyUrl}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copied
              ? fr
                ? "Adresse copiée"
                : "Address copied"
              : fr
                ? "Copier le lien des réglages"
                : "Copy settings link"}
          </button>
        )}

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-foreground/70 underline-offset-4 hover:underline"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          {fr ? "Recharger la page" : "Reload the page"}
        </button>
      </div>

      <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        {fr
          ? "Ton flux audio/vidéo reste sur ton appareil pendant l'analyse posture/regard ; seul l'audio nécessaire à la transcription est envoyé."
          : "Your audio/video stream stays on your device for posture/gaze analysis; only the audio needed for transcription is sent."}
      </p>

      {url && (
        <p className="mt-2 text-xs text-muted-foreground">
          {fr
            ? "Colle cette adresse dans un nouvel onglet : "
            : "Paste this address in a new tab: "}
          <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{url}</code>
        </p>
      )}
    </div>
  );
}

export function permissionKindFor(withVideo: boolean): MediaKind {
  return withVideo ? "both" : "mic";
}
