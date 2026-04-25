import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type PortfolioTab = "offers" | "options";

interface PreferencesState {
  isProMode: boolean;
  portfolioTab: PortfolioTab;
  setProMode: (value: boolean) => void;
  setPortfolioTab: (tab: PortfolioTab) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      isProMode: false,
      portfolioTab: "offers",
      setProMode: (value) => set({ isProMode: value }),
      setPortfolioTab: (tab) => set({ portfolioTab: tab }),
    }),
    {
      name: "vm-prefs",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        isProMode: state.isProMode,
        portfolioTab: state.portfolioTab,
      }),
    },
  ),
);

export const useProMode = () => {
  const isProMode = usePreferencesStore((s) => s.isProMode);
  const setProMode = usePreferencesStore((s) => s.setProMode);
  return { isProMode, setProMode };
};

export const usePortfolioTab = () => {
  const portfolioTab = usePreferencesStore((s) => s.portfolioTab);
  const setPortfolioTab = usePreferencesStore((s) => s.setPortfolioTab);
  return { portfolioTab, setPortfolioTab };
};
