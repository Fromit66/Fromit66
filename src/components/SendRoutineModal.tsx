import React, { useState } from 'react';
import {
  Smartphone,
  QrCode,
  Copy,
  Check,
  X,
  MessageSquare,
  FileSpreadsheet,
  CheckCircle2,
  Dumbbell,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { playTap } from '../utils/sound';
import { RoutineItem } from '../types';

interface SendRoutineModalProps {
  routine: RoutineItem[];
  circuitCount: number;
  rounds: number;
  restBetweenRounds: number;
  onClose: () => void;
  onSaveToGoogleSheets?: () => Promise<boolean>;
}

export default function SendRoutineModal({
  routine,
  circuitCount,
  rounds,
  restBetweenRounds,
  onClose,
  onSaveToGoogleSheets,
}: SendRoutineModalProps) {
  const [qrType, setQrType] = useState<'routine' | 'app'>('routine');
  const [copied, setCopied] = useState(false);
  const [isSavingSheets, setIsSavingSheets] = useState(false);
  const [sheetsSaved, setSheetsSaved] = useState(false);

  // Use the active working origin so the QR code and links work immediately on mobile
  const [usePermanentServer, setUsePermanentServer] = useState(false);
  const hasDevOrigin = window.location.origin.includes('ais-dev-');
  const permanentOrigin = hasDevOrigin
    ? window.location.origin.replace('ais-dev-', 'ais-pre-')
    : window.location.origin;

  const activeOrigin = usePermanentServer ? permanentOrigin : window.location.origin;
  const baseUrl = activeOrigin + window.location.pathname;

  // Ultra-compact routine payload for maximum QR scannability:
  // Instead of heavy JSON+Base64 (which generates thousands of tiny dots),
  // we encode exercises as: id:dest:target (e.g. ex-pecho-1:c1:r15, ex-cal-1:w:t600)
  // This reduces URL length by 70%, yielding large, chunky, high-contrast QR dots.
  const compactExerciseList = routine
    .map((item) => {
      const destCode =
        item.phase === 'warmup'
          ? 'w'
          : item.phase === 'cooldown'
          ? 'k'
          : item.circuit === 2
          ? 'c2'
          : 'c1';
      const targetCode =
        item.currentMode === 'time' ? `t${item.targetTime}` : `r${item.targetReps}`;
      return `${item.exerciseId}:${destCode}:${targetCode}`;
    })
    .join(',');

  const routineShareUrl = `${baseUrl}?r=${circuitCount},${rounds},${restBetweenRounds}&e=${compactExerciseList}`;

  // Current active URL depending on tab
  const activeUrl = qrType === 'app' ? baseUrl : routineShareUrl;

  // QR Server URLs with high scannability parameters:
  // - margin=4 (white quiet zone around QR so camera edge detection works reliably on screens)
  // - ecc=L for low error correction = much larger, chunkier modules, no microscopic dots!
  // - size=360x360 for crisp render on desktop screens
  const qrAppUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=4&ecc=M&data=${encodeURIComponent(baseUrl)}`;
  const qrRoutineUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=4&ecc=L&data=${encodeURIComponent(routineShareUrl)}`;

  const currentQrSrc = qrType === 'app' ? qrAppUrl : qrRoutineUrl;

  const warmupCount = routine.filter((i) => i.phase === 'warmup').length;
  const c1Count = routine.filter((i) => (!i.phase || i.phase === 'main') && (i.circuit || 1) === 1).length;
  const c2Count = routine.filter((i) => (!i.phase || i.phase === 'main') && i.circuit === 2).length;
  const cooldownCount = routine.filter((i) => i.phase === 'cooldown').length;

  const handleCopy = () => {
    playTap();
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSheetsSave = async () => {
    if (!onSaveToGoogleSheets) return;
    playTap();
    setIsSavingSheets(true);
    try {
      const ok = await onSaveToGoogleSheets();
      if (ok) setSheetsSaved(true);
    } finally {
      setIsSavingSheets(false);
    }
  };

  const totalCircuitsToComplete = circuitCount * rounds;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto flex items-center justify-center">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-400 flex items-center justify-center text-slate-950 shadow-md">
              <Smartphone className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Abrir en tu Google Pixel / Móvil
              </h2>
              <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                Acceso directo · Escaneo garantizado
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

        {/* SERVER BADGE & OFFLINE ADVICE */}
        {hasDevOrigin && (
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="min-w-0">
                <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                  <span>Enlace Activo Directo</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">
                    {usePermanentServer ? 'ais-pre' : 'activo'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-300">
                  Abre en Chrome del Pixel y dale a <strong>&quot;Instalar App&quot;</strong> para usarla siempre en el gimnasio sin ordenador.
                </div>
              </div>
            </div>
            <button
              onClick={() => setUsePermanentServer(!usePermanentServer)}
              className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-950 border border-slate-800 shrink-0"
              title="Alternar entre URL activa y ais-pre"
            >
              {usePermanentServer ? 'ais-pre' : '🟢 Activo'}
            </button>
          </div>
        )}

        {/* METHOD SELECTION TABS FOR QR */}
        <div className="bg-slate-950 p-1 rounded-2xl border border-slate-800 flex items-center">
          <button
            onClick={() => {
              playTap();
              setQrType('routine');
            }}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 ${
              qrType === 'routine'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span>QR Rutina de Hoy ({routine.length})</span>
          </button>

          <button
            onClick={() => {
              playTap();
              setQrType('app');
            }}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 ${
              qrType === 'app'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>QR Solo Abrir App</span>
          </button>
        </div>

        {/* QR CODE BOX */}
        <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex flex-col items-center text-center space-y-3">
          <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-2xl flex items-center justify-center border-4 border-emerald-500/30">
            <img
              src={currentQrSrc}
              alt="Código QR para móvil"
              className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
            />
          </div>

          <div className="space-y-1.5 max-w-sm">
            <span className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>
                {qrType === 'app'
                  ? 'Apunta la cámara de tu Pixel al cuadro blanco'
                  : 'Apunta la cámara de tu Pixel para cargar la rutina'}
              </span>
            </span>

            {qrType === 'routine' && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] py-1">
                {warmupCount > 0 && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md font-bold">
                    🔥 {warmupCount} Calentam.
                  </span>
                )}
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-bold">
                  🟢 {c1Count} en C1
                </span>
                {circuitCount > 1 && (
                  <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-md font-bold">
                    🔵 {c2Count} en C2
                  </span>
                )}
                {cooldownCount > 0 && (
                  <span className="bg-teal-500/20 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded-md font-bold">
                    🧘 {cooldownCount} Enfriam.
                  </span>
                )}
                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-bold">
                  🔄 {rounds} {rounds === 1 ? 'vuelta' : 'vueltas'}
                </span>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              💡 <strong>Consejo Pixel:</strong> Sostén el móvil a unos 30-40 cm de la pantalla con la app de Cámara apuntando al código.
            </p>
          </div>
        </div>

        {/* ALTERNATIVE: WHATSAPP DIRECT (NO SCANNING NEEDED) */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>¿Reflejos en el monitor? Envíatelo directo:</span>
            <span className="text-emerald-400 font-semibold lowercase text-[10px]">100% fiable sin escanear</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                '🏋️ Mi Rutina FitTrainer lista para el móvil:\n\n' + activeUrl
              )}`}
              target="_blank"
              rel="noreferrer noopener"
              onClick={playTap}
              className="p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition shadow-lg glow-emerald"
            >
              <MessageSquare className="w-4 h-4 fill-white" />
              <span>Enviar a mi WhatsApp</span>
            </a>

            <button
              onClick={handleCopy}
              className="p-3.5 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-cyan-400" />
                  <span>Copiar Dirección</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* OFFLINE RUNNING TIP */}
        <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Para usarla sin internet en el gimnasio:</strong> Cuando lo abras en Chrome en tu Pixel, toca el menú de los 3 puntos (⋮) y pulsa <strong className="text-emerald-300">"Instalar aplicación"</strong> (o "Añadir a pantalla de inicio"). Quedará guardada en tu teléfono y abrirá en 0.1s incluso en modo avión.
          </div>
        </div>

        {/* PLAIN READABLE URL FOR MANUAL TYPING IF PREFERRED */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 flex items-center justify-between gap-2 text-xs">
          <span className="font-mono text-[11px] text-slate-400 truncate select-all">
            {baseUrl}
          </span>
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 text-[10px] font-bold shrink-0 hover:bg-slate-800"
          >
            Copiar
          </button>
        </div>

        {/* Optional Google Sheets Save */}
        {onSaveToGoogleSheets && (
          <button
            onClick={handleSheetsSave}
            disabled={isSavingSheets || sheetsSaved}
            className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>
              {sheetsSaved
                ? '¡Guardada en Google Sheets con éxito!'
                : isSavingSheets
                ? 'Guardando en Google Sheets...'
                : 'Guardar también en mi Google Sheets / Drive'}
            </span>
          </button>
        )}

        {/* Close Button */}
        <button
          onClick={() => {
            playTap();
            onClose();
          }}
          className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider active:scale-95 transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
