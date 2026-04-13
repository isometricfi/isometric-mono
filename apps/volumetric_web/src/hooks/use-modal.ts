"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

interface ModalState {
  isOpen: boolean;
  content: ReactNode | null;
  fullscreen: boolean;
  minHeight?: string;
  showCloseButton: boolean;
  openModal: (
    content: ReactNode,
    fullscreen?: boolean,
    minHeight?: string,
    showCloseButton?: boolean,
  ) => void;
  closeModal: () => void;
}

export const useModal = create<ModalState>((set) => ({
  isOpen: false,
  content: null,
  fullscreen: false,
  minHeight: undefined,
  showCloseButton: false,
  openModal: (content, fullscreen = false, minHeight, showCloseButton = false) =>
    set({ isOpen: true, content, fullscreen, minHeight, showCloseButton }),
  closeModal: () =>
    set({
      isOpen: false,
      content: null,
      fullscreen: false,
      minHeight: undefined,
      showCloseButton: false,
    }),
}));
