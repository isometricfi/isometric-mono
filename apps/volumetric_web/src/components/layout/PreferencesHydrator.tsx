"use client";

import { useEffect } from "react";
import { usePreferencesStore } from "@/stores/preferences-store";

export function PreferencesHydrator() {
  useEffect(() => {
    usePreferencesStore.persist.rehydrate();
  }, []);
  return null;
}
