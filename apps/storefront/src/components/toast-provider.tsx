"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "warning" | "info";

type ToastInput = {
  type?: ToastType;
  message: string;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastContextValue = {
  notify: (input: ToastInput) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [stackAnchorStyle, setStackAnchorStyle] = useState<Record<string, string>>({});
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (input: ToastInput) => {
      const id = nextIdRef.current++;
      const toast: ToastItem = {
        id,
        type: input.type ?? "info",
        message: input.message,
        actionLabel: input.actionLabel,
        onAction: input.onAction,
      };

      setToasts((current) => [...current, toast]);

      const durationMs = input.durationMs ?? 4200;
      if (durationMs > 0) {
        setTimeout(() => {
          dismiss(id);
        }, durationMs);
      }
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(() => ({ notify, dismiss }), [notify, dismiss]);

  useEffect(() => {
    const updateToastAnchorPosition = () => {
      const cartIcon =
        document.querySelector<HTMLAnchorElement>('.header-actions .icon-btn[href="/cart"]') ||
        document.querySelector<HTMLAnchorElement>('.header-actions .icon-btn[href="/cart?v2=1"]');

      if (!cartIcon) {
        setStackAnchorStyle({});
        return;
      }

      const rect = cartIcon.getBoundingClientRect();
      const left = rect.left + rect.width / 2;
      const top = rect.bottom + 14;

      setStackAnchorStyle({
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
      });
    };

    updateToastAnchorPosition();
    window.addEventListener("resize", updateToastAnchorPosition);
    window.addEventListener("scroll", updateToastAnchorPosition, true);

    return () => {
      window.removeEventListener("resize", updateToastAnchorPosition);
      window.removeEventListener("scroll", updateToastAnchorPosition, true);
    };
  }, [toasts.length]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={`toast-stack${stackAnchorStyle.left ? " toast-stack-anchored" : ""}`}
        style={stackAnchorStyle}
        role="status"
        aria-live="polite"
        aria-label="Системные уведомления"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <button type="button" className="toast-close-btn" aria-label="Закрыть уведомление" onClick={() => dismiss(toast.id)}>
              ×
            </button>
            <p>{toast.message}</p>
            <div className="toast-actions">
              {toast.onAction && toast.actionLabel && (
                <button
                  type="button"
                  className="toast-action-btn"
                  onClick={() => {
                    toast.onAction?.();
                    dismiss(toast.id);
                  }}
                >
                  {toast.actionLabel}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
