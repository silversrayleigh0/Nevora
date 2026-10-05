import { create } from "zustand";

export type Toast = { id: number; message: string; action?: { label: string; run: () => void } };

type ToastState = { toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; dismiss: (id: number) => void };

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id: Date.now() + Math.random() }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, action?: Toast["action"]) => useToasts.getState().push({ message, action });
