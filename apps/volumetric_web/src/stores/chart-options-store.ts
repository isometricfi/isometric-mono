import { create } from "zustand";

interface ChartOptionsState {
  strikePercent: number;
  termDays: number;
  setStrikePercent: (percent: number) => void;
  setTermDays: (days: number) => void;
}

export const useChartOptionsStore = create<ChartOptionsState>((set) => ({
  strikePercent: 5,
  termDays: 7,
  setStrikePercent: (percent) => set({ strikePercent: percent }),
  setTermDays: (days) => set({ termDays: days }),
}));
