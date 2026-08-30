"use client";

import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

interface ToastAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface ToastOptions {
  action?: ToastAction;
  durationMs?: number;
}

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">, options?: ToastOptions) => void;
  dismiss: (id: string) => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast, options) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    const duration = options?.durationMs ?? (options?.action ? 6000 : 4000);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, action: options?.action ?? toast.action, id }],
    }));
    // Auto-dismiss
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string, options?: ToastOptions) =>
    useToastStore.getState().push({ title, description, variant: "success", action: options?.action }, options),
  error: (title: string, description?: string, options?: ToastOptions) =>
    useToastStore.getState().push({ title, description, variant: "error", action: options?.action }, options),
  info: (title: string, description?: string, options?: ToastOptions) =>
    useToastStore.getState().push({ title, description, variant: "info", action: options?.action }, options),
};
