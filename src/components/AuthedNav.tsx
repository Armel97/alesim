import { Link, useNavigate } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import {
  Flame,
  LogOut,
  Home,
  Compass,
  User,
  Sparkles,
  Video,
  FileText,
  Settings,
  Briefcase,
} from "lucide-react";

export function AuthedNav({ streak }: { streak?: number }) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6">
      <Link to="/" className="font-serif text-2xl">
        ALESIM
      </Link>
      <nav className="flex items-center gap-2 md:gap-4 text-sm">
        <Link
          to="/today"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          activeProps={{
            className: "inline-flex items-center gap-1.5 text-foreground font-medium",
          }}
        >
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">{t.today}</span>
        </Link>
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          activeProps={{
            className: "inline-flex items-center gap-1.5 text-foreground font-medium",
          }}
        >
          <Compass className="h-4 w-4" />
          <span className="hidden sm:inline">{t.explore}</span>
        </Link>
        <Link
          to="/coach"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          activeProps={{
            className: "inline-flex items-center gap-1.5 text-foreground font-medium",
          }}
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">{t.coach}</span>
        </Link>
        <Link
          to="/video"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          activeProps={{
            className: "inline-flex items-center gap-1.5 text-foreground font-medium",
          }}
        >
          <Video className="h-4 w-4" />
          <span className="hidden sm:inline">{t.video}</span>
        </Link>
        <Link
          to="/interview"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          activeProps={{
            className: "inline-flex items-center gap-1.5 text-foreground font-medium",
          }}
        >
          <Briefcase className="h-4 w-4" />
          <span className="hidden sm:inline">{lang === "fr" ? "Entretien" : "Interview"}</span>
        </Link>
        <Link
          to="/cv"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          activeProps={{
            className: "inline-flex items-center gap-1.5 text-foreground font-medium",
          }}
        >
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">{t.cv}</span>
        </Link>
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          activeProps={{
            className: "inline-flex items-center gap-1.5 text-foreground font-medium",
          }}
        >
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{t.profile}</span>
        </Link>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          activeProps={{
            className: "inline-flex items-center gap-1.5 text-foreground font-medium",
          }}
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">{t.settings}</span>
        </Link>
        {typeof streak === "number" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs">
            <Flame className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{streak}</span>
          </span>
        )}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          aria-label={t.signOut}
        >
          <LogOut className="h-4 w-4" />
        </button>
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
