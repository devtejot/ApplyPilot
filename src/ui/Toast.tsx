import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from './cn';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const icons: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};
const accents: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-xs -translate-x-1/2 flex-col gap-2">
          {items.map((t) => {
            const Icon = icons[t.variant];
            return (
              <div
                key={t.id}
                role="status"
                className="pointer-events-auto flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 shadow-lg animate-slide-up-fade"
              >
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', accents[t.variant])} aria-hidden />
                <span className="flex-1 text-xs text-fg">{t.message}</span>
                <button
                  aria-label="Dismiss"
                  onClick={() => dismiss(t.id)}
                  className="text-fg-subtle transition-colors hover:text-fg"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
