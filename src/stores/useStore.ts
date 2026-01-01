import { create } from 'zustand';
import type { Visit, Zoo, ChecklistItem, User } from '../types';

interface AppState {
  // Auth (loaded from API, not persisted locally)
  user: User | null;
  isAuthLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;

  // Active visit
  activeVisit: Visit | null;
  activeZoo: Zoo | null;
  checklist: ChecklistItem[];
  setActiveVisit: (visit: Visit | null, zoo: Zoo | null) => void;
  setChecklist: (checklist: ChecklistItem[]) => void;
  updateChecklistItem: (animalId: string, updates: Partial<ChecklistItem>) => void;

  // UI state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Camera
  capturedImage: string | null;
  setCapturedImage: (image: string | null) => void;

  // Logout
  logout: () => void;
}

export const useStore = create<AppState>()((set) => ({
  // Auth
  user: null,
  isAuthLoading: true, // Start as loading until we check auth
  setUser: (user) => set({ user, isAuthLoading: false }),
  setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),

  // Active visit
  activeVisit: null,
  activeZoo: null,
  checklist: [],
  setActiveVisit: (visit, zoo) => set({ activeVisit: visit, activeZoo: zoo }),
  setChecklist: (checklist) => set({ checklist }),
  updateChecklistItem: (animalId, updates) =>
    set((state) => ({
      checklist: state.checklist.map((item) =>
        item.id === animalId ? { ...item, ...updates } : item
      ),
    })),

  // UI state
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
  error: null,
  setError: (error) => set({ error }),

  // Camera
  capturedImage: null,
  setCapturedImage: (capturedImage) => set({ capturedImage }),

  // Logout - clear all state
  logout: () =>
    set({
      user: null,
      activeVisit: null,
      activeZoo: null,
      checklist: [],
      capturedImage: null,
      error: null,
    }),
}));

// Legacy alias for backwards compatibility
export const useProfile = () => {
  const user = useStore((state) => state.user);
  return user
    ? { id: user.id, displayName: user.displayName, createdAt: user.createdAt }
    : null;
};
