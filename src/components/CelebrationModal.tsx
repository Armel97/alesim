import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { Award } from "lucide-react";
import type { UnlockedBadge } from "@/lib/badges.server";

export function CelebrationModal({
  badges,
  onClose,
}: {
  badges: UnlockedBadge[];
  onClose: () => void;
}) {
  const { lang, t } = useLang();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (badges.length) setVisible(true);
  }, [badges]);
  if (!badges.length || !visible) return null;
  const b = badges[0];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in">
      <div className="max-w-sm w-full rounded-2xl bg-card p-6 text-center animate-scale-in shadow-2xl relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="absolute h-2 w-2 rounded-full bg-primary/70 animate-fade-in"
              style={{
                left: `${(i * 6.25) % 100}%`,
                top: `${(i * 13) % 100}%`,
                animationDelay: `${i * 40}ms`,
              }}
            />
          ))}
        </div>
        <div className="relative">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Award className="h-8 w-8" />
          </div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t.badgeUnlocked}
          </p>
          <h3 className="mt-1 font-serif text-2xl">{lang === "fr" ? b.title_fr : b.title_en}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === "fr" ? b.desc_fr : b.desc_en}
          </p>
          {badges.length > 1 && (
            <p className="mt-3 text-xs text-muted-foreground">
              +{badges.length - 1} {t.moreBadges}
            </p>
          )}
          <button
            onClick={() => {
              setVisible(false);
              onClose();
            }}
            className="mt-6 rounded-full bg-primary px-6 py-2 text-sm text-primary-foreground"
          >
            {t.continue}
          </button>
        </div>
      </div>
    </div>
  );
}
