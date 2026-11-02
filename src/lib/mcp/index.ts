import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProgress from "./tools/get-progress";
import listPracticeSessions from "./tools/list-practice-sessions";
import listCvAnalyses from "./tools/list-cv-analyses";
import listVideoSessions from "./tools/list-video-sessions";
import listBadges from "./tools/list-badges";
import listLessons from "./tools/list-lessons";

// L'émetteur OAuth doit rester l'hôte Supabase direct (RFC 8414) : seul le project ref
// survit à la publication, et Vite l'inline littéralement au build.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "alesim",
  title: "ALESIM",
  version: "0.1.0",
  instructions:
    "Tools for ALESIM, a warm voice-and-confidence coaching app. Read the signed-in user's speaking progress, practice sessions, résumé analyses, video coaching sessions and badges, and browse the lesson catalogue. All data is scoped to the authenticated user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getProgress,
    listPracticeSessions,
    listCvAnalyses,
    listVideoSessions,
    listBadges,
    listLessons,
  ],
});