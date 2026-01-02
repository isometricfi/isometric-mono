"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

interface ModalState {
  isOpen: boolean;
  content: ReactNode | null;
  fullscreen: boolean;
  minHeight?: string;
  openModal: (content: ReactNode, fullscreen?: boolean, minHeight?: string) => void;
  closeModal: () => void;
}

export const useModal = create<ModalState>((set) => ({
  isOpen: false,
  content: null,
  fullscreen: false,
  minHeight: undefined,
  openModal: (content, fullscreen = false, minHeight) =>
    set({ isOpen: true, content, fullscreen, minHeight }),
  closeModal: () => set({ isOpen: false, content: null, fullscreen: false, minHeight: undefined }),
}));
