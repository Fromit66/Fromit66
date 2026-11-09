import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  X,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  Database,
  LogOut,
  Upload,
  Calendar,
  Sparkles,
  Smartphone,
  ChevronRight,
} from 'lucide-react';
import { playTap } from '../utils/sound';
import {
  googleSignIn,
  logoutGoogle,
  getAccessToken,
  initAuth,
} from '../services/firebaseAuth';
import {
  findOrCreateWorkoutSpreadsheet,
  syncAllHistoryToSheet,
  exportCatalogToSheet,
  SpreadsheetRef,
} from '../services/googleSheets';
import { WorkoutHistoryItem, Exercise } from '../types';

interface GoogleSheetsSyncModalProps {
  history: WorkoutHistoryItem[];
  catalog: Exercise[];
  autoSync: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  onClose: () => void;
}

export default function GoogleSheetsSyncModal({
  history,
  catalog,
  autoSync,
  onToggleAutoSync,
  onClose,
}: GoogleSheetsSyncModalProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetRef | null>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_sheets_ref');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Save spreadsheet reference in localStorage
  useEffect(() => {
    if (spreadsheet) {
      localStorage.setItem('fittrainer_sheets_ref', JSON.stringify(spreadsheet));
    }
  }, [spreadsheet]);

  // Handle Google Sign in
  const handleSignIn = async () => {
    playTap();
    setIsLoggingIn(true);
    setSyncStatus(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);

        // Immediately check or create the spreadsheet
        setIsLoadingSheet(true);
        const sheet = await findOrCreateWorkoutSpreadsheet(result.accessToken);
        setSpreadsheet(sheet);
      }
    } catch (err: unknown) {
      console.error('Login failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setSyncStatus(`Error al iniciar sesión: ${msg}`);
    } finally {
      setIsLoggingIn(false);
      setIsLoadingSheet(false);
    }
  };

  const handleSignOut = async () => {
    playTap();
    await logoutGoogle();
    setCurrentUser(null);
    setAccessToken(null);
    setSyncStatus(null);
  };

  // Connect or refresh spreadsheet
  const handleConnectSheet = async () => {
    playTap();
    let token = accessToken;
    if (!token) {
      token = await getAccessToken();
    }
    if (!token) {
      handleSignIn();
      return;
    }

    setIsLoadingSheet(true);
    setSyncStatus(null);
    try {
      const sheet = await findOrCreateWorkoutSpreadsheet(token);
      setSpreadsheet(sheet);
      setSyncStatus('Hoja de cálculo vinculada con éxito.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncStatus(`Error: ${msg}`);
    } finally {
      setIsLoadingSheet(false);
    }
  };

  // Sync historical workouts (requires user confirmation per skill guidelines)
  const handleSyncHistory = async () => {
    playTap();
    if (!spreadsheet) {
      await handleConnectSheet();
      return;
    }

    let token = accessToken;
    if (!token) token = await getAccessToken();
    if (!token) {
      handleSignIn();
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas exportar y sincronizar tus ${history.length} sesiones de entrenamiento con la hoja '${spreadsheet.name}' de Google Sheets?`
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const syncedCount = await syncAllHistoryToSheet(token, spreadsheet.id, history);
      setSyncStatus(`¡Listo! Se han sincronizado ${syncedCount} sesiones en Google Sheets.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncStatus(`Error al sincronizar: ${msg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Export catalog
  const handleExportCatalog = async () => {
    playTap();
    if (!spreadsheet) return;
    let token = accessToken;
    if (!token) token = await getAccessToken();
    if (!token) {
      handleSignIn();
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas actualizar la pestaña 'Catalogo_Ejercicios' en Google Sheets con los ${catalog.length} ejercicios actuales?`
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const ok = await exportCatalogToSheet(token, spreadsheet.id, catalog);
      if (ok) {
        setSyncStatus(`¡Catálogo de ${catalog.length} ejercicios exportado a Google Sheets!`);
      } else {
        setSyncStatus('No se pudo exportar el catálogo.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncStatus(`Error al exportar: ${msg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto flex items-center justify-center">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">Google Sheets & Pixel</h2>
              <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">
                Almacena tus datos en tu Google Drive
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auth section */}
        {!currentUser ? (
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Conecta tu cuenta de Google</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Guarda automáticamente cada entrenamiento en una hoja de cálculo en tu Google Drive, consultable desde la app de Google Sheets en tu Pixel o PC.
              </p>
            </div>

            {/* Official GSI Style Button */}
            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-md active:scale-98 transition disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'Iniciando sesión...' : 'Iniciar sesión con Google'}</span>
            </button>
          </div>
        ) : (
          /* User is connected */
          <div className="space-y-4">
            
            {/* User profile strip */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2.5">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Usuario'}
                    className="w-8 h-8 rounded-full border border-emerald-500/40"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                    {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-xs text-white truncate">
                    {currentUser.displayName || 'Usuario de Google'}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {currentUser.email}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 p-1.5 rounded-lg hover:bg-slate-900 transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[11px]">Salir</span>
              </button>
            </div>

            {/* Spreadsheet Card */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Hoja de Cálculo en Google Drive</span>
                </span>
                {spreadsheet && (
                  <span className="text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    Conectada
                  </span>
                )}
              </div>

              {spreadsheet ? (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white truncate">
                        {spreadsheet.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Pestañas: Sesiones · Detalle_Ejercicios · Catalogo
                      </div>
                    </div>

                    <a
                      href={spreadsheet.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={playTap}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 active:scale-95 transition shadow-sm"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                    </a>
                  </div>

                  {/* Sync Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleSyncHistory}
                      disabled={isSyncing}
                      className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sincronizar Historial</span>
                    </button>

                    <button
                      onClick={handleExportCatalog}
                      disabled={isSyncing}
                      className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Exportar Catálogo</span>
                    </button>
                  </div>

                  {/* Auto-Sync Toggle */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 cursor-pointer">
                    <span className="text-xs text-slate-300 font-medium">
                      Auto-sincronizar al terminar cada entreno
                    </span>
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => {
                        playTap();
                        onToggleAutoSync(e.target.checked);
                      }}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-slate-400">
                    Aún no tienes creada la hoja de cálculo de FitTrainer.
                  </p>
                  <button
                    onClick={handleConnectSheet}
                    disabled={isLoadingSheet}
                    className="py-2.5 px-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 mx-auto active:scale-95 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{isLoadingSheet ? 'Creando hoja...' : 'Crear Hoja en mi Google Drive'}</span>
                  </button>
                </div>
              )}

              {/* Status feedback message */}
              {syncStatus && (
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{syncStatus}</span>
                </div>
              )}
            </div>

            {/* Pixel Tip Card */}
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                <Smartphone className="w-3.5 h-3.5" />
                <span>¿Cómo ver tus datos en tu Google Pixel?</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Tu Pixel tiene integrada la app <strong>Google Sheets (Hojas de cálculo)</strong>. Cualquier entreno guardado aquí se sincroniza con tu cuenta de Google y puedes abrirlo al instante desde tu teléfono o widget.
              </p>
            </div>

          </div>
        )}

        <button
          onClick={() => {
            playTap();
            onClose();
          }}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition active:scale-95"
        >
          Cerrar
        </button>

      </div>
    </div>
  );
}
