// Configuration centrale du fournisseur d'IA.
// Tout fournisseur compatible avec l'API OpenAI fonctionne (Groq, OpenAI, OpenRouter, Ollama...).
// Sans AI_BASE_URL, on retombe sur la passerelle Lovable d'origine.
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1";

export function aiBaseUrl(): string {
  return (process.env.AI_BASE_URL || LOVABLE_GATEWAY).replace(/\/+$/, "");
}

export function aiApiKey(): string {
  const key = process.env.AI_BASE_URL
    ? process.env.AI_API_KEY
    : process.env.AI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing AI_API_KEY (voir le fichier .env)");
  return key;
}

const usingLovable = () => !process.env.AI_BASE_URL;

export function aiChatModel(lovableDefault = "google/gemini-3.6-flash"): string {
  return process.env.AI_CHAT_MODEL || (usingLovable() ? lovableDefault : "openai/gpt-oss-120b");
}

export function aiTranscribeModel(): string {
  return (
    process.env.AI_TRANSCRIBE_MODEL ||
    (usingLovable() ? "openai/whisper-1" : "whisper-large-v3-turbo")
  );
}
