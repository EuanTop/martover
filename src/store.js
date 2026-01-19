import {create} from 'zustand';

export const useCursorStore = create((set) => ({
  type: 'default',
  setType: (type) => set({ type }),
}));