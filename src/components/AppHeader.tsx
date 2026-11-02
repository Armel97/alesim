import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { GitCompare, History, Languages, LineChart, Sun, LogIn, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader() {
  const { t } = useLang();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
      <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-ink text-primary-foreground">
          <span className="font-serif text-lg">A</span>
        </span>
        <span className="font-serif text-2xl tracking-tight text-foreground">ALESIM</span>
      </Link>
      <nav className="-mx-4 flex w-full items-center gap-1.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:w-auto sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0">
        <Link
          to="/today"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          activeProps={{ className: "bg-secondary text-foreground" }}
        >
          <Sun className="h-4 w-4" />
          {t.today}
        </Link>
        <Link
          to="/dashboard"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          activeProps={{ className: "bg-secondary text-foreground" }}
        >
          <LineChart className="h-4 w-4" />
          {t.dashboard}
        </Link>
        <Link
          to="/compare"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          activeProps={{ className: "bg-secondary text-foreground" }}
        >
          <GitCompare className="h-4 w-4" />
          {t.compare}
        </Link>
        <a
          href="#pricing"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Tag className="h-4 w-4" />
          {t.pricingNav}
        </a>
        <Link
          to="/practice"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          activeProps={{ className: "bg-secondary text-foreground" }}
        >
          <Languages className="h-4 w-4" />
          {t.practice}
        </Link>
        <Link
          to="/history"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          activeProps={{ className: "bg-secondary text-foreground" }}
        >
          <History className="h-4 w-4" />
          {t.history}
        </Link>
        {!signedIn && (
          <Link
            to="/auth"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm text-primary-foreground"
          >
            <LogIn className="h-4 w-4" />
            {t.signIn}
          </Link>
        )}
        <LanguageSwitcher className="ml-1 shrink-0 sm:ml-2" />
      </nav>
    </header>
  );
}
