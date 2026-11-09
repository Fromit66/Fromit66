import { useState, useEffect, useRef } from 'react';
import { RoutineItem, WorkoutPhase } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  Sparkles,
  Timer as TimerIcon,
  Repeat,
  Sun,
  Moon,
  Flame,
  HeartPulse,
  Layers,
} from 'lucide-react';
import {
  playCountdownTick,
  playTimerDone,
  playExerciseCompleted,
  playTap,
  triggerHaptic,
} from '../utils/sound';
import { useWorkoutWakeLock } from '../hooks/useWorkoutWakeLock';
import CircularProgress from './CircularProgress';

interface WorkoutPlayerProps {
  routine: RoutineItem[];
  rounds?: number;
  circuitCount?: number;
  targetCircuit?: 'all' | 1 | 2;
  restBetweenRounds?: number;
  onFinish: (sessionData: {
    durationSeconds: number;
    completedCount: number;
    totalCount: number;
    roundsCompleted?: number;
    circuitCount?: number;
    items: { name: string; mode: 'reps' | 'time'; target: number; completed: boolean }[];
  }) => void;
  onCancel: () => void;
  isSoundMuted: boolean;
  onToggleSound: () => void;
}

export default function WorkoutPlayer({
  routine,
  rounds = 1,
  circuitCount = 1,
  targetCircuit = 'all',
  restBetweenRounds = 45,
  onFinish,
  onCancel,
  isSoundMuted,
  onToggleSound,
}: WorkoutPlayerProps) {
  // 1. Separate routine items by Phase:
  // - Warmup: executed ONCE before the circuits (e.g. 10-12 min static bike / treadmill)
  // - Cooldown: executed ONCE after all circuits complete (e.g. 10-12 min rowing machine / stretch)
  // - Main: circuit exercises executed across rounds and circuits (e.g. 2 circuits x 2 rounds)
  const warmupItems = routine.filter((i) => i.phase === 'warmup');
  const cooldownItems = routine.filter((i) => i.phase === 'cooldown');
  const mainItems = routine.filter((i) => !i.phase || i.phase === 'main');

  // Circuit 1 and Circuit 2 exercises (independent counts allowed, e.g. 3 in C1 and 5 in C2)
  const c1Items = mainItems.filter((i) => (i.circuit || 1) === 1);
  const c2Items = mainItems.filter((i) => i.circuit === 2);

  // Initial phase and circuit determination
  const initialPhase: WorkoutPhase =
    warmupItems.length > 0 ? 'warmup' : mainItems.length > 0 ? 'main' : 'cooldown';
  const startCircuit = targetCircuit === 2 ? 2 : 1;

  const [currentPhase, setCurrentPhase] = useState<WorkoutPhase>(initialPhase);
  const [currentCircuit, setCurrentCircuit] = useState<number>(startCircuit);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [isSessionPaused, setIsSessionPaused] = useState(false);

  // Active items list for the current phase & circuit
  const activeItems =
    currentPhase === 'warmup'
      ? warmupItems
      : currentPhase === 'cooldown'
      ? cooldownItems
      : currentCircuit === 1
      ? c1Items
      : c2Items;

  const totalItemsInCurrentPhase = Math.max(1, activeItems.length);

  // Local adjustments for the current exercise (mode/reps/time)
  const [itemOverride, setItemOverride] = useState<{
    mode?: 'reps' | 'time';
    reps?: number;
    time?: number;
  }>({});

  const rawCurrentItem = activeItems[currentIndex] || activeItems[0] || routine[0];
  const currentItem = rawCurrentItem
    ? {
        ...rawCurrentItem,
        currentMode: itemOverride.mode || rawCurrentItem.currentMode,
        targetReps: itemOverride.reps ?? rawCurrentItem.targetReps,
        targetTime: itemOverride.time ?? rawCurrentItem.targetTime,
      }
    : null;

  // Intermission rest between rounds / circuits / phases
  const [isIntermission, setIsIntermission] = useState(false);
  const [intermissionRemaining, setIntermissionRemaining] = useState(restBetweenRounds);
  const [intermissionInfo, setIntermissionInfo] = useState({
    title: '',
    subtitle: '',
    nextName: '',
  });

  // Overall workout steps progress
  const mainSteps =
    circuitCount === 2
      ? targetCircuit === 1
        ? c1Items.length * rounds
        : targetCircuit === 2
        ? c2Items.length * rounds
        : (c1Items.length + c2Items.length) * rounds
      : mainItems.length * rounds;
  const totalWorkoutSteps = Math.max(
    1,
    warmupItems.length + mainSteps + cooldownItems.length
  );
  const [overallStepsCompleted, setOverallStepsCompleted] = useState(0);

  // Timer state for time-based exercises
  const [timerRemaining, setTimerRemaining] = useState<number>(
    currentItem?.currentMode === 'time' ? currentItem.targetTime : 30
  );
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [autoAdvanceOnTimer, setAutoAdvanceOnTimer] = useState(true);

  // Rest state (optional breather between exercises)
  const [isResting, setIsResting] = useState(false);
  const [restRemaining, setRestRemaining] = useState(0);
  const [restDuration, setRestDuration] = useState(0); // 0 = direct next

  // Refs for intervals
  const sessionIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const restIntervalRef = useRef<number | null>(null);
  const intermissionIntervalRef = useRef<number | null>(null);

  // Screen Wake Lock
  const {
    isSupported: isWakeLockSupported,
    isLocked: isWakeLockActive,
    toggleUserEnabled: toggleWakeLock,
  } = useWorkoutWakeLock(!isSessionPaused);

  const [showWakeLockNotice, setShowWakeLockNotice] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWakeLockNotice(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Session stopwatch
  useEffect(() => {
    if (!isSessionPaused) {
      sessionIntervalRef.current = window.setInterval(() => {
        setSessionElapsed((prev) => prev + 1);
      }, 1000);
    } else if (sessionIntervalRef.current) {
      clearInterval(sessionIntervalRef.current);
    }
    return () => {
      if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
    };
  }, [isSessionPaused]);

  // Sync timer when step, phase or circuit changes
  useEffect(() => {
    setItemOverride({});
    if (!currentItem) return;

    if (currentItem.currentMode === 'time') {
      setTimerRemaining(currentItem.targetTime);
      setIsTimerRunning(true);
    } else {
      setIsTimerRunning(false);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [currentIndex, currentPhase, currentCircuit]);

  // Exercise Timer Interval
  useEffect(() => {
    if (isTimerRunning && !isResting && !isSessionPaused && !isIntermission) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 4 && prev > 1) {
            playCountdownTick();
          }
          if (prev <= 1) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setIsTimerRunning(false);
            playTimerDone();

            if (autoAdvanceOnTimer) {
              setTimeout(() => {
                handleCompleteStep();
              }, 1200);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, isResting, isSessionPaused, isIntermission, autoAdvanceOnTimer, currentIndex]);

  // Rest Timer Interval
  useEffect(() => {
    if (isResting && restRemaining > 0) {
      restIntervalRef.current = window.setInterval(() => {
        setRestRemaining((prev) => {
          if (prev <= 4 && prev > 1) {
            playCountdownTick();
          }
          if (prev <= 1) {
            if (restIntervalRef.current) clearInterval(restIntervalRef.current);
            setIsResting(false);
            playExerciseCompleted();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
    }

    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, [isResting, restRemaining]);

  // Intermission Timer Interval
  useEffect(() => {
    if (isIntermission && intermissionRemaining > 0 && !isSessionPaused) {
      intermissionIntervalRef.current = window.setInterval(() => {
        setIntermissionRemaining((prev) => {
          if (prev <= 4 && prev > 1) {
            playCountdownTick();
          }
          if (prev <= 1) {
            if (intermissionIntervalRef.current) clearInterval(intermissionIntervalRef.current);
            setIsIntermission(false);
            playExerciseCompleted();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intermissionIntervalRef.current) {
      clearInterval(intermissionIntervalRef.current);
    }
    return () => {
      if (intermissionIntervalRef.current) clearInterval(intermissionIntervalRef.current);
    };
  }, [isIntermission, intermissionRemaining, isSessionPaused]);

  // Complete current exercise step
  const handleCompleteStep = () => {
    playExerciseCompleted();
    triggerHaptic(30);
    setOverallStepsCompleted((prev) => prev + 1);

    // 1. WARMUP PHASE
    if (currentPhase === 'warmup') {
      if (currentIndex < warmupItems.length - 1) {
        if (restDuration > 0) {
          setIsResting(true);
          setRestRemaining(restDuration);
        }
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Warmup completed! Transition to main circuits or cooldown
        if (mainItems.length > 0) {
          setIntermissionInfo({
            title: '¡Calentamiento completado!',
            subtitle: 'Pasando al Bloque Principal de Circuitos',
            nextName: `Circuito 1 · ${c1Items[0]?.name || 'Inicio'}`,
          });
          setIntermissionRemaining(Math.max(restBetweenRounds, 30));
          setIsIntermission(true);
          setCurrentPhase('main');
          setCurrentCircuit(1);
          setCurrentRound(1);
          setCurrentIndex(0);
        } else if (cooldownItems.length > 0) {
          setIntermissionInfo({
            title: '¡Calentamiento completado!',
            subtitle: 'Pasando al Enfriamiento',
            nextName: `Enfriamiento · ${cooldownItems[0]?.name || 'Inicio'}`,
          });
          setIntermissionRemaining(20);
          setIsIntermission(true);
          setCurrentPhase('cooldown');
          setCurrentIndex(0);
        } else {
          finishWorkout();
        }
      }
      return;
    }

    // 2. MAIN CIRCUITS PHASE
    if (currentPhase === 'main') {
      const activeList = currentCircuit === 1 ? c1Items : c2Items;
      if (currentIndex < activeList.length - 1) {
        if (restDuration > 0) {
          setIsResting(true);
          setRestRemaining(restDuration);
        }
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Round completed for this circuit
        if (currentRound < rounds) {
          const nextRoundNum = currentRound + 1;
          setIntermissionInfo({
            title: `¡Vuelta ${currentRound} de ${rounds} completada!`,
            subtitle:
              circuitCount === 2
                ? `Circuito ${currentCircuit} de 2`
                : 'Rutina en circuito',
            nextName: `Vuelta ${nextRoundNum} · ${activeList[0]?.name || 'Inicio'}`,
          });
          setIntermissionRemaining(restBetweenRounds);
          setIsIntermission(true);
          setCurrentRound(nextRoundNum);
          setCurrentIndex(0);
        } else {
          // All rounds completed for this circuit
          if (
            circuitCount === 2 &&
            targetCircuit === 'all' &&
            currentCircuit === 1 &&
            c2Items.length > 0
          ) {
            // Switch to Circuit 2
            setIntermissionInfo({
              title: '¡Circuito 1 completado con éxito!',
              subtitle: `Descanso antes del Circuito 2 (${rounds} ${rounds === 1 ? 'vuelta' : 'vueltas'})`,
              nextName: `Circuito 2 · ${c2Items[0]?.name || 'Primer ejercicio'}`,
            });
            setIntermissionRemaining(Math.max(restBetweenRounds, 60));
            setIsIntermission(true);
            setCurrentCircuit(2);
            setCurrentRound(1);
            setCurrentIndex(0);
          } else {
            // All circuits completed!
            if (cooldownItems.length > 0) {
              setIntermissionInfo({
                title: '¡Circuitos completados con éxito!',
                subtitle: 'Pasando al Bloque de Enfriamiento',
                nextName: `Enfriamiento · ${cooldownItems[0]?.name || 'Primer ejercicio'}`,
              });
              setIntermissionRemaining(Math.max(restBetweenRounds, 45));
              setIsIntermission(true);
              setCurrentPhase('cooldown');
              setCurrentIndex(0);
            } else {
              finishWorkout();
            }
          }
        }
      }
      return;
    }

    // 3. COOLDOWN PHASE
    if (currentPhase === 'cooldown') {
      if (currentIndex < cooldownItems.length - 1) {
        if (restDuration > 0) {
          setIsResting(true);
          setRestRemaining(restDuration);
        }
        setCurrentIndex((prev) => prev + 1);
      } else {
        finishWorkout();
      }
    }
  };

  const handleSkipStep = () => {
    playTap();
    handleCompleteStep();
  };

  const handlePrevStep = () => {
    if (currentIndex > 0) {
      playTap();
      setCurrentIndex((prev) => prev - 1);
      setOverallStepsCompleted((prev) => Math.max(0, prev - 1));
    }
  };

  const finishWorkout = () => {
    const summaryItems = routine.map((item) => ({
      name: item.name,
      mode: item.currentMode,
      target: item.currentMode === 'reps' ? item.targetReps : item.targetTime,
      completed: true,
      circuit: item.circuit || 1,
      phase: item.phase || 'main',
    }));

    onFinish({
      durationSeconds: sessionElapsed,
      completedCount: totalWorkoutSteps,
      totalCount: totalWorkoutSteps,
      roundsCompleted: rounds,
      circuitCount,
      items: summaryItems,
    });
  };

  // Adjust values mid-workout
  const adjustValue = (delta: number) => {
    if (!currentItem) return;
    playTap();
    triggerHaptic(20);
    if (currentItem.currentMode === 'reps') {
      const newReps = Math.max(1, currentItem.targetReps + delta);
      setItemOverride((prev) => ({ ...prev, reps: newReps }));
    } else {
      const newTime = Math.max(5, currentItem.targetTime + delta * 5);
      setItemOverride((prev) => ({ ...prev, time: newTime }));
      setTimerRemaining(newTime);
    }
  };

  const toggleCurrentItemMode = () => {
    if (!currentItem) return;
    playTap();
    const newMode = currentItem.currentMode === 'reps' ? 'time' : 'reps';
    setItemOverride((prev) => ({ ...prev, mode: newMode }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Ring offset calculations
  const totalTimerSeconds = currentItem?.targetTime || 60;
  const timerPercent = Math.max(0, Math.min(1, timerRemaining / (totalTimerSeconds || 1)));
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - timerPercent * circumference;
  const workoutProgressPercent = Math.min(
    100,
    Math.round(((overallStepsCompleted + 1) / totalWorkoutSteps) * 100)
  );

  if (!currentItem) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 p-4">
        Cargando entrenamiento...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between max-w-xl w-full mx-auto p-4 select-none pb-6">
      {/* TOP HEADER: Circular Routine Progress & Session Status */}
      <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-xl mb-3 space-y-3">
        {/* Top utility row: Exit, Wake Lock, Sound & Stopwatch */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <button
            onClick={() => {
              if (window.confirm('¿Seguro que deseas salir del entrenamiento actual?')) {
                onCancel();
              }
            }}
            className="text-rose-400 hover:text-rose-300 transition flex items-center gap-1.5 py-1 px-2.5 rounded-xl bg-rose-500/10 active:scale-95"
          >
            <X className="w-4 h-4" />
            <span>Salir</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Screen Wake Lock Indicator / Toggle */}
            {isWakeLockSupported && (
              <button
                onClick={() => {
                  playTap();
                  toggleWakeLock();
                }}
                className={`py-1 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 active:scale-95 transition ${
                  isWakeLockActive
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title="Modo pantalla activa: el móvil no se apagará mientras entrenas."
              >
                {isWakeLockActive ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                    <span className="hidden xs:inline">Pantalla activa</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden xs:inline">Pantalla normal</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={onToggleSound}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              title={isSoundMuted ? 'Activar sonido' : 'Silenciar sonido'}
            >
              {isSoundMuted ? (
                <VolumeX className="w-4 h-4 text-slate-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
            <div className="font-mono text-white text-xs sm:text-sm bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{formatTime(sessionElapsed)}</span>
            </div>
          </div>
        </div>

        {/* CIRCULAR PROGRESS ROW: Visual Progress Ring + Phase Badge */}
        <div className="flex items-center justify-between gap-3 bg-slate-950/70 p-2.5 sm:p-3 rounded-2xl border border-slate-850">
          <div className="flex items-center gap-3">
            <CircularProgress
              value={workoutProgressPercent}
              size={60}
              strokeWidth={5}
              currentStep={overallStepsCompleted + 1}
              totalSteps={totalWorkoutSteps}
            />

            <div>
              <div className="flex items-center gap-2">
                {currentPhase === 'warmup' && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>Calentamiento</span>
                  </span>
                )}
                {currentPhase === 'main' && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-400" />
                    <span>
                      {circuitCount === 2
                        ? targetCircuit === 1
                          ? `Solo Circuito 1 · Vuelta ${currentRound}/${rounds}`
                          : targetCircuit === 2
                          ? `Solo Circuito 2 · Vuelta ${currentRound}/${rounds}`
                          : `Circuito ${currentCircuit}/2 · Vuelta ${currentRound}/${rounds}`
                        : `Vuelta ${currentRound}/${rounds}`}
                    </span>
                  </span>
                )}
                {currentPhase === 'cooldown' && (
                  <span className="px-2 py-0.5 rounded-lg bg-teal-500/15 border border-teal-500/40 text-teal-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <HeartPulse className="w-3 h-3 text-teal-400" />
                    <span>Enfriamiento</span>
                  </span>
                )}
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {workoutProgressPercent}%
                </span>
              </div>

              <h3 className="text-sm sm:text-base font-black text-white leading-tight mt-1">
                {currentPhase === 'warmup' && `Ejercicio ${currentIndex + 1} de ${warmupItems.length}`}
                {currentPhase === 'main' && `Ejercicio ${currentIndex + 1} de ${totalItemsInCurrentPhase}`}
                {currentPhase === 'cooldown' && `Ejercicio ${currentIndex + 1} de ${cooldownItems.length}`}
              </h3>
              <span className="text-[11px] text-slate-400">
                Paso general: {overallStepsCompleted + 1} de {totalWorkoutSteps}
              </span>
            </div>
          </div>

          {/* Quick step tick indicators for current phase/round */}
          <div className="flex items-center gap-1 pr-1">
            {activeItems.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 sm:w-2.5 h-6 sm:h-7 rounded-full transition-all duration-300 ${
                  idx < currentIndex
                    ? 'bg-emerald-500 shadow-sm'
                    : idx === currentIndex
                    ? currentPhase === 'warmup'
                      ? 'bg-amber-400 ring-2 ring-amber-400/50 scale-105'
                      : currentPhase === 'cooldown'
                      ? 'bg-teal-400 ring-2 ring-teal-400/50 scale-105'
                      : 'bg-cyan-400 ring-2 ring-cyan-400/50 scale-105'
                    : 'bg-slate-900 border border-slate-800'
                }`}
                title={`Ejercicio ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Reassuring Wake Lock Alert */}
        {showWakeLockNotice && isWakeLockActive && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-[11px] text-amber-300 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Modo Entrenamiento: pantalla siempre encendida.</span>
            </div>
            <button
              onClick={() => setShowWakeLockNotice(false)}
              className="text-amber-400/80 hover:text-white ml-2 text-xs font-bold"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* 1. INTERMISSION SCREEN (BETWEEN ROUNDS, CIRCUITS, OR PHASES) */}
      {isIntermission ? (
        <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl flex-1 flex flex-col items-center justify-center text-center space-y-5 my-2">
          <div className="w-20 h-20 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 flex items-center justify-center text-3xl shadow-lg glow-cyan animate-pulse">
            <Repeat className="w-10 h-10 stroke-[2.5]" />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              {intermissionInfo.subtitle}
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              {intermissionInfo.title}
            </h3>
            <p className="text-xs text-slate-300 mt-1 font-medium">
              Siguiente: <strong className="text-emerald-400">{intermissionInfo.nextName}</strong>
            </p>
          </div>

          <div className="bg-slate-950 px-8 py-4 rounded-3xl border border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Descanso restante
            </div>
            <div className="text-6xl sm:text-7xl font-black font-mono text-cyan-400 tracking-tighter">
              {formatTime(intermissionRemaining)}
            </div>
          </div>

          <button
            onClick={() => {
              setIsIntermission(false);
              playTap();
            }}
            className="w-full max-w-sm py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg glow-emerald transition active:scale-95"
          >
            Saltar descanso y continuar ya
          </button>
        </div>
      ) : isResting ? (
        /* 2. BRIEF REST BETWEEN EXERCISES */
        <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl flex-1 flex flex-col items-center justify-center text-center space-y-5 my-2">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-2xl animate-pulse">
            <TimerIcon className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Descanso Breve</div>
            <h3 className="text-2xl font-black text-white mt-1">Recupera el aliento</h3>
            <p className="text-xs text-slate-400 mt-1">Siguiente: {currentItem.name}</p>
          </div>
          <div className="text-6xl font-black font-mono text-emerald-400 tracking-tighter">
            {formatTime(restRemaining)}
          </div>
          <button
            onClick={() => {
              setIsResting(false);
              playTap();
            }}
            className="py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition active:scale-95"
          >
            Saltar descanso y empezar ya
          </button>
        </div>
      ) : (
        /* 3. MAIN WORKOUT CARD */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl flex-1 flex flex-col items-center justify-between text-center relative overflow-hidden my-2">
          {/* Top exercise tags & Switch mode */}
          <div className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800">
                {currentItem.category}
              </span>
              {currentPhase === 'warmup' && (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">
                  🔥 Calentamiento
                </span>
              )}
              {currentPhase === 'cooldown' && (
                <span className="text-[11px] font-bold text-teal-400 bg-teal-500/15 border border-teal-500/30 px-2.5 py-1 rounded-full">
                  🧘 Enfriamiento
                </span>
              )}
            </div>

            {/* Mode switch button */}
            <button
              onClick={toggleCurrentItemMode}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition border ${
                currentItem.currentMode === 'reps'
                  ? 'bg-emerald-950 border-emerald-800 text-emerald-400 hover:bg-emerald-900/50'
                  : 'bg-cyan-950 border-cyan-800 text-cyan-400 hover:bg-cyan-900/50'
              }`}
              title="Cambiar entre Repeticiones y Tiempo"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>{currentItem.currentMode === 'reps' ? 'Repeticiones' : 'Tiempo'}</span>
            </button>
          </div>

          {/* Exercise Name */}
          <div className="my-auto py-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              {currentItem.name}
            </h2>
            {currentItem.description && (
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                {currentItem.description}
              </p>
            )}
          </div>

          {/* DYNAMIC WORKOUT MODE DISPLAY */}
          <div className="w-full flex flex-col items-center justify-center my-auto py-2">
            {/* MODE A: REPETICIONES */}
            {currentItem.currentMode === 'reps' && (
              <div className="flex flex-col items-center space-y-3">
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => adjustValue(-1)}
                    className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition"
                    title="Restar repetición"
                  >
                    <Minus className="w-6 h-6" />
                  </button>

                  <div className="flex flex-col items-center">
                    <div className="text-7xl sm:text-8xl font-black text-emerald-400 font-mono tracking-tighter drop-shadow-md">
                      {currentItem.targetReps}
                    </div>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mt-1">
                      Repeticiones Objetivo
                    </div>
                  </div>

                  <button
                    onClick={() => adjustValue(1)}
                    className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition"
                    title="Sumar repetición"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                  <span>Haz tus repeticiones a tu ritmo y pulsa el botón verde al terminar</span>
                </div>
              </div>
            )}

            {/* MODE B: TEMPORIZADOR CIRCULAR */}
            {currentItem.currentMode === 'time' && (
              <div className="flex flex-col items-center space-y-4">
                <div className="relative flex items-center justify-center w-52 h-52">
                  <svg className="w-52 h-52 transform -rotate-90">
                    <circle
                      cx="104"
                      cy="104"
                      r="90"
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-slate-950"
                      fill="transparent"
                    />
                    <circle
                      cx="104"
                      cy="104"
                      r="90"
                      stroke="currentColor"
                      strokeWidth="10"
                      className={`${
                        currentPhase === 'warmup'
                          ? 'text-amber-400'
                          : currentPhase === 'cooldown'
                          ? 'text-teal-400'
                          : 'text-cyan-400'
                      } transition-all duration-1000 ease-linear`}
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  </svg>

                  <div className="absolute flex flex-col items-center text-center">
                    <span className="text-5xl font-black font-mono text-white tracking-tight">
                      {formatTime(timerRemaining)}
                    </span>
                    <span
                      className={`text-[11px] font-black uppercase tracking-wider mt-1 ${
                        timerRemaining === 0
                          ? 'text-emerald-400 animate-bounce'
                          : isTimerRunning
                          ? currentPhase === 'warmup'
                            ? 'text-amber-400'
                            : currentPhase === 'cooldown'
                            ? 'text-teal-400'
                            : 'text-cyan-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {timerRemaining === 0
                        ? '¡Terminado!'
                        : isTimerRunning
                        ? 'En marcha'
                        : 'Pausado'}
                    </span>
                  </div>
                </div>

                {/* Timer Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustValue(-2)}
                    className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold active:scale-95"
                    title="-10 segundos"
                  >
                    -10s
                  </button>

                  <button
                    onClick={() => {
                      playTap();
                      setIsTimerRunning(!isTimerRunning);
                    }}
                    className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 active:scale-95 transition shadow-md ${
                      isTimerRunning
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        : currentPhase === 'warmup'
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 glow-amber'
                        : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 glow-cyan'
                    }`}
                  >
                    {isTimerRunning ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    <span>{isTimerRunning ? 'Pausar' : 'Iniciar'}</span>
                  </button>

                  <button
                    onClick={() => {
                      playTap();
                      setIsTimerRunning(false);
                      setTimerRemaining(currentItem.targetTime);
                    }}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white active:scale-95"
                    title="Reiniciar tiempo"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => adjustValue(2)}
                    className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold active:scale-95"
                    title="+10 segundos"
                  >
                    +10s
                  </button>
                </div>

                {/* Auto advance toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-400 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={autoAdvanceOnTimer}
                    onChange={(e) => setAutoAdvanceOnTimer(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                  />
                  <span>Auto-avanzar al terminar el tiempo</span>
                </label>
              </div>
            )}
          </div>

          {/* GIANT ACTION BUTTON: FINISH STEP & NEXT */}
          <div className="w-full space-y-3 pt-3">
            <button
              onClick={handleCompleteStep}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 active:scale-[0.98] text-slate-950 font-black text-lg sm:text-xl uppercase tracking-wider shadow-xl glow-emerald transition-all flex items-center justify-center gap-3"
            >
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              <span>
                {overallStepsCompleted >= totalWorkoutSteps - 1
                  ? '¡Finalizar Entrenamiento!'
                  : currentPhase === 'warmup'
                  ? 'Terminar Calentamiento → Ir a Circuitos'
                  : currentPhase === 'cooldown'
                  ? 'Terminar Enfriamiento → Finalizar'
                  : 'Terminado · Siguiente'}
              </span>
              {overallStepsCompleted < totalWorkoutSteps - 1 && (
                <ChevronRight className="w-6 h-6 stroke-[3]" />
              )}
            </button>

            {/* Secondary controls (Previous / Skip) */}
            <div className="flex justify-between items-center px-1">
              <button
                onClick={handlePrevStep}
                disabled={currentIndex === 0 && overallStepsCompleted === 0}
                className={`text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1 py-1.5 px-2 rounded-lg ${
                  currentIndex === 0 && overallStepsCompleted === 0
                    ? 'opacity-30 cursor-not-allowed'
                    : 'active:scale-95'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              {/* Rest interval picker indicator */}
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>Descanso:</span>
                <select
                  value={restDuration}
                  onChange={(e) => setRestDuration(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-emerald-400 focus:outline-none"
                >
                  <option value={0}>0s (Directo)</option>
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={45}>45s</option>
                  <option value={60}>60s</option>
                </select>
              </div>

              <button
                onClick={handleSkipStep}
                className="text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1 py-1.5 px-2 rounded-lg active:scale-95"
              >
                <span>Omitir</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
