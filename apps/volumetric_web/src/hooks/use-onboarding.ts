"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  showOnboarding: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      showOnboarding: false,
      openOnboarding: () => set({ showOnboarding: true }),
      closeOnboarding: () => set({ showOnboarding: false }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true, showOnboarding: false }),
      resetOnboarding: () => set({ hasCompletedOnboarding: false }),
    }),
    {
      name: "volumetric-onboarding",
      partialize: (state) => ({ hasCompletedOnboarding: state.hasCompletedOnboarding }),
    },
  ),
);
