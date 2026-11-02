import type { CapacitorConfig } from "@capacitor/cli";

// ALESIM relies on TanStack Start SSR + server functions (Supabase, AI, auth), so this
// is a native shell that loads the running web app over the network rather than a fully
// bundled offline app. `server.url` points at the local dev server's LAN address so it
// works on a phone connected to the same Wi-Fi as this machine.
// `cleartext: true` is required because the dev server is plain HTTP, not HTTPS.
const config: CapacitorConfig = {
  appId: "app.alesim.mobile",
  appName: "ALESIM",
  webDir: "www",
  server: {
    url: "http://192.168.1.102:8085",
    cleartext: true,
  },
};

export default config;
