import { describe, expect, it, beforeAll } from "vitest";
import {
  FORBIDDEN,
  PUBLIC_PATHS,
  checkSources,
  checkRendered,
  extractHead,
  extractMetaStrings,
} from "../../scripts/check-head-branding.mjs";

const BASE_URL = process.env.BRANDING_CHECK_URL ?? "http://localhost:8080";

async function serverUp() {
  try {
    return (await fetch(BASE_URL, { signal: AbortSignal.timeout(4000) })).ok;
  } catch {
    return false;
  }
}

describe("branding: aucune référence à Lovable dans le head / Open Graph", () => {
  it("détecte une métadonnée fautive (sanity check du détecteur)", () => {
    const values = extractMetaStrings(
      `head: () => ({ meta: [{ property: "og:site_name", content: "Lovable" }] })`,
    );
    expect(values.some((v: string) => FORBIDDEN.test(v))).toBe(true);
    expect(FORBIDDEN.test(extractHead("<html><head><meta content='lovable'></head></html>"))).toBe(
      true,
    );
  });

  it("les métadonnées déclarées dans les routes et fichiers statiques sont propres", async () => {
    const violations = await checkSources();
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("le <head> rendu de chaque route publique est propre", async () => {
    if (!(await serverUp())) {
      console.warn(`Serveur ${BASE_URL} injoignable — test de rendu ignoré.`);
      return;
    }
    const violations = await checkRendered(BASE_URL, PUBLIC_PATHS);
    expect(violations, violations.join("\n")).toEqual([]);
  }, 60000);
});
