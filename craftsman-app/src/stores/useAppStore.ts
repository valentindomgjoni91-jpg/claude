import { create } from 'zustand';

interface AppStore {
  isOnline: boolean;
  syncPending: number;
  setOnline: (online: boolean) => void;
  setSyncPending: (count: number) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isOnline: navigator.onLine,
  syncPending: 0,
  setOnline: (online) => set({ isOnline: online }),
  setSyncPending: (count) => set({ syncPending: count }),
}));
