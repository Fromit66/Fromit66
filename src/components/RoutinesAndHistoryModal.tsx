import { useState } from 'react';
import { SavedRoutine, WorkoutHistoryItem, RoutineItem } from '../types';
import { X, BookOpen, History, Play, Trash2, Clock, Dumbbell, Save, Check } from 'lucide-react';
import { playTap } from '../utils/sound';
import WeeklyConsistencyChart from './WeeklyConsistencyChart';

interface RoutinesAndHistoryModalProps {
  presets: SavedRoutine[];
  savedRoutines: SavedRoutine[];
  history: WorkoutHistoryItem[];
  currentRoutineItems: RoutineItem[];
  onLoadRoutine: (items: RoutineItem[]) => void;
  onSaveCurrentRoutine: (name: string) => void;
  onDeleteSavedRoutine: (id: string) => void;
  onClearHistory: () => void;
  onSeedSampleData?: () => void;
  onClose: () => void;
}

export default function RoutinesAndHistoryModal({
  presets,
  savedRoutines,
  history,
  currentRoutineItems,
  onLoadRoutine,
  onSaveCurrentRoutine,
  onDeleteSavedRoutine,
  onClearHistory,
  onSeedSampleData,
  onClose,
}: RoutinesAndHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'routines' | 'chart' | 'history'>('routines');
  const [newRoutineName, setNewRoutineName] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutineName.trim()) return;
    playTap();
    onSaveCurrentRoutine(newRoutineName.trim());
    setNewRoutineName('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto flex items-center justify-center">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
        
        {/* Header with Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                playTap();
                setActiveTab('routines');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition shrink-0 ${
                activeTab === 'routines'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Rutinas
            </button>
            <button
              onClick={() => {
                playTap();
                setActiveTab('chart');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition shrink-0 ${
                activeTab === 'chart'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Gráfico Semanal
            </button>
            <button
              onClick={() => {
                playTap();
                setActiveTab('history');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition shrink-0 ${
                activeTab === 'history'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Historial ({history.length})
            </button>
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

        {/* TAB 1: RUTINAS */}
        {activeTab === 'routines' && (
          <div className="space-y-4">
            {/* Guardar selección actual como rutina */}
            {currentRoutineItems.length > 0 && (
              <form onSubmit={handleSave} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Guardar selección actual ({currentRoutineItems.length} ejercicios)</span>
                  </span>
                  {savedSuccess && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Guardada
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRoutineName}
                    onChange={(e) => setNewRoutineName(e.target.value)}
                    placeholder="Nombre: Ej: Mi Rutina Full Body..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition active:scale-95 shrink-0"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            )}

            {/* Rutinas del Usuario */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Mis Rutinas Personalizadas ({savedRoutines.length})
              </h3>
              {savedRoutines.length === 0 ? (
                <div className="text-center py-4 bg-slate-950/50 rounded-2xl border border-slate-800/80 text-xs text-slate-500">
                  Aún no has guardado rutinas personalizadas.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {savedRoutines.map((routine) => (
                    <div
                      key={routine.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-xs text-white">{routine.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {routine.items.length} ejercicios · {formatDate(routine.createdAt)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            playTap();
                            onLoadRoutine(routine.items);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] uppercase tracking-wider transition active:scale-95 flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Cargar</span>
                        </button>
                        <button
                          onClick={() => {
                            playTap();
                            onDeleteSavedRoutine(routine.id);
                          }}
                          className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rutinas Prediseñadas */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Rutinas Predefinidas Rápidas
              </h3>
              <div className="space-y-2">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-xs text-white">{preset.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {preset.items.length} ejercicios mixtos (reps + tiempo)
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        playTap();
                        onLoadRoutine(preset.items);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-[11px] uppercase tracking-wider transition active:scale-95 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Cargar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GRÁFICO SEMANAL (RECHARTS) */}
        {activeTab === 'chart' && (
          <div className="space-y-3">
            <WeeklyConsistencyChart
              history={history}
              onSeedSampleData={onSeedSampleData}
            />
          </div>
        )}

        {/* TAB 3: HISTORIAL */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Sesiones Registradas ({history.length})
              </span>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('¿Borrar todo el historial de entrenamientos?')) {
                      onClearHistory();
                      playTap();
                    }
                  }}
                  className="text-[10px] text-rose-400 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Vaciar Historial</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-8 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-500">
                Aún no has registrado ningún entrenamiento completado.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">
                        {record.routineName || 'Entrenamiento Personalizado'}
                      </span>
                      <span className="text-[10px] text-slate-500">{formatDate(record.date)}</span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <Dumbbell className="w-3.5 h-3.5" />
                        <span>{record.completedCount} / {record.totalCount} ejercicios</span>
                      </div>
                      <div className="flex items-center gap-1 text-cyan-400 font-semibold font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTime(record.durationSeconds)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
