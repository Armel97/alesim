# ALESIM

Coach vocal assisté par IA pour progresser en communication orale : clarté, débit,
gestion des hésitations et confiance en soi, en contexte professionnel et personnel.

## Modules

- **Audio** — enregistrement, transcription, analyse du débit / des hésitations, plan d'entraînement.
- **Leçons quotidiennes** — parcours guidé, quiz, badges et séries (streaks).
- **Explorer** — bibliothèque de contenus (respiration, articulation, confiance) avec recommandations.
- **Prononciation** — entraînement en langue étrangère avec correction phonétique et progression par niveaux.
- **Vidéo** — analyse locale de la posture, du regard et de l'éloquence face caméra.
- **Simulation d'entretien** — questions générées, analyse de la structure STAR.
- **Analyse de CV** — extraction PDF / DOCX / OCR et évaluation par l'IA.
- **Coach hebdomadaire** — synthèse des dernières sessions et plan personnalisé.

## Stack

- TanStack Start (React 19, SSR) + Vite
- TypeScript
- Tailwind CSS v4
- Supabase (base de données, authentification, RLS)

## Développement

Prérequis : Node.js et un gestionnaire de paquets (npm ou bun).

```sh
git clone <url-du-depot>
cd alesim
npm install
npm run dev
```

## Scripts

| Commande                | Rôle                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `npm run dev`           | Serveur de développement                                     |
| `npm run build`         | Build de production (contrôle de marque exécuté en amont)    |
| `npm run lint`          | ESLint + Prettier                                            |
| `npm run test`          | Tests Vitest                                                 |
| `npm run check:branding`| Vérifie l'absence de marque tierce dans le `<head>` / Open Graph |

## Variables d'environnement

Aucun secret n'est présent dans le code. Les valeurs sensibles sont injectées au
runtime côté serveur : `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY` (passerelle IA),
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
Côté navigateur, seules les clés publiques `VITE_SUPABASE_URL` et
`VITE_SUPABASE_PUBLISHABLE_KEY` sont exposées.

## Conformité

Consentement audio explicite avant toute capture, mesure d'audience soumise au
consentement, pages légales (CGU, confidentialité, cookies, mentions légales, RGPD)
et formulaire d'effacement des données.
