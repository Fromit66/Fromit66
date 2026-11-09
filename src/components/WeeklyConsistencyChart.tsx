import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { WorkoutHistoryItem } from '../types';
import {
  Flame,
  Calendar,
  Clock,
  Dumbbell,
  TrendingUp,
  Award,
  Sparkles,
} from 'lucide-react';
import { playTap } from '../utils/sound';

interface WeeklyConsistencyChartProps {
  history: WorkoutHistoryItem[];
  onSeedSampleData?: () => void;
}

interface DayData {
  dayKey: string; // YYYY-MM-DD
  dayLabel: string; // Lun 28, Mar 29, etc.
  dayShort: string; // Lun, Mar, Mié...
  fullDate: string;
  isToday: boolean;
  exercises: number;
  minutes: number;
  sessions: number;
}

export default function WeeklyConsistencyChart({
  history,
  onSeedSampleData,
}: WeeklyConsistencyChartProps) {
  const [metricView, setMetricView] = useState<'both' | 'exercises' | 'minutes'>('both');

  // Compute the last 7 days window (including today)
  const chartData = useMemo(() => {
    const days: DayData[] = [];
    const now = new Date();

    // Generate 7 days ending today
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dayKey = `${year}-${month}-${day}`;

      const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
      const dayShort = dayName.charAt(0).toUpperCase() + dayName.slice(1, 3);
      const dayLabel = `${dayShort} ${d.getDate()}`;
      const fullDate = d.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      });

      // Filter history entries for this day
      const sessionsForDay = history.filter((item) => {
        try {
          const itemDate = new Date(item.date);
          const iYear = itemDate.getFullYear();
          const iMonth = String(itemDate.getMonth() + 1).padStart(2, '0');
          const iDay = String(itemDate.getDate()).padStart(2, '0');
          return `${iYear}-${iMonth}-${iDay}` === dayKey;
        } catch {
          return false;
        }
      });

      const totalExercises = sessionsForDay.reduce((acc, s) => acc + (s.completedCount || 0), 0);
      const totalSeconds = sessionsForDay.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
      const totalMinutes = Math.round((totalSeconds / 60) * 10) / 10; // 1 decimal place

      days.push({
        dayKey,
        dayLabel,
        dayShort,
        fullDate,
        isToday: i === 0,
        exercises: totalExercises,
        minutes: totalMinutes,
        sessions: sessionsForDay.length,
      });
    }

    return days;
  }, [history]);

  // Weekly Stats summary
  const totalExercisesWeek = useMemo(
    () => chartData.reduce((acc, d) => acc + d.exercises, 0),
    [chartData]
  );

  const totalMinutesWeek = useMemo(
    () => Math.round(chartData.reduce((acc, d) => acc + d.minutes, 0)),
    [chartData]
  );

  const activeDaysCount = useMemo(
    () => chartData.filter((d) => d.exercises > 0 || d.minutes > 0).length,
    [chartData]
  );

  // Calculate current streak
  const currentStreak = useMemo(() => {
    let streak = 0;
    // Iterate from today backwards
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].exercises > 0 || chartData[i].minutes > 0) {
        streak++;
      } else {
        // If today has 0 workouts, check yesterday before breaking
        if (i === chartData.length - 1) {
          continue; // User might still train today!
        }
        break;
      }
    }
    return streak;
  }, [chartData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: DayData }> }) => {
    if (active && payload && payload.length) {
      const data: DayData = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 backdrop-blur-md p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[160px]">
          <div className="font-bold text-white capitalize border-b border-slate-800 pb-1 flex items-center justify-between">
            <span>{data.fullDate}</span>
            {data.isToday && (
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                Hoy
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-300">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Dumbbell className="w-3.5 h-3.5" /> Ejercicios:
            </span>
            <span className="font-mono font-bold text-white">{data.exercises}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-300">
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Clock className="w-3.5 h-3.5" /> Tiempo:
            </span>
            <span className="font-mono font-bold text-white">{data.minutes} min</span>
          </div>
          {data.sessions > 0 && (
            <div className="text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/80">
              {data.sessions} {data.sessions === 1 ? 'sesión completada' : 'sesiones completadas'}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
      
      {/* Component Title & Metric Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
              Consistencia Semanal
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Ejercicios completados y minutos acumulados en los últimos 7 días
          </span>
        </div>

        {/* Metric Selector Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => {
              playTap();
              setMetricView('both');
            }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
              metricView === 'both'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ambos
          </button>
          <button
            onClick={() => {
              playTap();
              setMetricView('exercises');
            }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
              metricView === 'exercises'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ejercicios
          </button>
          <button
            onClick={() => {
              playTap();
              setMetricView('minutes');
            }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
              metricView === 'minutes'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Minutos
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        
        {/* Active Days / 7 */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Calendar className="w-3 h-3 text-emerald-400" />
            <span className="truncate">Días Activos</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-white font-mono">{activeDaysCount}</span>
            <span className="text-xs text-slate-500 font-mono">/ 7</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">
            {activeDaysCount >= 4 ? '¡Gran constancia!' : 'Sigue sumando'}
          </span>
        </div>

        {/* Total Exercises */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Dumbbell className="w-3 h-3 text-emerald-400" />
            <span className="truncate">Ejercicios</span>
          </div>
          <div className="mt-1">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {totalExercisesWeek}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5">Total completados</span>
        </div>

        {/* Total Minutes */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="truncate">Tiempo Total</span>
          </div>
          <div className="mt-1">
            <span className="text-xl sm:text-2xl font-black text-cyan-400 font-mono">
              {totalMinutesWeek}
            </span>
            <span className="text-xs text-slate-500 ml-1 font-mono">min</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5">Acumulado semana</span>
        </div>

      </div>

      {/* RECHARTS COMPOSED CHART */}
      <div className="bg-slate-950/70 p-2 sm:p-3 rounded-2xl border border-slate-800/90">
        <div className="w-full h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="exerciseBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#10b981" stop-opacity={1} />
                  <stop offset="100%" stop-color="#059669" stop-opacity={0.8} />
                </linearGradient>
                <linearGradient id="timeBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#06b6d4" stop-opacity={1} />
                  <stop offset="100%" stop-color="#0891b2" stop-opacity={0.8} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#1e293b"
                opacity={0.7}
              />

              <XAxis
                dataKey="dayShort"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />

              {/* Left Y Axis for Exercises */}
              {(metricView === 'both' || metricView === 'exercises') && (
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="#10b981"
                  tick={{ fill: '#10b981', fontSize: 10, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
              )}

              {/* Right Y Axis for Minutes (when both or minutes only) */}
              {(metricView === 'both' || metricView === 'minutes') && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#06b6d4"
                  tick={{ fill: '#06b6d4', fontSize: 10, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  unit="m"
                />
              )}

              <Tooltip content={<CustomTooltip />} />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                formatter={(value) => {
                  if (value === 'exercises') return <span className="text-emerald-400 font-semibold">Ejercicios</span>;
                  if (value === 'minutes') return <span className="text-cyan-400 font-semibold">Minutos</span>;
                  return value;
                }}
              />

              {/* Exercises Bar */}
              {(metricView === 'both' || metricView === 'exercises') && (
                <Bar
                  yAxisId="left"
                  dataKey="exercises"
                  name="exercises"
                  fill="url(#exerciseBarGrad)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              )}

              {/* Minutes Bar or Line */}
              {metricView === 'both' && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="minutes"
                  name="minutes"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{ fill: '#06b6d4', stroke: '#020617', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#38bdf8' }}
                />
              )}

              {metricView === 'minutes' && (
                <Bar
                  yAxisId="right"
                  dataKey="minutes"
                  name="minutes"
                  fill="url(#timeBarGrad)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              )}

            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend notes */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
              <span>Ejercicios completados</span>
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2.5 h-2.5 rounded bg-cyan-500 inline-block" />
              <span>Tiempo (minutos)</span>
            </span>
          </div>

          {currentStreak > 0 && (
            <div className="flex items-center gap-1 text-amber-400 font-bold">
              <Flame className="w-3.5 h-3.5 fill-amber-400" />
              <span>Racha: {currentStreak} {currentStreak === 1 ? 'día' : 'días'}</span>
            </div>
          )}
        </div>
      </div>

      {/* If history is empty or low, offer sample data generation */}
      {history.length === 0 && onSeedSampleData && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>¿Quieres ver cómo lucen los datos semanales con entrenamientos reales simulados?</span>
          </div>
          <button
            onClick={() => {
              playTap();
              onSeedSampleData();
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] uppercase tracking-wider shrink-0 active:scale-95 transition"
          >
            Cargar Ejemplo
          </button>
        </div>
      )}

    </div>
  );
}
