// Helpers hreflang / canonical pour la gestion multilingue d'ALESIM.
// L'interface existe en français (par défaut) et en anglais via ?hl=en.
export const SITE_URL = "https://alesimspeak.dev";

/** Balise BCP 47 complète à utiliser pour tout formatage (dates, nombres). */
export function localeTag(lang: string): string {
  return lang?.toLowerCase().startsWith("en") ? "en-US" : "fr-FR";
}

/** canonical + alternates pour une page bilingue (FR par défaut, EN via ?hl=en). */
export function bilingualLinks(path: string) {
  const url = `${SITE_URL}${path}`;
  return [
    { rel: "canonical", href: url },
    { rel: "alternate", hrefLang: "fr", href: url },
    { rel: "alternate", hrefLang: "en", href: `${url}${url.includes("?") ? "&" : "?"}hl=en` },
    { rel: "alternate", hrefLang: "x-default", href: url },
  ];
}

/** canonical + x-default pour une page disponible uniquement en français (pages légales). */
export function frenchOnlyLinks(path: string) {
  const url = `${SITE_URL}${path}`;
  return [
    { rel: "canonical", href: url },
    { rel: "alternate", hrefLang: "fr", href: url },
    { rel: "alternate", hrefLang: "x-default", href: url },
  ];
}
