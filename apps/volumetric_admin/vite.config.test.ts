import { describe, expect, test } from "vitest";
import { loadEnv } from "vite";

import viteConfig from "./vite.config";

describe("vite config", () => {
  test("should define generated canister process env keys for browser-only dependencies", () => {
    // given
    const mode = "development";
    const env = loadEnv(mode, process.cwd(), "");
    const EXPECTED_NODE_ENV_REPLACEMENT = JSON.stringify("development");
    const EXPECTED_DFX_NETWORK_REPLACEMENT = JSON.stringify(
      env.DFX_NETWORK ?? (mode === "production" ? "ic" : "local"),
    );

    // when
    const config =
      typeof viteConfig === "function"
        ? viteConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false })
        : viteConfig;
    const define = "define" in config ? config.define : undefined;

    // then
    expect(define?.["process.env.NODE_ENV"]).toBe(EXPECTED_NODE_ENV_REPLACEMENT);
    expect(define?.["process.env.DFX_NETWORK"]).toBe(EXPECTED_DFX_NETWORK_REPLACEMENT);
    expect(define).toHaveProperty("process.env.CANISTER_ID_VOLUMETRIC_DEV");
  });

  test("should shim global to globalThis so dfinity agent runs in the browser", () => {
    // given
    const EXPECTED_GLOBAL_REPLACEMENT = "globalThis";

    // when
    const config =
      typeof viteConfig === "function"
        ? viteConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false })
        : viteConfig;
    const define = "define" in config ? config.define : undefined;

    // then
    expect(define?.global).toBe(EXPECTED_GLOBAL_REPLACEMENT);
  });
});
