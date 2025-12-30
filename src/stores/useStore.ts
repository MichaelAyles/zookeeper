import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Visit, Zoo, ChecklistItem, UserProfile } from '../types';

interface AppState {
  // User
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;

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
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // User
      profile: null,
      setProfile: (profile) => set({ profile }),

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
    }),
    {
      name: 'zookeeper-store',
      partialize: (state) => ({
        profile: state.profile,
        // Don't persist active visit - we'll load it from DB
      }),
    }
  )
);
