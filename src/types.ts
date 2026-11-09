export type ExerciseCategory = 
  | 'Pecho'
  | 'Espalda'
  | 'Piernas'
  | 'Core'
  | 'Brazos'
  | 'Hombros'
  | 'Cardio'
  | 'Full Body';

export type ExerciseMode = 'reps' | 'time' | 'both';

export type WorkoutPhase = 'warmup' | 'main' | 'cooldown';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory | string;
  mode: ExerciseMode;
  defaultReps: number;
  defaultTime: number; // in seconds
  description?: string;
  custom?: boolean;
  defaultPhase?: WorkoutPhase;
}

export interface RoutineItem {
  id: string; // unique item id in routine
  exerciseId: string;
  name: string;
  category: string;
  allowedMode: ExerciseMode;
  currentMode: 'reps' | 'time';
  targetReps: number;
  targetTime: number; // seconds
  description?: string;
  circuit?: number; // 1 = Circuito 1 / A, 2 = Circuito 2 / B (optional grouping)
  phase?: WorkoutPhase; // 'warmup' (Calentamiento) | 'main' (Circuitos) | 'cooldown' (Enfriamiento)
}

export interface SavedRoutine {
  id: string;
  name: string;
  createdAt: string;
  items: RoutineItem[];
  rounds?: number; // Vueltas / repeticiones del circuito (ej: 2)
  restBetweenRounds?: number; // Descanso entre vueltas en segundos (ej: 45s)
  circuitCount?: number; // Número de circuitos (ej: 2)
}

export interface WorkoutHistoryItem {
  id: string;
  date: string; // ISO
  durationSeconds: number;
  completedCount: number;
  totalCount: number;
  routineName?: string;
  rounds?: number;
  circuitCount?: number;
  items: {
    name: string;
    mode: 'reps' | 'time';
    target: number;
    completed: boolean;
    circuit?: number;
    phase?: WorkoutPhase;
  }[];
}
