#!/usr/bin/env bash
# finalize-before-github.sh
# Verifications avant push GitHub : stack, .gitignore, fichiers indesirables,
# secrets suivis par git, cles API dans le code.
# Options :
#   --check    mode lecture seule (aucune modification, aucun git add) -> utilise en CI
#   --report <fichier>  ecrit un rapport Markdown
set -uo pipefail

CHECK_ONLY=0
REPORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY=1 ;;
    --report) REPORT="${2:-}"; shift ;;
    *) echo "Option inconnue: $1" >&2; exit 2 ;;
  esac
  shift
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAILURES=0
WARNINGS=0
LINES=()

add() { LINES+=("$1"); echo -e "$1"; }
ok()   { add "- ✅ $1"; }
warn() { WARNINGS=$((WARNINGS+1)); add "- ⚠️ $1"; }
fail() { FAILURES=$((FAILURES+1)); add "- ❌ $1"; }

add "## Rapport finalize-before-github"
add ""
add "### 1. Stack détectée"
STACK="inconnue"
if [ -f package.json ]; then
  if grep -q '"@tanstack/react-start"' package.json; then STACK="TanStack Start (React + Vite)"
  elif grep -q '"next"' package.json; then STACK="Next.js"
  elif grep -q '"vite"' package.json; then STACK="Vite"
  else STACK="Node.js"; fi
fi
add "- Stack : **$STACK**"
add ""

add "### 2. .gitignore"
REQUIRED=("node_modules" "dist" ".output" ".nitro" ".vinxi" ".DS_Store" "*.log")
MISSING=()
if [ ! -f .gitignore ]; then
  fail ".gitignore absent"
else
  for pat in "${REQUIRED[@]}"; do
    grep -qxF "$pat" .gitignore || MISSING+=("$pat")
  done
  if [ ${#MISSING[@]} -eq 0 ]; then
    ok "Toutes les entrées attendues sont présentes"
  else
    warn "Entrées manquantes : \`${MISSING[*]}\`"
  fi
fi
add ""

add "### 3. Fichiers indésirables suivis par git"
JUNK=$(git ls-files | grep -E '(^|/)(\.DS_Store|Thumbs\.db|npm-debug\.log|yarn-error\.log)$|\.(log|tmp|swp)$' || true)
if [ -n "$JUNK" ]; then
  fail "Fichiers à retirer du suivi :"
  while IFS= read -r f; do add "  - \`$f\`"; done <<< "$JUNK"
else
  ok "Aucun fichier temporaire suivi"
fi
add ""

add "### 4. Secrets suivis par git"
TRACKED_ENV=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' || true)
if [ -n "$TRACKED_ENV" ]; then
  warn "Fichiers d'environnement suivis (vérifier qu'ils ne contiennent que des clés publiques) :"
  while IFS= read -r f; do add "  - \`$f\`"; done <<< "$TRACKED_ENV"
else
  ok "Aucun fichier .env suivi par git"
fi
add ""

add "### 5. Clés API potentielles dans le code"
PATTERNS='sk_live_[0-9a-zA-Z]{10,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{30,}|ghp_[0-9A-Za-z]{20,}|xox[baprs]-[0-9A-Za-z-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|SUPABASE_SERVICE_ROLE_KEY\\s*[:=]\\s*['\"][^'\"]+'
HITS=$(git ls-files -- 'src/**' 'scripts/**' 'supabase/**' 'public/**' 2>/dev/null \
  | xargs -r grep -nEI "$PATTERNS" 2>/dev/null \
  | grep -v 'sb_publishable_' || true)
if [ -n "$HITS" ]; then
  fail "Occurrences à vérifier :"
  while IFS= read -r l; do add "  - \`${l:0:160}\`"; done <<< "$HITS"
else
  ok "Aucune clé sensible détectée"
fi
add ""

add "### 6. Préparation du commit"
if [ "$CHECK_ONLY" -eq 1 ]; then
  add "- Mode \`--check\` : aucune modification effectuée."
else
  CHANGES=$(git status --porcelain | wc -l | tr -d ' ')
  add "- Changements en attente : $CHANGES fichier(s)"
  add "- Étapes manuelles : \`git add .\` puis \`git commit\` et \`git push\`."
fi
add ""

add "### Résumé"
add "- Échecs : **$FAILURES** — Avertissements : **$WARNINGS**"

if [ -n "$REPORT" ]; then
  printf '%s\n' "${LINES[@]}" | sed -E 's/\x1b\[[0-9;]*m//g' > "$REPORT"
fi

[ "$FAILURES" -eq 0 ] || exit 1
