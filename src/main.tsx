import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Resilient Service Worker for PWA compliance and mobile installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Automatically check for worker updates
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('FitTrainer Service Worker registration warning:', err);
      });
  });
}

// Global Error Boundary to prevent any blank screen on mobile
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FitTrainer Caught Error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('fittrainer_active_routine');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4 text-2xl font-black">
            !
          </div>
          <h2 className="text-xl font-black mb-2">Se ha recuperado la sesión</h2>
          <p className="text-xs text-slate-400 max-w-sm mb-6">
            FitTrainer ha protegido tus datos. Pulsa reiniciar para volver a tu entrenamiento con total normalidad.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button
              onClick={() => window.location.reload()}
              className="py-3 px-4 bg-emerald-500 text-slate-950 font-black rounded-xl text-sm"
            >
              Recargar App
            </button>
            <button
              onClick={this.handleReset}
              className="py-2.5 px-4 bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:text-white"
            >
              Reiniciar Rutina Local
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
