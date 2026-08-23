import { create } from "zustand";

interface UIState {
  mobileMenuOpen: boolean;
  practiceActive: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  setPracticeActive: (active: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mobileMenuOpen: false,
  practiceActive: false,
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
  setPracticeActive: (practiceActive) => set({ practiceActive }),
}));
