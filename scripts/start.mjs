// Démarreur de production : affiche un diagnostic et toute erreur fatale sur la
// sortie standard (certains hébergeurs, dont GoDaddy, n'affichent pas stderr).
const log = (...a) => console.log("[ALESIM]", ...a);

process.on("uncaughtException", (e) => {
  log("Erreur fatale :", e?.stack || e);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  log("Promesse rejetée :", e?.stack || e);
  process.exit(1);
});

const major = Number(process.versions.node.split(".")[0]);
log(`Node ${process.version} | PORT=${process.env.PORT ?? "(non défini)"} | HOST=${process.env.HOST ?? "(non défini)"}`);
if (major < 20) log("ATTENTION : Node 20 minimum requis, choisissez Node 22 dans l'hébergeur.");

const required = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "AI_BASE_URL",
  "AI_API_KEY",
  "LOVABLE_API_KEY",
];
const missing = required.filter((k) => !process.env[k]);
log("Variables d'environnement manquantes :", missing.length ? missing.join(", ") : "aucune");

// La version Cloudflare (npm run build) ne démarre pas de serveur sous Node :
// si .output n'est pas une version "node-server", on la reconstruit.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
let preset = null;
try {
  preset = JSON.parse(readFileSync(new URL("../.output/nitro.json", import.meta.url), "utf8")).preset;
} catch {}
const entry = new URL("../.output/server/index.mjs", import.meta.url);

// Les variables VITE_* sont intégrées au moment de la compilation : si elles ont
// changé depuis le dernier build (ou si on ne sait pas), on recompile.
const stamp = new URL("../.output/alesim-build-env.json", import.meta.url);
// Empreinte du code source : si le code a changé depuis la dernière compilation
// (nouveau déploiement avec un ancien .output conservé), on recompile aussi.
function sourceHash() {
  const h = createHash("sha256");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else h.update(relative(root, full)).update(readFileSync(full));
    }
  };
  for (const item of ["src", "public"]) if (existsSync(join(root, item))) walk(join(root, item));
  for (const f of ["package.json", "package-lock.json", "vite.config.ts"])
    if (existsSync(join(root, f))) h.update(f).update(readFileSync(join(root, f)));
  return h.digest("hex");
}

const viteEnv = JSON.stringify({
  env: Object.fromEntries(
    Object.keys(process.env)
      .filter((k) => k.startsWith("VITE_"))
      .sort()
      .map((k) => [k, process.env[k]]),
  ),
  source: sourceHash(),
});
let builtEnv = null;
try {
  builtEnv = readFileSync(stamp, "utf8");
} catch {}

let reason = null;
if (preset !== "node-server" || !existsSync(entry)) reason = `version ${preset ?? "absente"}`;
else if (builtEnv !== viteEnv) reason = "code ou variables VITE_* modifiés depuis la dernière compilation";

if (reason) {
  log(`Recompilation nécessaire (${reason}) : compilation Node.js en cours...`);
  try {
    execSync("npm run build:node", { stdio: "inherit", env: { ...process.env, NITRO_PRESET: "node-server" } });
    writeFileSync(stamp, viteEnv);
  } catch (e) {
    log("La compilation a échoué :", e?.message || e);
    process.exit(1);
  }
}

try {
  await import("../.output/server/index.mjs");
} catch (e) {
  log("Échec du démarrage :", e?.stack || e);
  process.exit(1);
}
