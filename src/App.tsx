import { useState, useEffect } from 'react';
import {
  Exercise,
  RoutineItem,
  SavedRoutine,
  WorkoutHistoryItem,
  ExerciseCategory,
  WorkoutPhase,
} from './types';
import { DEFAULT_EXERCISES, PRESET_ROUTINES } from './data/defaultExercises';
import WorkoutPlayer from './components/WorkoutPlayer';
import WorkoutSummary from './components/WorkoutSummary';
import ExerciseManagerModal from './components/ExerciseManagerModal';
import AndroidPwaModal from './components/AndroidPwaModal';
import RoutinesAndHistoryModal from './components/RoutinesAndHistoryModal';
import WeeklyConsistencyChart from './components/WeeklyConsistencyChart';
import GoogleSheetsSyncModal from './components/GoogleSheetsSyncModal';
import SendRoutineModal from './components/SendRoutineModal';
import { getAccessToken } from './services/firebaseAuth';
import { appendWorkoutToSheet } from './services/googleSheets';
import {
  Play,
  Sliders,
  Smartphone,
  BookmarkCheck,
  Search,
  Check,
  Plus,
  Minus,
  Repeat,
  Volume2,
  VolumeX,
  ArrowUpDown,
  Trash2,
  ArrowUp,
  ArrowDown,
  Dumbbell,
  Clock,
  Sparkles,
  Shuffle,
  Download,
  TrendingUp,
  FileSpreadsheet,
  QrCode,
  Layers,
  Send,
  Flame,
  HeartPulse,
  CheckCircle,
  ArrowRight,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import {
  playTap,
  triggerHaptic,
  setSoundMuted,
  getSoundMuted,
  initAudioContext,
} from './utils/sound';

export default function App() {
  // 1. Catalog State
  const [catalog, setCatalog] = useState<Exercise[]>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_catalog');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_EXERCISES;
  });

  // 2. Selected Routine Items (Order matters!)
  // Initialize with the user's 6 example exercises by default for immediate testing
  const [selectedRoutine, setSelectedRoutine] = useState<RoutineItem[]>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_active_routine');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return PRESET_ROUTINES[0].items;
  });

  // 3. Saved custom routines
  const [savedRoutines, setSavedRoutines] = useState<SavedRoutine[]>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_saved_routines');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // 4. History
  const [history, setHistory] = useState<WorkoutHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // 5. Sound toggle
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fittrainer_sound_muted') === 'true';
    } catch {
      return false;
    }
  });

  // View state: 'builder' | 'player' | 'summary'
  const [currentView, setCurrentView] = useState<'builder' | 'player' | 'summary'>('builder');

  // Summary data for completed session
  const [lastSessionData, setLastSessionData] = useState<{
    durationSeconds: number;
    completedCount: number;
    totalCount: number;
    roundsCompleted?: number;
    circuitCount?: number;
    items: { name: string; mode: 'reps' | 'time'; target: number; completed: boolean }[];
  } | null>(null);

  // Builder filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [builderTab, setBuilderTab] = useState<'catalog' | 'routine'>('catalog');
  const [routineSectionFilter, setRoutineSectionFilter] = useState<
    'all' | 'warmup' | 'c1' | 'c2' | 'cooldown'
  >('all');

  // Modals & Inline Views
  const [showManager, setShowManager] = useState(false);
  const [editingExerciseIdForManager, setEditingExerciseIdForManager] = useState<string | null>(null);
  const [showRoutines, setShowRoutines] = useState(false);
  const [showPwa, setShowPwa] = useState(false);
  const [showChartInline, setShowChartInline] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [incomingToast, setIncomingToast] = useState<string | null>(null);
  // Routine backup and protection against accidental loss
  const [lastRoutineBackup, setLastRoutineBackup] = useState<RoutineItem[] | null>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_last_routine_backup');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return null;
  });

  const saveRoutineBackup = (items: RoutineItem[]) => {
    if (items && items.length > 0) {
      setLastRoutineBackup(items);
      try {
        localStorage.setItem('fittrainer_last_routine_backup', JSON.stringify(items));
      } catch {}
    }
  };

  const handleRestoreBackup = () => {
    if (!lastRoutineBackup || lastRoutineBackup.length === 0) return;
    playTap();
    const current = selectedRoutine;
    setSelectedRoutine(lastRoutineBackup);
    saveRoutineBackup(current);
    setIncomingToast(`¡Rutina recuperada con éxito! Se han restaurado tus ${lastRoutineBackup.length} ejercicios.`);
  };

  // Circuit Training Configuration (e.g. 2 circuits with 2 rounds each = 4 circuits)
  const [circuitCount, setCircuitCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_circuit_count');
      return saved ? Number(saved) : 2;
    } catch {
      return 2;
    }
  });

  const [rounds, setRounds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_rounds');
      return saved ? Number(saved) : 2;
    } catch {
      return 2;
    }
  });

  const [restBetweenRounds, setRestBetweenRounds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_rest_between_rounds');
      return saved ? Number(saved) : 45;
    } catch {
      return 45;
    }
  });

  const [autoSyncSheets, setAutoSyncSheets] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_sheets_autosync');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [targetCircuitMode, setTargetCircuitMode] = useState<'all' | 1 | 2>(() => {
    try {
      const saved = localStorage.getItem('fittrainer_target_circuit_mode');
      return (saved === '1' ? 1 : saved === '2' ? 2 : 'all') as 'all' | 1 | 2;
    } catch {
      return 'all';
    }
  });

  const [activeTargetDestination, setActiveTargetDestination] = useState<
    'warmup' | 'c1' | 'c2' | 'cooldown'
  >('c1');

  // Sync circuit settings to localStorage
  useEffect(() => {
    localStorage.setItem('fittrainer_circuit_count', String(circuitCount));
  }, [circuitCount]);

  useEffect(() => {
    localStorage.setItem('fittrainer_rounds', String(rounds));
  }, [rounds]);

  useEffect(() => {
    localStorage.setItem('fittrainer_rest_between_rounds', String(restBetweenRounds));
  }, [restBetweenRounds]);

  useEffect(() => {
    localStorage.setItem('fittrainer_target_circuit_mode', String(targetCircuitMode));
  }, [targetCircuitMode]);

  // Sync autoSyncSheets to localStorage
  useEffect(() => {
    localStorage.setItem('fittrainer_sheets_autosync', String(autoSyncSheets));
  }, [autoSyncSheets]);

  // Read incoming prepared routine from URL (QR Scan or WhatsApp Link from PC)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const rParam = params.get('r');
      const eParam = params.get('e');
      const routineParam = params.get('routine');

      // NEW ULTRA-COMPACT FORMAT: ?r=circuitCount,rounds,rest&e=exId:dest:target,...
      if (eParam) {
        const [cStr, rStr, bStr] = (rParam || '2,2,45').split(',');
        const newCircuitCount = Number(cStr) || 2;
        const newRounds = Number(rStr) || 2;
        const newRest = Number(bStr) || 45;

        const entries = eParam.split(',').filter(Boolean);
        const restored: RoutineItem[] = entries.map((entry, idx) => {
          // format: exId:dest:mode_target (e.g. ex-pecho-1:c1:r15 or ex-cal-1:w:t600)
          const parts = entry.split(':');
          const eId = parts[0];
          const destCode = parts[1] || 'c1';
          const targetCode = parts[2] || 'r12';

          const exDef =
            catalog.find((c) => c.id === eId) ||
            DEFAULT_EXERCISES.find((c) => c.id === eId);

          const phase: WorkoutPhase =
            destCode === 'w' ? 'warmup' : destCode === 'k' || destCode === 'c' ? 'cooldown' : 'main';
          const circuit = destCode === 'c2' ? 2 : 1;
          const isTime = targetCode.startsWith('t');
          const targetVal = Number(targetCode.slice(1)) || (isTime ? 30 : 12);
          const mode: 'reps' | 'time' = isTime ? 'time' : 'reps';

          return {
            id: `routine-imported-${Date.now()}-${idx}`,
            exerciseId: eId || `ex-${idx}`,
            name: exDef?.name || `Ejercicio ${idx + 1}`,
            category: exDef?.category || 'Full Body',
            allowedMode: exDef?.mode || 'both',
            currentMode: mode,
            targetReps: mode === 'reps' ? targetVal : (exDef?.defaultReps || 12),
            targetTime: mode === 'time' ? targetVal : (exDef?.defaultTime || 30),
            circuit,
            phase,
          };
        });

        if (restored.length > 0) {
          setSelectedRoutine(restored);
          setCircuitCount(newCircuitCount);
          setRounds(newRounds);
          setRestBetweenRounds(newRest);
          localStorage.setItem('fittrainer_active_routine', JSON.stringify(restored));
          localStorage.setItem('fittrainer_circuit_count', String(newCircuitCount));
          localStorage.setItem('fittrainer_rounds', String(newRounds));
          localStorage.setItem('fittrainer_rest_between_rounds', String(newRest));

          setIncomingToast(
            `¡Rutina del ordenador cargada en tu Pixel! ${restored.length} ejercicios (${newCircuitCount} circuitos × ${newRounds} vueltas). ¡Lista para entrenar!`
          );
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
      }

      // LEGACY FORMAT: ?routine=base64
      if (routineParam) {
        const json = decodeURIComponent(escape(atob(decodeURIComponent(routineParam))));
        const parsed = JSON.parse(json);
        if (parsed) {
          let restored: RoutineItem[] = [];
          if (Array.isArray(parsed.i) && parsed.i.length > 0) {
            restored = parsed.i.map((arr: any, idx: number) => {
              const [eId, isTime, target, cir, phCode] = arr;
              const exDef =
                catalog.find((c) => c.id === eId) ||
                DEFAULT_EXERCISES.find((c) => c.id === eId);
              const phase: WorkoutPhase =
                phCode === 'w' ? 'warmup' : phCode === 'c' ? 'cooldown' : 'main';
              const mode: 'reps' | 'time' = isTime === 1 ? 'time' : 'reps';
              return {
                id: `routine-imported-${Date.now()}-${idx}`,
                exerciseId: eId || `ex-${idx}`,
                name: exDef?.name || `Ejercicio ${idx + 1}`,
                category: exDef?.category || 'Full Body',
                allowedMode: exDef?.mode || 'both',
                currentMode: mode,
                targetReps: mode === 'reps' ? target : (exDef?.defaultReps || 12),
                targetTime: mode === 'time' ? target : (exDef?.defaultTime || 30),
                circuit: cir || 1,
                phase,
              };
            });
          } else if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            restored = parsed.items.map((it: any, idx: number) => ({
              id: `routine-imported-${Date.now()}-${idx}`,
              exerciseId: it.eId || `ex-${idx}`,
              name: it.name,
              category: it.cat || 'Full Body',
              allowedMode: 'both',
              currentMode: it.m || 'reps',
              targetReps: it.reps || 12,
              targetTime: it.time || 45,
              circuit: it.cir || (idx < Math.ceil(parsed.items.length / 2) ? 1 : 2),
              phase: (it.ph as WorkoutPhase) || 'main',
            }));
          }

          if (restored.length > 0) {
            setSelectedRoutine(restored);
            if (parsed.c) setCircuitCount(parsed.c);
            if (parsed.r) setRounds(parsed.r);
            if (parsed.b) setRestBetweenRounds(parsed.b);
            localStorage.setItem('fittrainer_active_routine', JSON.stringify(restored));
            setIncomingToast(
              `¡Rutina del ordenador recibida con éxito! ${restored.length} ejercicios (${parsed.c || 2} circuitos × ${parsed.r || 2} vueltas). Lista para entrenar.`
            );
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      }
    } catch (err) {
      console.warn('Could not parse incoming routine from URL:', err);
    }
  }, []);

  // Sync catalog to localStorage
  useEffect(() => {
    localStorage.setItem('fittrainer_catalog', JSON.stringify(catalog));
  }, [catalog]);

  // Sync selected routine to localStorage
  useEffect(() => {
    localStorage.setItem('fittrainer_active_routine', JSON.stringify(selectedRoutine));
  }, [selectedRoutine]);

  // Sync saved routines to localStorage
  useEffect(() => {
    localStorage.setItem('fittrainer_saved_routines', JSON.stringify(savedRoutines));
  }, [savedRoutines]);

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem('fittrainer_history', JSON.stringify(history));
  }, [history]);

  // Sync sound mute setting
  useEffect(() => {
    setSoundMuted(isMuted);
    localStorage.setItem('fittrainer_sound_muted', String(isMuted));
  }, [isMuted]);

  // Toggle or add exercise in routine according to active destination or specific target
  const toggleSelectExercise = (
    ex: Exercise,
    specificDestination?: 'warmup' | 'c1' | 'c2' | 'cooldown'
  ) => {
    initAudioContext();
    playTap();
    triggerHaptic(25);

    const dest = specificDestination || activeTargetDestination;

    // Check if an instance of this exercise exists in the target destination
    const existingIndex = selectedRoutine.findIndex((item) => {
      if (item.exerciseId !== ex.id) return false;
      if (dest === 'warmup') return item.phase === 'warmup';
      if (dest === 'cooldown') return item.phase === 'cooldown';
      if (dest === 'c1') return (!item.phase || item.phase === 'main') && (item.circuit || 1) === 1;
      if (dest === 'c2') return (!item.phase || item.phase === 'main') && item.circuit === 2;
      return false;
    });

    if (existingIndex >= 0) {
      // Toggle off: remove this instance from this destination
      setSelectedRoutine((prev) => prev.filter((_, idx) => idx !== existingIndex));
    } else {
      // Add new instance to destination
      const initialMode = ex.mode === 'time' ? 'time' : 'reps';
      const phase: WorkoutPhase =
        dest === 'warmup' ? 'warmup' : dest === 'cooldown' ? 'cooldown' : 'main';
      const circuit = dest === 'c2' ? 2 : 1;

      const newItem: RoutineItem = {
        id: `routine-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        exerciseId: ex.id,
        name: ex.name,
        category: ex.category,
        allowedMode: ex.mode,
        currentMode: initialMode,
        targetReps: ex.defaultReps || 12,
        targetTime: ex.defaultTime || 30,
        description: ex.description,
        circuit,
        phase,
      };

      // If user adds to C2, automatically ensure circuitCount is 2 so C2 is active
      if (dest === 'c2' && circuitCount < 2) {
        setCircuitCount(2);
      }

      setSelectedRoutine((prev) => [...prev, newItem]);
    }
  };

  // Reorder items cleanly within their respective section (warmup, c1, c2, cooldown)
  const moveItemWithinSection = (itemId: string, direction: 'up' | 'down') => {
    playTap();
    triggerHaptic(20);

    setSelectedRoutine((prev) => {
      const item = prev.find((i) => i.id === itemId);
      if (!item) return prev;

      const isWarmup = item.phase === 'warmup';
      const isCooldown = item.phase === 'cooldown';
      const isC2 = (!item.phase || item.phase === 'main') && item.circuit === 2;

      const sectionItems = prev.filter((i) => {
        if (isWarmup) return i.phase === 'warmup';
        if (isCooldown) return i.phase === 'cooldown';
        if (isC2) return (!i.phase || i.phase === 'main') && i.circuit === 2;
        return (!i.phase || i.phase === 'main') && (i.circuit || 1) === 1;
      });

      const sectionIndex = sectionItems.findIndex((i) => i.id === itemId);
      if (sectionIndex < 0) return prev;

      const targetSectionIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
      if (targetSectionIndex < 0 || targetSectionIndex >= sectionItems.length) return prev;

      const targetSibling = sectionItems[targetSectionIndex];

      const originalIndexA = prev.findIndex((i) => i.id === itemId);
      const originalIndexB = prev.findIndex((i) => i.id === targetSibling.id);

      if (originalIndexA < 0 || originalIndexB < 0) return prev;

      const copy = [...prev];
      copy[originalIndexA] = targetSibling;
      copy[originalIndexB] = item;
      return copy;
    });
  };

  // Set phase for routine item ('warmup' | 'main' | 'cooldown')
  const setItemPhase = (exerciseId: string, phase: WorkoutPhase) => {
    playTap();
    triggerHaptic(20);
    setSelectedRoutine((prev) =>
      prev.map((item) => {
        if (item.exerciseId !== exerciseId) return item;
        return { ...item, phase };
      })
    );
  };

  // Toggle item between Circuito 1 and Circuito 2
  const toggleItemCircuit = (exerciseId: string) => {
    playTap();
    triggerHaptic(20);
    setSelectedRoutine((prev) =>
      prev.map((item) => {
        if (item.exerciseId !== exerciseId) return item;
        const next = (item.circuit || 1) === 1 ? 2 : 1;
        return { ...item, circuit: next };
      })
    );
  };

  // Directly assign item to Circuit 1 or Circuit 2
  const setItemCircuit = (exerciseId: string, circuit: number) => {
    playTap();
    triggerHaptic(20);
    setSelectedRoutine((prev) =>
      prev.map((item) => {
        if (item.exerciseId !== exerciseId) return item;
        return { ...item, circuit, phase: 'main' };
      })
    );
  };

  // Adjust routine item values
  const adjustRoutineItem = (exerciseId: string, delta: number) => {
    playTap();
    triggerHaptic(20);
    setSelectedRoutine((prev) =>
      prev.map((item) => {
        if (item.exerciseId !== exerciseId) return item;
        if (item.currentMode === 'reps') {
          return { ...item, targetReps: Math.max(1, item.targetReps + delta) };
        } else {
          return { ...item, targetTime: Math.max(5, item.targetTime + delta * 5) };
        }
      })
    );
  };

  // Switch mode between reps and time for an item
  const switchRoutineItemMode = (exerciseId: string) => {
    playTap();
    triggerHaptic(20);
    setSelectedRoutine((prev) =>
      prev.map((item) => {
        if (item.exerciseId !== exerciseId) return item;
        const newMode = item.currentMode === 'reps' ? 'time' : 'reps';
        return { ...item, currentMode: newMode };
      })
    );
  };

  // Reorder items in selected routine
  const moveItem = (index: number, direction: 'up' | 'down') => {
    playTap();
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedRoutine.length) return;

    setSelectedRoutine((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[newIndex];
      copy[newIndex] = temp;
      return copy;
    });
  };

  const removeRoutineItemByIndex = (index: number) => {
    playTap();
    setSelectedRoutine((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearRoutine = () => {
    playTap();
    if (selectedRoutine.length === 0) return;
    if (
      window.confirm(
        `¿Deseas desmarcar los ${selectedRoutine.length} ejercicios de tu rutina? Se guardará una copia para que puedas recuperarla si quieres.`
      )
    ) {
      saveRoutineBackup(selectedRoutine);
      setSelectedRoutine([]);
      setIncomingToast('Rutina desmarcada. Puedes pulsar "↺ Restaurar" para recuperarla.');
    }
  };

  // Generate balanced routine of N exercises (e.g. 6 or 7)
  const generateBalancedRoutine = (targetCount: number) => {
    if (selectedRoutine.length > 0) {
      const ok = window.confirm(
        `Tienes ${selectedRoutine.length} ejercicios en tu rutina actual.\n\n¿Deseas sustituirlos por una selección automática de ${targetCount} ejercicios?\n(Se guardará una copia de seguridad para que puedas recuperarla).`
      );
      if (!ok) return;
      saveRoutineBackup(selectedRoutine);
    }

    initAudioContext();
    playTap();
    triggerHaptic(30);

    const priorityCategories = [
      'Pecho',
      'Piernas',
      'Espalda',
      'Core',
      'Cardio',
      'Hombros',
      'Brazos',
      'Full Body',
    ];

    const chosen: Exercise[] = [];
    const usedIds = new Set<string>();

    // Pass 1: One from each muscle group
    for (const cat of priorityCategories) {
      if (chosen.length >= targetCount) break;
      const candidates = catalog.filter((ex) => ex.category.toLowerCase() === cat.toLowerCase() && !usedIds.has(ex.id));
      if (candidates.length > 0) {
        const randomEx = candidates[Math.floor(Math.random() * candidates.length)];
        chosen.push(randomEx);
        usedIds.add(randomEx.id);
      }
    }

    // Pass 2: Fill remaining if needed
    const remaining = catalog.filter((ex) => !usedIds.has(ex.id));
    while (chosen.length < targetCount && remaining.length > 0) {
      const idx = Math.floor(Math.random() * remaining.length);
      const randomEx = remaining.splice(idx, 1)[0];
      chosen.push(randomEx);
      usedIds.add(randomEx.id);
    }

    const half = Math.ceil(chosen.length / 2);
    const newItems: RoutineItem[] = chosen.map((ex, index) => {
      const mode = ex.mode === 'both' ? (index % 2 === 0 ? 'reps' : 'time') : ex.mode === 'time' ? 'time' : 'reps';
      return {
        id: `routine-item-${Date.now()}-${index}`,
        exerciseId: ex.id,
        name: ex.name,
        category: ex.category,
        allowedMode: ex.mode,
        currentMode: mode,
        targetReps: ex.defaultReps || (mode === 'reps' ? 12 : 1),
        targetTime: ex.defaultTime || 45,
        description: ex.description,
        circuit: circuitCount === 2 ? (index < half ? 1 : 2) : 1,
      };
    });

    setSelectedRoutine(newItems);
  };

  // Start workout
  const handleStartWorkout = () => {
    if (selectedRoutine.length === 0) return;
    initAudioContext();
    playTap();
    triggerHaptic(40);
    setCurrentView('player');
  };

  // Finish workout from player
  const handleWorkoutFinished = (sessionData: {
    durationSeconds: number;
    completedCount: number;
    totalCount: number;
    items: { name: string; mode: 'reps' | 'time'; target: number; completed: boolean }[];
  }) => {
    setLastSessionData(sessionData);

    // Save to history
    const historyEntry: WorkoutHistoryItem = {
      id: `history-${Date.now()}`,
      date: new Date().toISOString(),
      durationSeconds: sessionData.durationSeconds,
      completedCount: sessionData.completedCount,
      totalCount: sessionData.totalCount,
      routineName: 'Entrenamiento Personalizado',
      items: sessionData.items,
    };
    setHistory((prev) => [historyEntry, ...prev]);

    // Auto-sync to Google Sheets if enabled
    if (autoSyncSheets) {
      getAccessToken().then((token) => {
        if (token) {
          try {
            const savedSheet = localStorage.getItem('fittrainer_sheets_ref');
            if (savedSheet) {
              const sheetRef = JSON.parse(savedSheet);
              appendWorkoutToSheet(token, sheetRef.id, historyEntry).catch((err) => {
                console.warn('Auto-sync to Google Sheets failed:', err);
              });
            }
          } catch (e) {
            console.warn('Error reading saved sheet ref:', e);
          }
        }
      });
    }

    setCurrentView('summary');
  };

  // Add exercise to catalog
  const handleAddExerciseToCatalog = (newEx: Exercise) => {
    setCatalog((prev) => [newEx, ...prev]);
  };

  const handleUpdateExerciseInCatalog = (updatedEx: Exercise) => {
    setCatalog((prev) => prev.map((ex) => (ex.id === updatedEx.id ? updatedEx : ex)));
    // Also synchronize any active items in current routine
    setSelectedRoutine((prev) =>
      prev.map((item) => {
        if (item.exerciseId === updatedEx.id) {
          return {
            ...item,
            name: updatedEx.name,
            category: updatedEx.category,
          };
        }
        return item;
      })
    );
  };

  const handleDeleteExerciseFromCatalog = (id: string) => {
    setCatalog((prev) => prev.filter((ex) => ex.id !== id));
    setSelectedRoutine((prev) => prev.filter((item) => item.exerciseId !== id));
  };

  const handleResetCatalog = () => {
    setCatalog(DEFAULT_EXERCISES);
  };

  const handleImportCatalog = (imported: Exercise[]) => {
    setCatalog(imported);
  };

  // Save current routine with name
  const handleSaveRoutine = (name: string) => {
    const newSaved: SavedRoutine = {
      id: `routine-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      items: selectedRoutine,
    };
    setSavedRoutines((prev) => [newSaved, ...prev]);
  };

  const handleDeleteSavedRoutine = (id: string) => {
    setSavedRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  const handleLoadRoutine = (items: RoutineItem[]) => {
    setSelectedRoutine(items);
  };

  // Seed sample data for 7-day consistency chart demonstration
  const seedSampleHistory = () => {
    playTap();
    const now = new Date();
    const sampleItems: WorkoutHistoryItem[] = [];

    const pastDaysOffsets = [0, 1, 3, 4, 6];
    const dayDataTemplates = [
      { exercises: 6, duration: 740, name: 'Rutina Torso & Core' },
      { exercises: 7, duration: 890, name: 'Fuerza Calistenia Total' },
      { exercises: 6, duration: 710, name: 'Piernas & Glúteos' },
      { exercises: 5, duration: 520, name: 'Core Express 5 min' },
      { exercises: 7, duration: 920, name: 'Full Body & HIIT' },
    ];

    pastDaysOffsets.forEach((offset, idx) => {
      const d = new Date(now);
      d.setDate(now.getDate() - offset);
      d.setHours(10 + idx, 15 + idx * 5, 0, 0);

      const template = dayDataTemplates[idx % dayDataTemplates.length];
      sampleItems.push({
        id: `history-sample-${offset}-${Date.now()}`,
        date: d.toISOString(),
        durationSeconds: template.duration,
        completedCount: template.exercises,
        totalCount: template.exercises,
        routineName: template.name,
        items: Array.from({ length: template.exercises }).map((_, i) => ({
          name: `Ejercicio ${i + 1}`,
          mode: i % 2 === 0 ? 'reps' : 'time',
          target: i % 2 === 0 ? 12 : 60,
          completed: true,
        })),
      });
    });

    setHistory((prev) => [...sampleItems, ...prev]);
  };

  // Category list with counts
  const categories: ExerciseCategory[] = [
    'Pecho',
    'Espalda',
    'Piernas',
    'Core',
    'Hombros',
    'Brazos',
    'Cardio',
    'Full Body',
  ];

  const filteredExercises = catalog.filter((ex) => {
    const matchesSearch =
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ex.description && ex.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'Todos' || ex.category.toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  // Calculate phase counts and estimated total routine time
  const warmupItems = selectedRoutine.filter((i) => i.phase === 'warmup');
  const cooldownItems = selectedRoutine.filter((i) => i.phase === 'cooldown');
  const mainCircuitItems = selectedRoutine.filter((i) => !i.phase || i.phase === 'main');

  const warmupSeconds = warmupItems.reduce((acc, item) => {
    return acc + (item.currentMode === 'time' ? item.targetTime : item.targetReps * 3);
  }, 0);

  const cooldownSeconds = cooldownItems.reduce((acc, item) => {
    return acc + (item.currentMode === 'time' ? item.targetTime : item.targetReps * 3);
  }, 0);

  const activeMainItems =
    circuitCount === 2
      ? targetCircuitMode === 1
        ? mainCircuitItems.filter((i) => (i.circuit || 1) === 1)
        : targetCircuitMode === 2
        ? mainCircuitItems.filter((i) => i.circuit === 2)
        : mainCircuitItems
      : mainCircuitItems;

  const mainSeconds =
    activeMainItems.reduce((acc, item) => {
      return acc + (item.currentMode === 'time' ? item.targetTime : item.targetReps * 3);
    }, 0) * rounds;

  const estimatedTotalSeconds = warmupSeconds + mainSeconds + cooldownSeconds;

  const formatEstimatedTime = (sec: number) => {
    const m = Math.ceil(sec / 60);
    return `~${m} min`;
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      
      {/* HEADER NAVEGACIÓN MÓVIL ANDROID */}
      <header className="border-b border-slate-800/90 bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-4 py-2.5">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          
          {/* Logo & Subtítulo */}
          <div
            onClick={() => {
              playTap();
              if (currentView !== 'builder') {
                if (window.confirm('¿Volver a la selección de ejercicios?')) {
                  setCurrentView('builder');
                }
              }
            }}
            className="flex items-center space-x-2.5 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-400 flex items-center justify-center text-slate-950 shadow-md">
              <Dumbbell className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base tracking-tight text-white leading-none">
                FitTrainer Mobile
              </h1>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                Entrenador Android
              </span>
            </div>
          </div>

          {/* Botones de Utilidades y Ajustes */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Sonido toggle */}
            <button
              onClick={() => {
                playTap();
                setIsMuted(!isMuted);
              }}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 active:scale-95 transition"
              title={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Rutinas & Historial */}
            <button
              onClick={() => {
                playTap();
                setShowRoutines(true);
              }}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 active:scale-95 transition relative"
              title="Rutinas e Historial"
            >
              <BookmarkCheck className="w-4 h-4 text-cyan-400" />
            </button>

            {/* Gestor de Catálogo */}
            <button
              onClick={() => {
                playTap();
                setShowManager(true);
              }}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 active:scale-95 transition"
              title="Gestionar Catálogo de Ejercicios"
            >
              <Sliders className="w-4 h-4 text-slate-300" />
            </button>

            {/* Google Sheets Sync Modal */}
            <button
              onClick={() => {
                playTap();
                setShowSheetsModal(true);
              }}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-slate-700/80 active:scale-95 transition flex items-center gap-1.5"
              title="Google Sheets & Pixel Sync"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-bold">Sheets</span>
            </button>

            {/* PWA / Android Install button prominently */}
            <button
              onClick={() => {
                playTap();
                setShowPwa(true);
              }}
              className="flex items-center gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 text-emerald-300 border border-emerald-500/50 font-black text-xs active:scale-95 transition shadow-sm"
              title="Crear icono en la pantalla de inicio de tu teléfono móvil"
            >
              <Smartphone className="w-4 h-4 stroke-[2.5] text-emerald-400 shrink-0" />
              <span>Crear Icono Móvil</span>
            </button>
          </div>

        </div>
      </header>

      {/* VISTAS PRINCIPALES */}
      <main className="flex-1 flex flex-col w-full">
        {currentView === 'player' && (
          <WorkoutPlayer
            routine={selectedRoutine}
            rounds={rounds}
            circuitCount={circuitCount}
            targetCircuit={targetCircuitMode}
            restBetweenRounds={restBetweenRounds}
            onFinish={handleWorkoutFinished}
            onCancel={() => setCurrentView('builder')}
            isSoundMuted={isMuted}
            onToggleSound={() => setIsMuted(!isMuted)}
          />
        )}

        {currentView === 'summary' && lastSessionData && (
          <WorkoutSummary
            sessionData={lastSessionData}
            onRestart={() => setCurrentView('player')}
            onBackToBuilder={() => setCurrentView('builder')}
            onOpenSheetsModal={() => setShowSheetsModal(true)}
          />
        )}

        {currentView === 'builder' && (
          <div className="flex-1 max-w-xl sm:max-w-3xl lg:max-w-4xl w-full mx-auto p-3.5 sm:p-6 flex flex-col space-y-5 pb-44">
            
            {/* INCOMING TOAST: RUTINA RECIBIDA DEL ORDENADOR */}
            {incomingToast && (
              <div className="bg-emerald-950/80 border border-emerald-500/50 p-3.5 rounded-2xl flex items-center justify-between gap-2 shadow-lg animate-fadeIn text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[3]" />
                  <span className="font-semibold">{incomingToast}</span>
                </div>
                <button
                  onClick={() => setIncomingToast(null)}
                  className="text-emerald-400 hover:text-white text-xs font-bold px-2 py-1 rounded"
                >
                  OK
                </button>
              </div>
            )}

            {/* HERO SUMMARY CARD: Rutina de hoy & Iniciar */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Rutina de Hoy · Gimnasio</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  <span className="text-emerald-400 font-mono">{selectedRoutine.length}</span> ejercicios
                </div>

                {/* Phase breakdown tags */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {warmupItems.length > 0 && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>{warmupItems.length} Calentamiento</span>
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-400" />
                    <span>
                      {mainCircuitItems.length} en {circuitCount} {circuitCount === 1 ? 'circuito' : 'circuitos'} ({circuitCount * rounds} en total)
                    </span>
                  </span>
                  {cooldownItems.length > 0 && (
                    <span className="text-[10px] font-bold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <HeartPulse className="w-3 h-3 text-teal-400" />
                      <span>{cooldownItems.length} Enfriamiento</span>
                    </span>
                  )}
                </div>

                {selectedRoutine.length > 0 && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Tiempo total estimado: <strong className="text-white">{formatEstimatedTime(estimatedTotalSeconds)}</strong></span>
                  </div>
                )}
              </div>

              {/* Botones de acción principales */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    playTap();
                    setShowSendModal(true);
                  }}
                  disabled={selectedRoutine.length === 0}
                  className="flex-1 sm:flex-none py-3.5 px-3.5 rounded-2xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                  title="Dejar listo para el Polideportivo (Código QR o WhatsApp)"
                >
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span>Al Móvil</span>
                </button>

                <button
                  onClick={handleStartWorkout}
                  disabled={selectedRoutine.length === 0}
                  className={`flex-1 sm:flex-none px-6 py-3.5 sm:py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                    selectedRoutine.length > 0
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 text-slate-950 glow-emerald active:scale-95 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Entrenar</span>
                </button>
              </div>
            </div>

            {/* PANEL DE CONTROL DE CIRCUITOS Y REPETICIONES / VUELTAS */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Estructura de Circuitos y Vueltas (Polideportivo)</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold font-mono">
                  {circuitCount * rounds} circuitos en total
                </span>
              </div>

              {/* Selector 1 o 2 Circuitos */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    playTap();
                    setCircuitCount(1);
                    setTargetCircuitMode('all');
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 ${
                    circuitCount === 1
                      ? 'bg-slate-950 border-emerald-500/70 text-emerald-400 shadow-sm ring-1 ring-emerald-500/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>1 Circuito Continuo</span>
                </button>

                <button
                  onClick={() => {
                    playTap();
                    setCircuitCount(2);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 ${
                    circuitCount === 2
                      ? 'bg-slate-950 border-cyan-500/70 text-cyan-400 shadow-sm ring-1 ring-cyan-500/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>2 Circuitos (Circuito 1 + 2)</span>
                </button>
              </div>

              {/* CUANDO HAY 2 CIRCUITOS: ELECCIÓN DE QUÉ CIRCUITO ENTRENAR HOY */}
              {circuitCount === 2 && (
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>¿Qué circuito entrenarás hoy?</span>
                    </span>
                    <span className="text-[10px] text-cyan-400 font-bold">
                      {targetCircuitMode === 'all'
                        ? 'Ambos (C1 + C2)'
                        : targetCircuitMode === 1
                        ? 'Solo Circuito 1'
                        : 'Solo Circuito 2'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        playTap();
                        setTargetCircuitMode('all');
                      }}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                        targetCircuitMode === 'all'
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black shadow-md ring-1 ring-cyan-400/50'
                          : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>⚡ Ambos</span>
                      <span className="text-[9px] opacity-80 font-normal">C1 + C2</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playTap();
                        setTargetCircuitMode(1);
                      }}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                        targetCircuitMode === 1
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-md ring-1 ring-emerald-400/50'
                          : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-300'
                      }`}
                    >
                      <span>🟢 Circuito 1</span>
                      <span className="text-[9px] opacity-80 font-normal">
                        {mainCircuitItems.filter((i) => (i.circuit || 1) === 1).length} ejerc.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playTap();
                        setTargetCircuitMode(2);
                      }}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                        targetCircuitMode === 2
                          ? 'bg-cyan-500 text-slate-950 font-black shadow-md ring-1 ring-cyan-400/50'
                          : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300'
                      }`}
                    >
                      <span>🔵 Circuito 2</span>
                      <span className="text-[9px] opacity-80 font-normal">
                        {mainCircuitItems.filter((i) => i.circuit === 2).length} ejerc.
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Selector de Vueltas / Repeticiones por circuito */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Vueltas / Repeticiones por cada circuito:</span>
                  <span className="text-white font-mono font-bold">{rounds} {rounds === 1 ? 'vuelta' : 'vueltas'}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        playTap();
                        setRounds(r);
                      }}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition active:scale-95 ${
                        rounds === r
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 text-slate-950 shadow-md'
                          : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {r} {r === 1 ? 'vuelta' : 'vueltas'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descanso entre vueltas */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-400">Descanso entre vueltas:</span>
                <div className="flex items-center gap-1.5">
                  {[30, 45, 60].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => {
                        playTap();
                        setRestBetweenRounds(sec);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                        restBetweenRounds === sec
                          ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border border-slate-850'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Explicación amigable */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                <span>
                  💡 Con <strong>{circuitCount} circuitos</strong> y <strong>{rounds} repeticiones</strong>, completarás <strong>{circuitCount * rounds} circuitos</strong>. Lo preparas en el ordenador y con 1 toque o QR lo tienes en tu Pixel.
                </span>
                <button
                  onClick={() => {
                    playTap();
                    setShowSendModal(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold shrink-0 hover:bg-cyan-500/25"
                >
                  Enviar al Móvil
                </button>
              </div>
            </div>

            {/* SELECTOR RÁPIDO: LIBERTAD TOTAL PARA ELEGIR 6, 7 O CUALQUIER NÚMERO */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>¿Cuántos ejercicios quieres hoy?</span>
                </span>
                {selectedRoutine.length > 0 && (
                  <button
                    onClick={clearRoutine}
                    className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Desmarcar todo</span>
                  </button>
                )}
              </div>

              {/* Botonera de elección rápida 5, 6, 7, 8, 10 o libre */}
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {[5, 6, 7, 8, 10].map((num) => {
                  const isActive = selectedRoutine.length === num;
                  return (
                    <button
                      key={num}
                      onClick={() => generateBalancedRoutine(num)}
                      className={`py-2 px-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center active:scale-95 ${
                        isActive
                          ? 'bg-gradient-to-tr from-emerald-500 to-cyan-400 text-slate-950 shadow-md ring-2 ring-emerald-400/50'
                          : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                      }`}
                      title={`Seleccionar ${num} ejercicios equilibrados`}
                    >
                      <span className="font-mono text-base leading-none font-black">{num}</span>
                      <span className="text-[9px] opacity-80 mt-0.5">ejercicios</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-400">Pulsa <strong>6</strong> o <strong>7</strong> para autogenerar, o márcalos a mano.</span>
                <button
                  onClick={() => {
                    playTap();
                    setShowChartInline(!showChartInline);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs transition active:scale-95 ${
                    showChartInline
                      ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{showChartInline ? 'Ocultar Gráfica' : 'Ver Gráfica Semanal'}</span>
                </button>
              </div>
            </div>

            {/* GRÁFICO DE CONSISTENCIA SEMANAL (RECHARTS) */}
            {showChartInline && (
              <WeeklyConsistencyChart
                history={history}
                onSeedSampleData={seedSampleHistory}
              />
            )}

            {/* Quick Presets Carousel */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider shrink-0">
                Carga rápida:
              </span>
              {PRESET_ROUTINES.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    playTap();
                    if (selectedRoutine.length > 0) {
                      const ok = window.confirm(
                        `Tienes ${selectedRoutine.length} ejercicios en tu rutina actual.\n\n¿Deseas sustituirlos por "${preset.name}"?\n(Se guardará una copia para recuperarla).`
                      );
                      if (!ok) return;
                      saveRoutineBackup(selectedRoutine);
                    }
                    setSelectedRoutine(preset.items);
                    if (preset.circuitCount) setCircuitCount(preset.circuitCount);
                    if (preset.rounds) setRounds(preset.rounds);
                    if (preset.restBetweenRounds) setRestBetweenRounds(preset.restBetweenRounds);
                    setIncomingToast(`¡Cargada "${preset.name}"! (${preset.items.length} ejercicios).`);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-white shrink-0 text-xs font-semibold active:scale-95 transition"
                >
                  {preset.name}
                </button>
              ))}
            </div>

            {/* UNDO / RESTORE BACKUP BANNER */}
            {lastRoutineBackup && lastRoutineBackup.length > 0 && selectedRoutine.length !== lastRoutineBackup.length && (
              <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40 border-2 border-amber-500/50 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs shadow-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/40">
                    <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-white block">
                      ¿Restaurar tu rutina anterior?
                    </span>
                    <span className="text-[11px] text-amber-200/90 truncate block">
                      Copia guardada con <strong>{lastRoutineBackup.length} ejercicios</strong> ({lastRoutineBackup.filter(i => (!i.phase || i.phase==='main') && (i.circuit||1)===1).length} en C1 + {lastRoutineBackup.filter(i => (!i.phase || i.phase==='main') && i.circuit===2).length} en C2).
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleRestoreBackup}
                  className="py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shrink-0 active:scale-95 transition shadow-md"
                >
                  ↺ Recuperar
                </button>
              </div>
            )}

            {/* VIEW MODE TABS: Catálogo vs Mi Rutina */}
            <div className="flex items-center bg-slate-900 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => {
                  playTap();
                  setBuilderTab('catalog');
                }}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition ${
                  builderTab === 'catalog'
                    ? 'bg-slate-950 text-emerald-400 shadow-sm border border-slate-800'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Catálogo de Ejercicios ({catalog.length})
              </button>
              <button
                onClick={() => {
                  playTap();
                  setBuilderTab('routine');
                }}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition ${
                  builderTab === 'routine'
                    ? 'bg-slate-950 text-cyan-400 shadow-sm border border-slate-800'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mi Rutina ({selectedRoutine.length})
              </button>
            </div>

            {/* TAB 1: CATÁLOGO */}
            {builderTab === 'catalog' && (
              <div className="space-y-3">
                {/* SELECTOR DE DESTINO ACTIVO (LÓGICA DEL USUARIO: C1 -> C2 -> CALENTAMIENTO -> ENFRIAMIENTO) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-3.5 space-y-2.5 shadow-md">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>¿A qué bloque añades ejercicios al pulsar?</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {activeTargetDestination === 'c1' && `Circuito 1 (${mainCircuitItems.filter((i) => (i.circuit || 1) === 1).length} ej.)`}
                      {activeTargetDestination === 'c2' && `Circuito 2 (${mainCircuitItems.filter((i) => i.circuit === 2).length} ej.)`}
                      {activeTargetDestination === 'warmup' && `Calentamiento (${warmupItems.length} ej.)`}
                      {activeTargetDestination === 'cooldown' && `Enfriamiento (${cooldownItems.length} ej.)`}
                    </span>
                  </div>

                  {/* Botones de Destino */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {/* Calentamiento */}
                    <button
                      type="button"
                      onClick={() => {
                        playTap();
                        setActiveTargetDestination('warmup');
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between active:scale-95 border ${
                        activeTargetDestination === 'warmup'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/40 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-amber-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>1. Calentam.</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                        {warmupItems.length}
                      </span>
                    </button>

                    {/* Circuito 1 */}
                    <button
                      type="button"
                      onClick={() => {
                        playTap();
                        setActiveTargetDestination('c1');
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between active:scale-95 border ${
                        activeTargetDestination === 'c1'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-emerald-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>2. Circuito 1</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                        {mainCircuitItems.filter((i) => (i.circuit || 1) === 1).length}
                      </span>
                    </button>

                    {/* Circuito 2 */}
                    <button
                      type="button"
                      onClick={() => {
                        playTap();
                        setActiveTargetDestination('c2');
                        if (circuitCount === 1) setCircuitCount(2);
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between active:scale-95 border ${
                        activeTargetDestination === 'c2'
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 ring-2 ring-cyan-500/40 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-cyan-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        <span>3. Circuito 2</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                        {mainCircuitItems.filter((i) => i.circuit === 2).length}
                      </span>
                    </button>

                    {/* Enfriamiento */}
                    <button
                      type="button"
                      onClick={() => {
                        playTap();
                        setActiveTargetDestination('cooldown');
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between active:scale-95 border ${
                        activeTargetDestination === 'cooldown'
                          ? 'bg-teal-500/20 border-teal-500 text-teal-300 ring-2 ring-teal-500/40 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-teal-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <HeartPulse className="w-3.5 h-3.5 text-teal-400" />
                        <span>4. Enfriam.</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800 font-bold">
                        {cooldownItems.length}
                      </span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {activeTargetDestination === 'c1' && 'Añadiendo al Circuito 1. Pulsa ejercicios abajo para sumarlos.'}
                        {activeTargetDestination === 'c2' && 'Añadiendo al Circuito 2. Pulsa ejercicios abajo para sumarlos.'}
                        {activeTargetDestination === 'warmup' && 'Añadiendo al Calentamiento (ej: bici 10-12 min).'}
                        {activeTargetDestination === 'cooldown' && 'Añadiendo al Enfriamiento (ej: remo 10-12 min).'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playTap();
                        setBuilderTab('routine');
                        setRoutineSectionFilter(activeTargetDestination);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shrink-0 flex items-center gap-1 transition active:scale-95 shadow-sm ml-auto"
                      title="Ver y ordenar los ejercicios de este bloque"
                    >
                      <span>Ver y ordenar {activeTargetDestination === 'c1' ? 'Circuito 1' : activeTargetDestination === 'c2' ? 'Circuito 2' : activeTargetDestination === 'warmup' ? 'Calentamiento' : 'Enfriamiento'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Botón para crear nuevo ejercicio */}
                <button
                  onClick={() => {
                    playTap();
                    setShowManager(true);
                  }}
                  className="w-full py-2.5 px-3.5 rounded-2xl bg-slate-900 border border-emerald-500/40 hover:border-emerald-500 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition shadow-sm"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Crear mi propio Ejercicio Nuevo</span>
                </button>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o músculo (ej: flexiones, plancha, piernas)..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Categorías Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <button
                    onClick={() => {
                      playTap();
                      setSelectedCategory('Todos');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                      selectedCategory === 'Todos'
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos ({catalog.length})
                  </button>
                  {categories.map((cat) => {
                    const count = catalog.filter((c) => c.category === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          playTap();
                          setSelectedCategory(cat);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                          selectedCategory === cat
                            ? 'bg-emerald-500 text-slate-950 font-black'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Exercise Cards Grid */}
                <div className="space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
                  {filteredExercises.length === 0 ? (
                    <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs text-slate-500">
                      No hay ejercicios que coincidan con la búsqueda.
                    </div>
                  ) : (
                    filteredExercises.map((ex) => {
                      const instances = selectedRoutine.filter((item) => item.exerciseId === ex.id);
                      const inWarmup = instances.some((item) => item.phase === 'warmup');
                      const inC1 = instances.some((item) => (!item.phase || item.phase === 'main') && (item.circuit || 1) === 1);
                      const inC2 = instances.some((item) => (!item.phase || item.phase === 'main') && item.circuit === 2);
                      const inCooldown = instances.some((item) => item.phase === 'cooldown');

                      const isInActiveDest =
                        activeTargetDestination === 'warmup'
                          ? inWarmup
                          : activeTargetDestination === 'c2'
                          ? inC2
                          : activeTargetDestination === 'cooldown'
                          ? inCooldown
                          : inC1;

                      const isSelectedAnywhere = instances.length > 0;
                      const activeItem = instances.find((item) => {
                        if (activeTargetDestination === 'warmup') return item.phase === 'warmup';
                        if (activeTargetDestination === 'cooldown') return item.phase === 'cooldown';
                        if (activeTargetDestination === 'c2') return (!item.phase || item.phase === 'main') && item.circuit === 2;
                        return (!item.phase || item.phase === 'main') && (item.circuit || 1) === 1;
                      }) || instances[0];

                      return (
                        <div
                          key={ex.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isInActiveDest
                              ? activeTargetDestination === 'c2'
                                ? 'bg-slate-900 border-cyan-500/70 shadow-md ring-1 ring-cyan-500/30'
                                : activeTargetDestination === 'warmup'
                                ? 'bg-slate-900 border-amber-500/70 shadow-md ring-1 ring-amber-500/30'
                                : activeTargetDestination === 'cooldown'
                                ? 'bg-slate-900 border-teal-500/70 shadow-md ring-1 ring-teal-500/30'
                                : 'bg-slate-900 border-emerald-500/70 shadow-md ring-1 ring-emerald-500/30'
                              : isSelectedAnywhere
                              ? 'bg-slate-900/90 border-slate-700 shadow-sm'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            {/* Tapable Exercise Info: adds/removes from active destination */}
                            <div
                              onClick={() => toggleSelectExercise(ex)}
                              className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"
                            >
                              <div
                                className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 transition ${
                                  isInActiveDest
                                    ? activeTargetDestination === 'c2'
                                      ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-black'
                                      : activeTargetDestination === 'warmup'
                                      ? 'bg-amber-500 border-amber-400 text-slate-950 font-black'
                                      : activeTargetDestination === 'cooldown'
                                      ? 'bg-teal-500 border-teal-400 text-slate-950 font-black'
                                      : 'bg-emerald-500 border-emerald-400 text-slate-950 font-black'
                                    : isSelectedAnywhere
                                    ? 'border-slate-600 bg-slate-800 text-slate-300 font-bold'
                                    : 'border-slate-700 text-transparent'
                                }`}
                              >
                                <Check className="w-4 h-4 stroke-[3]" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs sm:text-sm text-white truncate">
                                    {ex.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playTap();
                                      setEditingExerciseIdForManager(ex.id);
                                      setShowManager(true);
                                    }}
                                    className="p-1 rounded-md text-slate-500 hover:text-cyan-300 hover:bg-slate-800 transition shrink-0"
                                    title={`Modificar datos de "${ex.name}" (nombre, tiempo, repes, etc.)`}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span>{ex.category}</span>
                                  <span>·</span>
                                  <span className="text-emerald-400/90">
                                    {ex.mode === 'both'
                                      ? 'Reps o Tiempo'
                                      : ex.mode === 'reps'
                                      ? 'Repeticiones'
                                      : 'Tiempo'}
                                  </span>
                                </div>

                                {/* Badges showing where this exercise is assigned */}
                                {isSelectedAnywhere && (
                                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                    {inWarmup && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        🔥 En Calentamiento
                                      </span>
                                    )}
                                    {inC1 && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                        🟢 En Circuito 1
                                      </span>
                                    )}
                                    {inC2 && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                        🔵 En Circuito 2
                                      </span>
                                    )}
                                    {inCooldown && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40">
                                        🧘 En Enfriamiento
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Live Adjusters if selected */}
                            {isSelectedAnywhere && activeItem && (
                              <div className="flex items-center space-x-2 shrink-0">
                                {ex.mode === 'both' && (
                                  <button
                                    onClick={() => switchRoutineItemMode(ex.id)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                                      activeItem.currentMode === 'reps'
                                        ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                                        : 'bg-cyan-950 border border-cyan-800 text-cyan-400'
                                    }`}
                                    title="Alternar entre Reps y Tiempo"
                                  >
                                    {activeItem.currentMode === 'reps' ? 'Reps' : 'Tiempo'}
                                  </button>
                                )}

                                <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-0.5">
                                  <button
                                    onClick={() => adjustRoutineItem(ex.id, -1)}
                                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold active:scale-95"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-12 text-center font-mono font-bold text-xs text-white">
                                    {activeItem.currentMode === 'reps'
                                      ? `${activeItem.targetReps}`
                                      : `${activeItem.targetTime}s`}
                                  </span>
                                  <button
                                    onClick={() => adjustRoutineItem(ex.id, 1)}
                                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold active:scale-95"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>

                          {/* Quick 1-tap buttons to place or toggle in specific blocks */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2.5 mt-2.5 border-t border-slate-800/80 text-[11px] gap-1.5">
                            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                              Asignar a bloque:
                            </span>
                            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectExercise(ex, 'warmup');
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                                  inWarmup
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                    : 'text-slate-400 hover:text-amber-300'
                                }`}
                                title="Añadir/Quitar de Calentamiento (Bici 10-12 min)"
                              >
                                <Flame className="w-3 h-3" />
                                <span>{inWarmup ? 'En Calentamiento' : '+ Calentam.'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectExercise(ex, 'c1');
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                                  inC1
                                    ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                                    : 'text-slate-400 hover:text-emerald-300'
                                }`}
                                title="Añadir/Quitar de Circuito 1"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                <span>{inC1 ? 'En Circuito 1' : '+ Circuito 1'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectExercise(ex, 'c2');
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                                  inC2
                                    ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                                    : 'text-slate-400 hover:text-cyan-300'
                                }`}
                                title="Añadir/Quitar de Circuito 2"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                <span>{inC2 ? 'En Circuito 2' : '+ Circuito 2'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectExercise(ex, 'cooldown');
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                                  inCooldown
                                    ? 'bg-teal-500 text-slate-950 font-black shadow-sm'
                                    : 'text-slate-400 hover:text-teal-300'
                                }`}
                                title="Añadir/Quitar de Enfriamiento (Remo 10-12 min)"
                              >
                                <HeartPulse className="w-3 h-3" />
                                <span>{inCooldown ? 'En Enfriamiento' : '+ Enfriam.'}</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: MI RUTINA (SEPARACIÓN VISUAL POR BLOQUES Y CONFIGURACIÓN) */}
            {builderTab === 'routine' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">
                    Secuencia del entrenamiento ({selectedRoutine.length} ejercicios)
                  </span>
                  {selectedRoutine.length > 0 && (
                    <button
                      onClick={clearRoutine}
                      className="text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Limpiar todo</span>
                    </button>
                  )}
                </div>

                {selectedRoutine.length === 0 ? (
                  <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-slate-800 p-6 space-y-3">
                    <p className="text-xs text-slate-400">
                      No has seleccionado ningún ejercicio todavía.
                    </p>
                    <button
                      onClick={() => setBuilderTab('catalog')}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs uppercase"
                    >
                      Ir al Catálogo de 45 ejercicios
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    
                    {/* BARRA DE FILTRO RÁPIDO PARA VER Y ORDENAR CIRCUITOS */}
                    <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-3 rounded-2xl space-y-2 shadow-md">
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ver y ordenar por bloque:</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Usa <strong>Subir</strong> y <strong>Bajar</strong> para reordenar
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            playTap();
                            setRoutineSectionFilter('all');
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                            routineSectionFilter === 'all'
                              ? 'bg-slate-200 text-slate-950 font-black shadow'
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          Ver Todos ({selectedRoutine.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playTap();
                            setRoutineSectionFilter('c1');
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 ${
                            routineSectionFilter === 'c1'
                              ? 'bg-emerald-500 text-slate-950 font-black shadow-md ring-2 ring-emerald-400/50'
                              : 'bg-slate-950 border border-slate-800 text-emerald-400 hover:text-white'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span>Solo Circuito 1 ({mainCircuitItems.filter((i) => (i.circuit || 1) === 1).length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playTap();
                            setRoutineSectionFilter('c2');
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 ${
                            routineSectionFilter === 'c2'
                              ? 'bg-cyan-500 text-slate-950 font-black shadow-md ring-2 ring-cyan-400/50'
                              : 'bg-slate-950 border border-slate-800 text-cyan-400 hover:text-white'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                          <span>Solo Circuito 2 ({mainCircuitItems.filter((i) => i.circuit === 2).length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playTap();
                            setRoutineSectionFilter('warmup');
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 ${
                            routineSectionFilter === 'warmup'
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-400/50'
                              : 'bg-slate-950 border border-slate-800 text-amber-400 hover:text-white'
                          }`}
                        >
                          <Flame className="w-3 h-3 text-amber-400" />
                          <span>Calentamiento ({warmupItems.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playTap();
                            setRoutineSectionFilter('cooldown');
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 ${
                            routineSectionFilter === 'cooldown'
                              ? 'bg-teal-500 text-slate-950 font-black shadow-md ring-2 ring-teal-400/50'
                              : 'bg-slate-950 border border-slate-800 text-teal-400 hover:text-white'
                          }`}
                        >
                          <HeartPulse className="w-3 h-3 text-teal-400" />
                          <span>Enfriamiento ({cooldownItems.length})</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* BLOQUE 1: CALENTAMIENTO (Bicicleta 10-12 min) */}
                    {(routineSectionFilter === 'all' || routineSectionFilter === 'warmup') && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase tracking-wider">
                          <Flame className="w-4 h-4 text-amber-400" />
                          <span>Bloque 1: Calentamiento ({warmupItems.length})</span>
                        </div>
                        <span className="text-[10px] text-amber-400/80 font-medium">
                          1 vez antes de los circuitos
                        </span>
                      </div>

                      {warmupItems.length === 0 ? (
                        <div className="p-3 rounded-2xl border border-dashed border-amber-500/20 bg-amber-500/5 text-center text-xs text-amber-300/70">
                          Sin calentamiento asignado. Puedes marcar la bicicleta o cualquier ejercicio con el botón "Calentamiento".
                        </div>
                      ) : (
                        warmupItems.map((item, wIdx, wArr) => {
                          const overallIndex = selectedRoutine.findIndex((i) => i.id === item.id);
                          return (
                            <div
                              key={item.id}
                              className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-2.5 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="w-6 h-6 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                    {wIdx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-xs sm:text-sm text-white truncate">
                                      {item.name}
                                    </div>
                                    <div className="text-[10px] text-amber-400/90 font-medium">
                                      {item.category} · Calentamiento Inicial ({wIdx + 1}/{wArr.length})
                                    </div>
                                  </div>
                                </div>

                                {/* Reorder Buttons */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => moveItemWithinSection(item.id, 'up')}
                                    disabled={wIdx === 0}
                                    className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-300 font-bold text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                                    title="Subir orden en Calentamiento"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span className="text-[10px]">Subir</span>
                                  </button>
                                  <button
                                    onClick={() => moveItemWithinSection(item.id, 'down')}
                                    disabled={wIdx === wArr.length - 1}
                                    className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-300 font-bold text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                                    title="Bajar orden en Calentamiento"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span className="text-[10px]">Bajar</span>
                                  </button>
                                  <button
                                    onClick={() => removeRoutineItemByIndex(overallIndex)}
                                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-rose-400 hover:text-rose-300 active:scale-95"
                                    title="Quitar de la rutina"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* 3-WAY PHASE TOGGLE */}
                              <div className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-xl border border-slate-850 gap-1 text-[11px]">
                                <span className="text-slate-400 font-semibold px-1 text-[10px] uppercase">Bloque:</span>
                                <div className="flex items-center gap-1 flex-1 justify-end">
                                  <button
                                    onClick={() => setItemPhase(item.exerciseId, 'warmup')}
                                    className="px-2 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 bg-amber-500 text-slate-950 shadow-sm"
                                  >
                                    <Flame className="w-3 h-3" />
                                    <span>Calentamiento</span>
                                  </button>
                                  <button
                                    onClick={() => setItemPhase(item.exerciseId, 'main')}
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300"
                                  >
                                    <Layers className="w-3 h-3" />
                                    <span>Circuito</span>
                                  </button>
                                  <button
                                    onClick={() => setItemPhase(item.exerciseId, 'cooldown')}
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-teal-300"
                                  >
                                    <HeartPulse className="w-3 h-3" />
                                    <span>Enfriamiento</span>
                                  </button>
                                </div>
                              </div>

                              {/* Mode and Target Config */}
                              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-850 text-xs gap-2">
                                <button
                                  onClick={() => switchRoutineItemMode(item.exerciseId)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                                    item.currentMode === 'reps'
                                      ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                                      : 'bg-cyan-950 border border-cyan-800 text-cyan-400'
                                  }`}
                                >
                                  Modo: {item.currentMode === 'reps' ? 'Reps' : 'Tiempo'}
                                </button>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => adjustRoutineItem(item.exerciseId, -1)}
                                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono font-bold text-xs text-white w-16 text-center">
                                    {item.currentMode === 'reps'
                                      ? `${item.targetReps} reps`
                                      : `${Math.floor(item.targetTime / 60)}m ${item.targetTime % 60}s`}
                                  </span>
                                  <button
                                    onClick={() => adjustRoutineItem(item.exerciseId, 1)}
                                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    )}

                    {/* BLOQUE 2: CIRCUITOS PRINCIPALES (4 circuitos: 2+2) */}
                    {(routineSectionFilter === 'all' || routineSectionFilter === 'c1' || routineSectionFilter === 'c2') && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase tracking-wider">
                          <Layers className="w-4 h-4 text-emerald-400" />
                          <span>Bloque 2: Circuitos Principales ({mainCircuitItems.length})</span>
                        </div>
                        <span className="text-[10px] text-cyan-400 font-mono font-bold">
                          {circuitCount} {circuitCount === 1 ? 'circuito' : 'circuitos'} × {rounds} {rounds === 1 ? 'vuelta' : 'vueltas'} ({circuitCount * rounds} en total)
                        </span>
                      </div>

                      {mainCircuitItems.length === 0 ? (
                        <div className="p-3 rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5 text-center text-xs text-emerald-300/70">
                          Sin ejercicios de circuito asignados. Marca ejercicios con el botón "Circuito".
                        </div>
                      ) : circuitCount === 2 ? (
                        /* CUANDO HAY 2 CIRCUITOS: SEPARACIÓN VISUAL ENTRE CIRCUITO 1 Y CIRCUITO 2 */
                        <div className="space-y-4">
                          {/* SUB-SECCIÓN CIRCUITO 1 */}
                          {(routineSectionFilter === 'all' || routineSectionFilter === 'c1') && (
                          <div className="p-3 rounded-2xl bg-slate-950/70 border border-emerald-500/30 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                              <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                <span>Circuito 1 ({mainCircuitItems.filter((i) => (i.circuit || 1) === 1).length} ejercicios)</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Se repite {rounds} {rounds === 1 ? 'vuelta' : 'vueltas'}
                              </span>
                            </div>

                            {mainCircuitItems.filter((i) => (i.circuit || 1) === 1).length === 0 ? (
                              <div className="text-center py-2 text-[11px] text-slate-500">
                                Sin ejercicios en el Circuito 1. Pulsa "Circuito 1" en cualquier ejercicio para moverlo aquí.
                              </div>
                            ) : (
                              mainCircuitItems
                                .filter((i) => (i.circuit || 1) === 1)
                                .map((item, c1Idx, c1Arr) => {
                                  const overallIndex = selectedRoutine.findIndex((i) => i.id === item.id);
                                  return (
                                    <div
                                      key={item.id}
                                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 shadow-sm"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="w-5 h-5 rounded-md bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                                            {c1Idx + 1}
                                          </span>
                                          <div className="min-w-0">
                                            <div className="font-bold text-xs sm:text-sm text-white truncate">
                                              {item.name}
                                            </div>
                                            <div className="text-[10px] text-emerald-400 font-medium">
                                              {item.category} · Circuito 1 ({c1Idx + 1}/{c1Arr.length})
                                            </div>
                                          </div>
                                        </div>

                                        {/* Reorder & Delete */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            onClick={() => moveItemWithinSection(item.id, 'up')}
                                            disabled={c1Idx === 0}
                                            className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-300 font-bold text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                                            title="Subir de posición en el Circuito 1"
                                          >
                                            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span className="text-[10px]">Subir</span>
                                          </button>
                                          <button
                                            onClick={() => moveItemWithinSection(item.id, 'down')}
                                            disabled={c1Idx === c1Arr.length - 1}
                                            className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-300 font-bold text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                                            title="Bajar de posición en el Circuito 1"
                                          >
                                            <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span className="text-[10px]">Bajar</span>
                                          </button>
                                          <button
                                            onClick={() => removeRoutineItemByIndex(overallIndex)}
                                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-rose-400 hover:text-rose-300 active:scale-95"
                                            title="Quitar"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Controls: Circuit Toggle & Mode/Adjusters */}
                                      <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded-lg border border-slate-850 text-xs gap-1.5 flex-wrap">
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => toggleItemCircuit(item.exerciseId)}
                                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 transition flex items-center gap-1"
                                            title="Pasar este ejercicio al Circuito 2"
                                          >
                                            <span>Mover al C2 ➔</span>
                                          </button>
                                          <button
                                            onClick={() => switchRoutineItemMode(item.exerciseId)}
                                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300"
                                          >
                                            {item.currentMode === 'reps' ? 'Reps' : 'Tiempo'}
                                          </button>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() => adjustRoutineItem(item.exerciseId, -1)}
                                            className="w-6 h-6 rounded bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                                          >
                                            -
                                          </button>
                                          <span className="font-mono font-bold text-xs text-white w-14 text-center">
                                            {item.currentMode === 'reps'
                                              ? `${item.targetReps} reps`
                                              : `${item.targetTime}s`}
                                          </span>
                                          <button
                                            onClick={() => adjustRoutineItem(item.exerciseId, 1)}
                                            className="w-6 h-6 rounded bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                          )}

                          {/* SUB-SECCIÓN CIRCUITO 2 */}
                          {(routineSectionFilter === 'all' || routineSectionFilter === 'c2') && (
                          <div className="p-3 rounded-2xl bg-slate-950/70 border border-cyan-500/30 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                              <span className="text-xs font-black text-cyan-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                                <span>Circuito 2 ({mainCircuitItems.filter((i) => i.circuit === 2).length} ejercicios)</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Se repite {rounds} {rounds === 1 ? 'vuelta' : 'vueltas'}
                              </span>
                            </div>

                            {mainCircuitItems.filter((i) => i.circuit === 2).length === 0 ? (
                              <div className="text-center py-2 text-[11px] text-slate-500">
                                Sin ejercicios en el Circuito 2. Pulsa "+ Circuito 2" en el Catálogo o "Mover al C2" para añadir aquí.
                              </div>
                            ) : (
                              mainCircuitItems
                                .filter((i) => i.circuit === 2)
                                .map((item, c2Idx, c2Arr) => {
                                  const overallIndex = selectedRoutine.findIndex((i) => i.id === item.id);
                                  return (
                                    <div
                                      key={item.id}
                                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 shadow-sm"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="w-5 h-5 rounded-md bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                                            {c2Idx + 1}
                                          </span>
                                          <div className="min-w-0">
                                            <div className="font-bold text-xs sm:text-sm text-white truncate">
                                              {item.name}
                                            </div>
                                            <div className="text-[10px] text-cyan-400 font-medium">
                                              {item.category} · Circuito 2 ({c2Idx + 1}/{c2Arr.length})
                                            </div>
                                          </div>
                                        </div>

                                        {/* Reorder & Delete */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            onClick={() => moveItemWithinSection(item.id, 'up')}
                                            disabled={c2Idx === 0}
                                            className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-300 font-bold text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                                            title="Subir posición en Circuito 2"
                                          >
                                            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span className="text-[10px]">Subir</span>
                                          </button>
                                          <button
                                            onClick={() => moveItemWithinSection(item.id, 'down')}
                                            disabled={c2Idx === c2Arr.length - 1}
                                            className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-300 font-bold text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                                            title="Bajar posición en Circuito 2"
                                          >
                                            <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span className="text-[10px]">Bajar</span>
                                          </button>
                                          <button
                                            onClick={() => removeRoutineItemByIndex(overallIndex)}
                                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-rose-400 hover:text-rose-300 active:scale-95"
                                            title="Quitar"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Controls: Circuit Toggle & Mode/Adjusters */}
                                      <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded-lg border border-slate-850 text-xs gap-1.5 flex-wrap">
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => toggleItemCircuit(item.exerciseId)}
                                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition flex items-center gap-1"
                                            title="Pasar este ejercicio al Circuito 1"
                                          >
                                            <span>⬅ Mover al C1</span>
                                          </button>
                                          <button
                                            onClick={() => switchRoutineItemMode(item.exerciseId)}
                                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300"
                                          >
                                            {item.currentMode === 'reps' ? 'Reps' : 'Tiempo'}
                                          </button>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() => adjustRoutineItem(item.exerciseId, -1)}
                                            className="w-6 h-6 rounded bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                                          >
                                            -
                                          </button>
                                          <span className="font-mono font-bold text-xs text-white w-14 text-center">
                                            {item.currentMode === 'reps'
                                              ? `${item.targetReps} reps`
                                              : `${item.targetTime}s`}
                                          </span>
                                          <button
                                            onClick={() => adjustRoutineItem(item.exerciseId, 1)}
                                            className="w-6 h-6 rounded bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                          )}
                        </div>
                      ) : (
                        /* CUANDO HAY 1 CIRCUITO CONTINUO */
                        mainCircuitItems.map((item, cIdx, cArr) => {
                          const overallIndex = selectedRoutine.findIndex((i) => i.id === item.id);
                          return (
                            <div
                              key={item.id}
                              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="w-6 h-6 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                    {cIdx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-xs sm:text-sm text-white truncate">
                                      {item.name}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {item.category} · Ejercicio {cIdx + 1} de {cArr.length}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => moveItemWithinSection(item.id, 'up')}
                                    disabled={cIdx === 0}
                                    className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-300 font-bold text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                                    title="Subir"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span className="text-[10px]">Subir</span>
                                  </button>
                                  <button
                                    onClick={() => moveItemWithinSection(item.id, 'down')}
                                    disabled={cIdx === cArr.length - 1}
                                    className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-300 font-bold text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                                    title="Bajar"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span className="text-[10px]">Bajar</span>
                                  </button>
                                  <button
                                    onClick={() => removeRoutineItemByIndex(overallIndex)}
                                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-rose-400 hover:text-rose-300 active:scale-95"
                                    title="Quitar"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-850 text-xs gap-2">
                                <button
                                  onClick={() => switchRoutineItemMode(item.exerciseId)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300"
                                >
                                  Modo: {item.currentMode === 'reps' ? 'Reps' : 'Tiempo'}
                                </button>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => adjustRoutineItem(item.exerciseId, -1)}
                                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono font-bold text-xs text-white w-14 text-center">
                                    {item.currentMode === 'reps'
                                      ? `${item.targetReps} reps`
                                      : `${item.targetTime}s`}
                                  </span>
                                  <button
                                    onClick={() => adjustRoutineItem(item.exerciseId, 1)}
                                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    )}

                    {/* BLOQUE 3: ENFRIAMIENTO (Remo 10-12 min) */}
                    {(routineSectionFilter === 'all' || routineSectionFilter === 'cooldown') && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5 text-xs font-black text-teal-400 uppercase tracking-wider">
                          <HeartPulse className="w-4 h-4 text-teal-400" />
                          <span>Bloque 3: Enfriamiento ({cooldownItems.length})</span>
                        </div>
                        <span className="text-[10px] text-teal-400/80 font-medium">
                          1 vez al terminar los circuitos
                        </span>
                      </div>

                      {cooldownItems.length === 0 ? (
                        <div className="p-3 rounded-2xl border border-dashed border-teal-500/20 bg-teal-500/5 text-center text-xs text-teal-300/70">
                          Sin enfriamiento asignado. Puedes marcar el remo o cualquier ejercicio con el botón "Enfriamiento".
                        </div>
                      ) : (
                        cooldownItems.map((item, cdIdx, cdArr) => {
                          const overallIndex = selectedRoutine.findIndex((i) => i.id === item.id);
                          return (
                            <div
                              key={item.id}
                              className="p-3.5 rounded-2xl bg-slate-900 border border-teal-500/30 space-y-2.5 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="w-6 h-6 rounded-lg bg-teal-950/80 border border-teal-500/40 text-teal-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                    {cdIdx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-xs sm:text-sm text-white truncate">
                                      {item.name}
                                    </div>
                                    <div className="text-[10px] text-teal-400/90 font-medium">
                                      {item.category} · Enfriamiento Final ({cdIdx + 1}/{cdArr.length})
                                    </div>
                                  </div>
                                </div>

                                {/* Reorder Buttons */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => moveItemWithinSection(item.id, 'up')}
                                    disabled={cdIdx === 0}
                                    className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-300 font-bold text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                                    title="Subir orden en Enfriamiento"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span className="text-[10px]">Subir</span>
                                  </button>
                                  <button
                                    onClick={() => moveItemWithinSection(item.id, 'down')}
                                    disabled={cdIdx === cdArr.length - 1}
                                    className="py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-300 font-bold text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                                    title="Bajar orden en Enfriamiento"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span className="text-[10px]">Bajar</span>
                                  </button>
                                  <button
                                    onClick={() => removeRoutineItemByIndex(overallIndex)}
                                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/40 border border-slate-800 text-rose-400 hover:text-rose-300 active:scale-95 transition"
                                    title="Quitar de la rutina"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* 3-WAY PHASE TOGGLE */}
                              <div className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-xl border border-slate-850 gap-1 text-[11px]">
                                <span className="text-slate-400 font-semibold px-1 text-[10px] uppercase">Bloque:</span>
                                <div className="flex items-center gap-1 flex-1 justify-end">
                                  <button
                                    onClick={() => setItemPhase(item.exerciseId, 'warmup')}
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-300"
                                  >
                                    <Flame className="w-3 h-3" />
                                    <span>Calentamiento</span>
                                  </button>
                                  <button
                                    onClick={() => setItemPhase(item.exerciseId, 'main')}
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300"
                                  >
                                    <Layers className="w-3 h-3" />
                                    <span>Circuito</span>
                                  </button>
                                  <button
                                    onClick={() => setItemPhase(item.exerciseId, 'cooldown')}
                                    className="px-2 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 bg-teal-500 text-slate-950 shadow-sm"
                                  >
                                    <HeartPulse className="w-3 h-3" />
                                    <span>Enfriamiento</span>
                                  </button>
                                </div>
                              </div>

                              {/* Mode and Target Config */}
                              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-850 text-xs gap-2">
                                <button
                                  onClick={() => switchRoutineItemMode(item.exerciseId)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                                    item.currentMode === 'reps'
                                      ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                                      : 'bg-cyan-950 border border-cyan-800 text-cyan-400'
                                  }`}
                                >
                                  Modo: {item.currentMode === 'reps' ? 'Reps' : 'Tiempo'}
                                </button>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => adjustRoutineItem(item.exerciseId, -1)}
                                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono font-bold text-xs text-white w-16 text-center">
                                    {item.currentMode === 'reps'
                                      ? `${item.targetReps} reps`
                                      : `${Math.floor(item.targetTime / 60)}m ${item.targetTime % 60}s`}
                                  </span>
                                  <button
                                    onClick={() => adjustRoutineItem(item.exerciseId, 1)}
                                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    )}

                  </div>
                )}
              </div>
            )}

            {/* FLOATING MOBILE STICKY BOTTOM ACTION (Natural Thumb Reach) */}
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 z-20">
              <div className="max-w-xl sm:max-w-3xl lg:max-w-4xl mx-auto flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    playTap();
                    setShowSendModal(true);
                  }}
                  disabled={selectedRoutine.length === 0}
                  className="py-4 px-3 sm:px-4 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-lg shrink-0 disabled:opacity-50"
                  title="Dejar listo para el Polideportivo (Código QR o WhatsApp)"
                >
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span className="hidden xs:inline">Listo para el</span>
                  <span>Móvil</span>
                </button>

                <button
                  onClick={handleStartWorkout}
                  disabled={selectedRoutine.length === 0}
                  className={`flex-1 py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl ${
                    selectedRoutine.length > 0
                      ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 text-slate-950 glow-emerald active:scale-95 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  <span>
                    Comenzar ({warmupItems.length > 0 ? 'Calent. + ' : ''}
                    {circuitCount === 2 && targetCircuitMode === 1
                      ? `Solo C1 [${rounds} vueltas]`
                      : circuitCount === 2 && targetCircuitMode === 2
                      ? `Solo C2 [${rounds} vueltas]`
                      : `${circuitCount * rounds} circuitos`}
                    {cooldownItems.length > 0 ? ' + Enfriam.' : ''})
                  </span>
                </button>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* MODALES */}
      {showSendModal && (
        <SendRoutineModal
          routine={selectedRoutine}
          circuitCount={circuitCount}
          rounds={rounds}
          restBetweenRounds={restBetweenRounds}
          onClose={() => setShowSendModal(false)}
        />
      )}

      {showManager && (
        <ExerciseManagerModal
          catalog={catalog}
          onAddExercise={handleAddExerciseToCatalog}
          onUpdateExercise={handleUpdateExerciseInCatalog}
          onDeleteExercise={handleDeleteExerciseFromCatalog}
          onResetCatalog={handleResetCatalog}
          onImportCatalog={handleImportCatalog}
          initialEditingId={editingExerciseIdForManager}
          onClose={() => {
            setShowManager(false);
            setEditingExerciseIdForManager(null);
          }}
        />
      )}

      {showRoutines && (
        <RoutinesAndHistoryModal
          presets={PRESET_ROUTINES}
          savedRoutines={savedRoutines}
          history={history}
          currentRoutineItems={selectedRoutine}
          onLoadRoutine={handleLoadRoutine}
          onSaveCurrentRoutine={handleSaveRoutine}
          onDeleteSavedRoutine={handleDeleteSavedRoutine}
          onClearHistory={() => setHistory([])}
          onSeedSampleData={seedSampleHistory}
          onClose={() => setShowRoutines(false)}
        />
      )}

      {showPwa && (
        <AndroidPwaModal onClose={() => setShowPwa(false)} />
      )}

      {showSheetsModal && (
        <GoogleSheetsSyncModal
          history={history}
          catalog={catalog}
          autoSync={autoSyncSheets}
          onToggleAutoSync={setAutoSyncSheets}
          onClose={() => setShowSheetsModal(false)}
        />
      )}

    </div>
  );
}
