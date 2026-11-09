import { useState } from 'react';
import { Exercise, ExerciseCategory, ExerciseMode } from '../types';
import { X, Plus, Trash2, Download, Upload, RotateCcw, Sliders, Check, Pencil } from 'lucide-react';
import { playTap } from '../utils/sound';

interface ExerciseManagerModalProps {
  catalog: Exercise[];
  onAddExercise: (newEx: Exercise) => void;
  onUpdateExercise: (updatedEx: Exercise) => void;
  onDeleteExercise: (id: string) => void;
  onResetCatalog: () => void;
  onImportCatalog: (imported: Exercise[]) => void;
  onClose: () => void;
  initialEditingId?: string | null;
}

const CATEGORIES: ExerciseCategory[] = [
  'Pecho',
  'Espalda',
  'Piernas',
  'Core',
  'Brazos',
  'Hombros',
  'Cardio',
  'Full Body',
];

export default function ExerciseManagerModal({
  catalog,
  onAddExercise,
  onUpdateExercise,
  onDeleteExercise,
  onResetCatalog,
  onImportCatalog,
  onClose,
  initialEditingId,
}: ExerciseManagerModalProps) {
  const initialEx = initialEditingId ? catalog.find((e) => e.id === initialEditingId) : null;
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(initialEditingId || null);
  const [name, setName] = useState(initialEx ? initialEx.name : '');
  const [category, setCategory] = useState<ExerciseCategory | string>(initialEx ? initialEx.category : 'Pecho');
  const [mode, setMode] = useState<ExerciseMode>(initialEx ? initialEx.mode : 'both');
  const [defaultReps, setDefaultReps] = useState(initialEx ? initialEx.defaultReps : 12);
  const [defaultTime, setDefaultTime] = useState(initialEx ? initialEx.defaultTime : 30);
  const [description, setDescription] = useState(initialEx ? initialEx.description || '' : '');
  const [managerSearch, setManagerSearch] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);

  const startEditing = (ex: Exercise) => {
    playTap();
    setEditingExerciseId(ex.id);
    setName(ex.name);
    setCategory(ex.category);
    setMode(ex.mode);
    setDefaultReps(ex.defaultReps);
    setDefaultTime(ex.defaultTime);
    setDescription(ex.description || '');
  };

  const cancelEditing = () => {
    playTap();
    setEditingExerciseId(null);
    setName('');
    setDescription('');
    setDefaultReps(12);
    setDefaultTime(30);
    setCategory('Pecho');
    setMode('both');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    playTap();
    if (editingExerciseId) {
      const existing = catalog.find((e) => e.id === editingExerciseId);
      const updatedEx: Exercise = {
        id: editingExerciseId,
        name: name.trim(),
        category,
        mode,
        defaultReps: Number(defaultReps) || 12,
        defaultTime: Number(defaultTime) || 30,
        description: description.trim() || undefined,
        custom: existing?.custom ?? true,
      };
      onUpdateExercise(updatedEx);
      setEditingExerciseId(null);
    } else {
      const newEx: Exercise = {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        category,
        mode,
        defaultReps: Number(defaultReps) || 12,
        defaultTime: Number(defaultTime) || 30,
        description: description.trim() || undefined,
        custom: true,
      };
      onAddExercise(newEx);
    }
    setName('');
    setDescription('');
    setDefaultReps(12);
    setDefaultTime(30);
  };

  const handleExportJSON = () => {
    playTap();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(catalog, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `fittrainer_ejercicios_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          onImportCatalog(imported);
          playTap();
        } else {
          alert('El archivo JSON no contiene una lista válida de ejercicios.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  const filteredCatalog = catalog.filter((ex) =>
    ex.name.toLowerCase().includes(managerSearch.toLowerCase()) ||
    ex.category.toLowerCase().includes(managerSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto flex items-center justify-center">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Gestor de Ejercicios</h2>
              <span className="text-[10px] text-slate-400">Total: {catalog.length} ejercicios disponibles</span>
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

        {/* Formulario Añadir o Modificar Ejercicio */}
        <form
          onSubmit={handleSubmit}
          className={`p-4 rounded-2xl border space-y-3 transition ${
            editingExerciseId
              ? 'bg-gradient-to-b from-cyan-950/40 to-slate-950 border-cyan-500/50 shadow-lg'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <h3
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                editingExerciseId ? 'text-cyan-300' : 'text-emerald-400'
              }`}
            >
              {editingExerciseId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingExerciseId ? 'Modificar Ejercicio Existente' : 'Crear Ejercicio Personalizado'}</span>
            </h3>

            {editingExerciseId && (
              <button
                type="button"
                onClick={cancelEditing}
                className="text-[10px] text-slate-400 hover:text-white font-bold px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 active:scale-95 transition"
              >
                ✕ Cancelar edición
              </button>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Press Banca Plano, Dominadas Neutras..."
              required
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Grupo Muscular</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Modo de Medición</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ExerciseMode)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="both">Ambos (Reps o Tiempo)</option>
                <option value="reps">Solo Repeticiones</option>
                <option value="time">Solo Tiempo (Reloj)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Reps por defecto</label>
              <input
                type="number"
                min="1"
                max="200"
                value={defaultReps}
                onChange={(e) => setDefaultReps(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Segundos por defecto</label>
              <input
                type="number"
                min="5"
                step="5"
                max="600"
                value={defaultTime}
                onChange={(e) => setDefaultTime(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Descripción / Técnica (Opcional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Codos a 45º, recorrido completo..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            {editingExerciseId && (
              <button
                type="button"
                onClick={cancelEditing}
                className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition active:scale-95"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md ${
                editingExerciseId
                  ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110 shadow-cyan-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {editingExerciseId ? <Pencil className="w-4 h-4 stroke-[2.5]" /> : <Plus className="w-4 h-4 stroke-[3]" />}
              <span>{editingExerciseId ? 'Guardar Cambios del Ejercicio' : 'Guardar en el Catálogo'}</span>
            </button>
          </div>
        </form>

        {/* Lista del Catálogo con Filtro */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Catálogo de Ejercicios ({filteredCatalog.length})
            </h3>
            <button
              onClick={() => {
                if (window.confirm('¿Deseas restaurar la lista oficial de 45 ejercicios predeterminados?')) {
                  onResetCatalog();
                  playTap();
                }
              }}
              className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restaurar 45 originales</span>
            </button>
          </div>

          <input
            type="text"
            value={managerSearch}
            onChange={(e) => setManagerSearch(e.target.value)}
            placeholder="Filtrar catálogo..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />

          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
            {filteredCatalog.map((ex) => {
              const isBeingEdited = editingExerciseId === ex.id;
              return (
                <div
                  key={ex.id}
                  className={`flex items-center justify-between p-2 rounded-xl border text-xs transition ${
                    isBeingEdited
                      ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/30'
                      : 'bg-slate-950 border-slate-800/80'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-white leading-tight truncate">{ex.name}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-cyan-400 font-semibold">{ex.category}</span>
                      <span>·</span>
                      <span className="capitalize">
                        {ex.mode === 'both' ? 'Reps o Tiempo' : ex.mode === 'reps' ? 'Repeticiones' : 'Tiempo'}
                      </span>
                      {ex.custom && (
                        <span className="text-emerald-400 font-semibold">[Personalizado]</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEditing(ex)}
                      className={`p-1.5 rounded-lg transition flex items-center gap-1 ${
                        isBeingEdited
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/15'
                      }`}
                      title="Modificar este ejercicio"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden xs:inline">Editar</span>
                    </button>
                    <button
                      onClick={() => {
                        playTap();
                        onDeleteExercise(ex.id);
                      }}
                      className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition"
                      title="Eliminar del catálogo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Backup & Import Tools */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
          <button
            onClick={handleExportJSON}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Copia JSON</span>
          </button>

          <label className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
            <Upload className="w-3.5 h-3.5" />
            <span>Importar JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>
        </div>

      </div>
    </div>
  );
}
