"use client";

import { useCallback, useEffect } from "react";

const CHATWOOT_BASE_URL = "https://app.chatwoot.com";
const CHATWOOT_WEBSITE_TOKEN = process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN ?? "";
const CHATWOOT_READY_TIMEOUT_MS = 3000;
const CHATWOOT_SCRIPT_ID = "chatwoot-sdk-script";
const CSP_NONCE_META_NAME = "csp-nonce";

type ChatwootToggleState = "open" | "close";
type ChatwootBubbleVisibility = "show" | "hide";

type ChatwootApi = {
  hasLoaded?: boolean;
  toggle?: (state?: ChatwootToggleState) => void;
  toggleBubbleVisibility?: (visibility: ChatwootBubbleVisibility) => void;
};

type ChatwootSdk = {
  run: (options: { websiteToken: string; baseUrl: string }) => void;
};

let isChatwootInitialized = false;
let chatwootInitPromise: Promise<void> | null = null;

const resetChatwootInitialization = () => {
  isChatwootInitialized = false;
  chatwootInitPromise = null;
};

const hasChatwootWidgetElements = () => {
  return Boolean(
    document.querySelector(".woot-widget-holder") && document.querySelector(".woot--bubble-holder"),
  );
};

const getCspNonce = () => {
  const nonceMeta = document.querySelector<HTMLMetaElement>(`meta[name="${CSP_NONCE_META_NAME}"]`);
  if (!nonceMeta) {
    return undefined;
  }

  return nonceMeta.content || undefined;
};

declare global {
  interface Window {
    chatwootSettings?: {
      hideMessageBubble: boolean;
      position: "left" | "right";
      locale: string;
      type: "standard" | "expanded_bubble";
    };
    chatwootSDK?: ChatwootSdk;
    $chatwoot?: ChatwootApi;
  }
}

export const useChatwoot = () => {
  const hideChatwootBubble = useCallback(() => {
    if (!window.$chatwoot?.hasLoaded || !hasChatwootWidgetElements()) {
      return;
    }

    window.$chatwoot.toggleBubbleVisibility?.("hide");
  }, []);

  const initializeChatwoot = useCallback(() => {
    if (typeof window === "undefined") {
      return Promise.resolve();
    }

    if (!CHATWOOT_WEBSITE_TOKEN) {
      return Promise.resolve();
    }

    if (isChatwootInitialized || window.$chatwoot?.hasLoaded) {
      isChatwootInitialized = true;
      hideChatwootBubble();
      return Promise.resolve();
    }

    if (chatwootInitPromise) {
      return chatwootInitPromise;
    }

    chatwootInitPromise = new Promise<void>((resolve) => {
      window.chatwootSettings = {
        hideMessageBubble: true,
        position: "right",
        locale: "en",
        type: "standard",
      };

      let readyTimeout: number | undefined;
      let attachedScript: HTMLScriptElement | null = null;

      const removeScriptListeners = () => {
        if (!attachedScript) return;

        attachedScript.removeEventListener("load", onScriptLoad);
        attachedScript.removeEventListener("error", onScriptError);
      };

      const onReady = () => {
        if (readyTimeout) {
          window.clearTimeout(readyTimeout);
        }
        removeScriptListeners();
        hideChatwootBubble();
        isChatwootInitialized = true;
        chatwootInitPromise = null;
        resolve();
      };

      const onFailure = () => {
        if (readyTimeout) {
          window.clearTimeout(readyTimeout);
        }
        window.removeEventListener("chatwoot:ready", onReady);
        removeScriptListeners();
        resetChatwootInitialization();
        resolve();
      };

      const onScriptLoad = () => {
        window.chatwootSDK?.run({
          websiteToken: CHATWOOT_WEBSITE_TOKEN,
          baseUrl: CHATWOOT_BASE_URL,
        });

        if (window.$chatwoot?.hasLoaded) {
          onReady();
          return;
        }

        readyTimeout = window.setTimeout(() => {
          if (window.$chatwoot?.hasLoaded) {
            onReady();
            return;
          }

          onFailure();
        }, CHATWOOT_READY_TIMEOUT_MS);
      };

      const onScriptError = () => {
        onFailure();
      };

      window.addEventListener("chatwoot:ready", onReady, { once: true });

      const existingScript = document.getElementById(
        CHATWOOT_SCRIPT_ID,
      ) as HTMLScriptElement | null;

      if (existingScript) {
        attachedScript = existingScript;

        if (window.chatwootSDK) {
          onScriptLoad();
          return;
        }

        existingScript.addEventListener("load", onScriptLoad, { once: true });
        existingScript.addEventListener("error", onScriptError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = CHATWOOT_SCRIPT_ID;
      script.type = "text/javascript";
      script.async = true;
      script.src = `${CHATWOOT_BASE_URL}/packs/js/sdk.js`;
      const nonce = getCspNonce();
      if (nonce) {
        script.nonce = nonce;
      }

      attachedScript = script;
      script.addEventListener("load", onScriptLoad, { once: true });
      script.addEventListener("error", onScriptError, { once: true });
      document.head.appendChild(script);
    });

    return chatwootInitPromise;
  }, [hideChatwootBubble]);

  useEffect(() => {
    void initializeChatwoot();
  }, [initializeChatwoot]);

  const openMessenger = useCallback(() => {
    const openChat = () => {
      hideChatwootBubble();
      window.$chatwoot?.toggle?.("open");
    };

    void initializeChatwoot().then(openChat);
  }, [hideChatwootBubble, initializeChatwoot]);

  return {
    openMessenger,
  };
};
