import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const canisterId = env.CANISTER_ID_VOLUMETRIC_DEV ?? env.VITE_CANISTER_ID ?? "";
  const dfxNetwork = env.DFX_NETWORK ?? (mode === "production" ? "ic" : "local");

  return {
    define: {
      global: "globalThis",
      "process.env.CANISTER_ID_VOLUMETRIC_DEV": JSON.stringify(canisterId),
      "process.env.DFX_NETWORK": JSON.stringify(dfxNetwork),
      "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
    },
    plugins: [tailwindcss(), react()],
  };
});
