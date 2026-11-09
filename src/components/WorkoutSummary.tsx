import { useEffect, useState } from 'react';
import { Trophy, Clock, CheckCircle2, RotateCcw, ArrowRight, Dumbbell, Calendar, Target, FileSpreadsheet } from 'lucide-react';
import { playWorkoutDoneFanfare, playTap } from '../utils/sound';
import CircularProgress from './CircularProgress';
import { getAccessToken } from '../services/firebaseAuth';
import { appendWorkoutToSheet } from '../services/googleSheets';

interface WorkoutSummaryProps {
  sessionData: {
    durationSeconds: number;
    completedCount: number;
    totalCount: number;
    roundsCompleted?: number;
    circuitCount?: number;
    items: { name: string; mode: 'reps' | 'time'; target: number; completed: boolean }[];
  };
  onRestart: () => void;
  onBackToBuilder: () => void;
  onOpenSheetsModal?: () => void;
}

export default function WorkoutSummary({
  sessionData,
  onRestart,
  onBackToBuilder,
  onOpenSheetsModal,
}: WorkoutSummaryProps) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'not_connected'>('idle');

  useEffect(() => {
    playWorkoutDoneFanfare();
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const completionPercent = Math.round(
    (sessionData.completedCount / (sessionData.totalCount || 1)) * 100
  );

  return (
    <div className="flex-1 flex flex-col justify-center max-w-xl w-full mx-auto p-4 select-none animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        
        {/* Trophy & Circular Completion Ring */}
        <div className="flex items-center justify-center gap-4">
          <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center text-4xl shadow-lg glow-emerald">
            <Trophy className="w-10 h-10 stroke-[2.5]" />
          </div>
          <CircularProgress
            value={completionPercent}
            size={76}
            strokeWidth={6}
            currentStep={sessionData.completedCount}
            totalSteps={sessionData.totalCount}
          />
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            ¡Entrenamiento Completado!
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
            ¡Gran esfuerzo! Has completado con éxito tu sesión de entrenamiento personalizado.
          </p>
          {sessionData.circuitCount && sessionData.roundsCompleted && (
            <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-bold font-mono">
              <span>{sessionData.circuitCount} {sessionData.circuitCount === 1 ? 'Circuito' : 'Circuitos'}</span>
              <span>·</span>
              <span>{sessionData.roundsCompleted} {sessionData.roundsCompleted === 1 ? 'Vuelta' : 'Vueltas'}</span>
              <span>({sessionData.circuitCount * sessionData.roundsCompleted} circuitos en total)</span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ejercicios</span>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {sessionData.completedCount} <span className="text-sm font-normal text-slate-500">/ {sessionData.totalCount}</span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tiempo Total</span>
            </div>
            <div className="text-2xl font-black text-cyan-400 font-mono">
              {formatTime(sessionData.durationSeconds)}
            </div>
          </div>
        </div>

        {/* Breakdown List */}
        <div className="text-left space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Desglose de la sesión</span>
            <span className="text-[10px] text-slate-500 font-normal">Realizado hoy</span>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 text-xs">
            {sessionData.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-200 font-medium truncate max-w-[200px]">
                    {idx + 1}. {item.name}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-400">
                  {item.mode === 'reps' ? `${item.target} reps` : `${item.target}s`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Google Sheets Quick Sync Button */}
        {onOpenSheetsModal && (
          <div className="pt-1">
            <button
              onClick={() => {
                playTap();
                onOpenSheetsModal();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-emerald-500/40 hover:border-emerald-500 text-emerald-400 hover:text-emerald-300 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
              <span>Ver / Guardar en Google Sheets</span>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            onClick={() => {
              playTap();
              onBackToBuilder();
            }}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg glow-emerald transition active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Volver a la Lista de Ejercicios</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>

          <button
            onClick={() => {
              playTap();
              onRestart();
            }}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Repetir este Entrenamiento</span>
          </button>
        </div>

      </div>
    </div>
  );
}
