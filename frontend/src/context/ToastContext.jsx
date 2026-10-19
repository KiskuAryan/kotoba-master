import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => {
          const bgColors = {
            success: 'bg-emerald-600 text-white border-emerald-500',
            error: 'bg-nobunaga-red text-white border-red-500',
            warning: 'bg-amber-600 text-white border-amber-500',
            info: 'bg-slate-800 text-slate-100 border-slate-700'
          };
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto px-4 py-3 rounded-lg shadow-xl border text-sm font-medium flex items-center justify-between gap-3 animate-fade-in ${
                bgColors[toast.type] || bgColors.info
              }`}
            >
              <span>{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 transition-opacity ml-2 text-lg leading-none"
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return { showToast: (msg) => console.log('Toast:', msg), removeToast: () => {} };
  }
  return context;
}
