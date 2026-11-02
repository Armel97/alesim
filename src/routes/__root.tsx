import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LangProvider, useLang } from "@/lib/i18n";
import { Toaster } from "sonner";
import { CookieBanner } from "@/components/CookieBanner";
import { AudioConsentDialog } from "@/components/AudioConsentDialog";
import { initAnalytics } from "@/lib/analytics";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "ALESIM — Gagne en confiance et en clarté à l'oral" },
      {
        name: "description",
        content:
          "ALESIM t'accompagne pour progresser en communication orale et gagner en confiance, au travail comme au quotidien. Exercices vocaux guidés, feedback personnalisé et apprentissage des langues étrangères, le tout dans une app simple et bienveillante.",
      },
      { name: "author", content: "ALESIM" },
      { name: "theme-color", content: "#7fa08f" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "ALESIM" },
      { property: "og:title", content: "ALESIM" },
      {
        property: "og:description",
        content: "Gagne en confiance et en clarté à l'oral, pour un vrai impact au quotidien.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "ALESIM" },
      { property: "og:locale", content: "fr_FR" },
      { property: "og:locale:alternate", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ALESIM" },
      {
        name: "twitter:description",
        content: "Gagne en confiance et en clarté à l'oral, pour un vrai impact au quotidien.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/icon-alesim.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-alesim.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Nunito+Sans:wght@300;400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    initAnalytics();
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-push.js").catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <LocaleMetaSync />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster position="top-center" richColors closeButton />
        <CookieBanner />
        <AudioConsentDialog />
      </LangProvider>
    </QueryClientProvider>
  );
}

// Aligne les métadonnées sociales sur la langue réellement affichée (jamais sur navigator.language).
function LocaleMetaSync() {
  const { lang } = useLang();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const isEn = lang === "en";
    const description = isEn
      ? "ALESIM helps you improve your spoken communication and build lasting confidence, at work and in everyday life. Guided voice exercises, personalized feedback, and foreign language practice — all in one simple, supportive app."
      : "ALESIM t'accompagne pour progresser en communication orale et gagner en confiance, au travail comme au quotidien. Exercices vocaux guidés, feedback personnalisé et apprentissage des langues étrangères, le tout dans une app simple et bienveillante.";
    const social = isEn
      ? "Build confidence and clarity in speaking, for real everyday impact."
      : "Gagne en confiance et en clarté à l'oral, pour un vrai impact au quotidien.";
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", social);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", social);
    document
      .querySelector('meta[property="og:locale"]')
      ?.setAttribute("content", isEn ? "en_US" : "fr_FR");
    document
      .querySelector('meta[property="og:locale:alternate"]')
      ?.setAttribute("content", isEn ? "fr_FR" : "en_US");
  }, [lang]);

  return null;
}
