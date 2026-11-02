#!/usr/bin/env node
/**
 * Garde-fou de marque ALESIM.
 * Vérifie qu'aucune référence à Lovable n'apparaît :
 *  1. dans les métadonnées head()/Open Graph déclarées dans src/routes
 *  2. dans les fichiers statiques exposés (manifest, robots, sitemap)
 *  3. dans le <head> réellement rendu (si une URL est joignable)
 *
 * Usage : node scripts/check-head-branding.mjs [--url http://localhost:8080]
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const FORBIDDEN = /lovable/i;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/** Routes publiques dont le <head> doit être vérifié en rendu réel. */
export const PUBLIC_PATHS = [
  "/",
  "/auth",
  "/history",
  "/practice",
  "/legal",
  "/legal/confidentialite",
  "/legal/cgu",
  "/legal/cookies",
  "/legal/mentions-legales",
];

/** Chaînes de métadonnées d'un fichier de route : title/description/og:*/
export function extractMetaStrings(source) {
  const found = [];
  const re = /\b(?:title|content|href|name|property|rel)\s*:\s*(["'`])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(source)) !== null) found.push(m[2]);
  // template literals interpolés (ex: `${BASE}/about`)
  const tpl = /\b(?:title|content|href)\s*:\s*`([\s\S]*?)`/g;
  while ((m = tpl.exec(source)) !== null) found.push(m[1]);
  return found;
}

async function listRouteFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listRouteFiles(full)));
    else if (/\.(tsx?|ts)$/.test(entry.name) && !entry.name.endsWith(".gen.ts")) out.push(full);
  }
  return out;
}

/** Analyse statique des sources : renvoie la liste des violations. */
export async function checkSources() {
  const violations = [];

  for (const file of await listRouteFiles(path.join(ROOT, "src/routes"))) {
    const source = await readFile(file, "utf8");
    if (!/head\s*:/.test(source) && !FORBIDDEN.test(source)) continue;
    for (const value of extractMetaStrings(source)) {
      if (FORBIDDEN.test(value)) {
        violations.push(`${path.relative(ROOT, file)} → métadonnée "${value}"`);
      }
    }
  }

  for (const rel of ["public/manifest.webmanifest", "public/robots.txt", "public/sitemap.xml"]) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) continue;
    const source = await readFile(full, "utf8");
    if (FORBIDDEN.test(source)) violations.push(`${rel} → contient "Lovable"`);
  }

  return violations;
}

/** Extrait le <head> d'un document HTML. */
export function extractHead(html) {
  const m = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  return m ? m[1] : "";
}

/** Vérifie le <head> rendu de chaque route publique sur une base URL. */
export async function checkRendered(baseUrl, paths = PUBLIC_PATHS) {
  const violations = [];
  for (const p of paths) {
    const url = new URL(p, baseUrl).toString();
    let html;
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "facebookexternalhit/1.1" },
      });
      html = await res.text();
    } catch (err) {
      violations.push(`${url} → injoignable (${err.message})`);
      continue;
    }
    const head = extractHead(html);
    for (const line of head.split(/>\s*</)) {
      if (/<?(meta|title|link)/i.test(`<${line}`) && FORBIDDEN.test(line)) {
        violations.push(`${url} → balise head "<${line.trim()}>"`);
      }
    }
  }
  return violations;
}

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const argUrl = process.argv.includes("--url")
    ? process.argv[process.argv.indexOf("--url") + 1]
    : process.env.BRANDING_CHECK_URL;
  const violations = await checkSources();

  const baseUrl = argUrl || "http://localhost:8080";
  if (await reachable(baseUrl)) {
    violations.push(...(await checkRendered(baseUrl)));
  } else if (argUrl) {
    violations.push(`${baseUrl} → injoignable, vérification du rendu impossible`);
  } else {
    console.log(`ℹ️  Aucun serveur sur ${baseUrl} : vérification statique uniquement.`);
  }

  if (violations.length) {
    console.error("\n❌ Références à Lovable détectées dans les métadonnées :");
    for (const v of violations) console.error(`   • ${v}`);
    console.error("\nPublication bloquée. Corrige les balises head/Open Graph.\n");
    process.exit(1);
  }
  console.log("✅ Aucune référence à Lovable dans les balises head / Open Graph.");
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main();
}
