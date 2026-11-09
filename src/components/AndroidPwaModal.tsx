import { useState } from 'react';
import {
  Smartphone,
  CheckCircle,
  X,
  Download,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Globe,
  Package,
  Layers,
  Sparkles,
  QrCode,
  Mail,
  MessageSquare,
  Camera,
} from 'lucide-react';
import { playTap } from '../utils/sound';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidPwaModalProps {
  onClose: () => void;
}

export default function AndroidPwaModal({ onClose }: AndroidPwaModalProps) {
  const [activeTab, setActiveTab] = useState<'pixel' | 'pwa' | 'apk'>('pixel');
  const [copied, setCopied] = useState(false);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const cleanAppUrl = window.location.origin + window.location.pathname;
  const currentAppUrl = cleanAppUrl;

  const handleCopyUrl = () => {
    playTap();
    navigator.clipboard.writeText(cleanAppUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleInstallClick = async () => {
    playTap();
    const success = await install();
    if (success) {
      onClose();
    }
  };

  // Pre-filled PWABuilder URL for generating an APK
  const pwaBuilderUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(currentAppUrl)}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto flex items-center justify-center">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-400 to-cyan-400 flex items-center justify-center text-slate-950 shadow-md">
              <Smartphone className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">Crear Icono en tu Móvil (Google Pixel)</h2>
              <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                Acceso directo en pantalla de inicio · Sin ordenador
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

        {/* VISUAL ICON PREVIEW (COMO SE VE EN EL MÓVIL) */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-950 to-cyan-950/40 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-inner">
          <div className="relative shrink-0 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-950 border-2 border-emerald-400/50 p-1.5 shadow-lg flex items-center justify-center overflow-hidden">
              <img src="/icon.svg" alt="Icono FitTrainer" className="w-full h-full object-contain" />
            </div>
            <span className="text-[10px] text-slate-300 font-bold mt-1 font-sans">FitTrainer</span>
          </div>
          <div className="min-w-0 space-y-1">
            <div className="text-xs font-black text-white flex items-center gap-1.5">
              <span>¡Sí! Tendrás este icono en tu pantalla de inicio</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Se instala directamente al lado de tus apps como WhatsApp o Spotify. Al tocarlo se abre a pantalla completa en 0 segundos, <strong>sin necesidad de ordenador ni conexión</strong>.
            </p>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => {
              playTap();
              setActiveTab('pixel');
            }}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'pixel'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Google Pixel</span>
          </button>

          <button
            onClick={() => {
              playTap();
              setActiveTab('pwa');
            }}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Android PWA</span>
          </button>

          <button
            onClick={() => {
              playTap();
              setActiveTab('apk');
            }}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'apk'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Descargar APK</span>
          </button>
        </div>

        {/* TAB 0: GOOGLE PIXEL ESPECÍFICO */}
        {activeTab === 'pixel' && (
          <div className="space-y-4">
            {/* Install Button if browser triggered prompt */}
            {isInstallable && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  ¡Google Pixel detectado y listo para instalar!
                </span>
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg glow-emerald active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 stroke-[3]" />
                  <span>📲 Crear Icono en mi Pantalla de Inicio</span>
                </button>
              </div>
            )}

            {isInstalled && (
              <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-3 text-center text-xs text-emerald-400 font-semibold flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>¡FitTrainer ya está instalada en tu Google Pixel!</span>
              </div>
            )}

            {/* Guía detallada para Pixel */}
            <div className="space-y-2 text-xs text-slate-300">
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pasos en Google Pixel (Pixel 6, 7, 8, 9, Pro o Fold):</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div className="text-xs">
                    Abre <strong>Google Chrome</strong> en tu Pixel y entra en la URL de esta app.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div className="text-xs">
                    En la barra de direcciones superior de Chrome verás un icono de <strong>Instalar</strong> (flecha hacia abajo), o pulsa los <strong>3 puntos verticales (⋮)</strong> en la esquina superior derecha y selecciona <strong>"Instalar aplicación"</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div className="text-xs">
                    Confirma pulsando <strong>"Instalar"</strong>. El icono de FitTrainer se añadirá al <strong>Pixel Launcher</strong> (tu pantalla de inicio y cajón de apps) comportándose exactamente como una app descargada de Google Play.
                  </div>
                </div>
              </div>
            </div>

            {/* Pixel Features */}
            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 text-[11px]">
              <span className="font-bold text-cyan-400 uppercase tracking-wider block">
                Ventajas en tu Google Pixel:
              </span>
              <ul className="space-y-1.5 text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Pantalla activa (Wake Lock)</strong>: La pantalla de tu Pixel no se apagará mientras entrenas.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Google Sheets integrado</strong>: Consulta tus sesiones de entrenamiento en la app nativa de Hojas de cálculo de tu Pixel.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Vibración háptica</strong>: Respuesta táctil en cada repetición y al finalizar temporizadores.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Offline total</strong>: Funciona en el gimnasio o al aire libre incluso sin cobertura.</span>
                </li>
              </ul>
            </div>

            {/* QR CODE & MÉTODOS PARA ABRIRLO EN TU PIXEL */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Método 1: Apunta con la Cámara de tu Pixel (El más rápido)</span>
              </div>

              <div className="flex items-center gap-4 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="bg-white p-2 rounded-xl shrink-0 shadow-md">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=4&ecc=M&data=${encodeURIComponent(cleanAppUrl)}`}
                    alt="Código QR para abrir FitTrainer en tu Pixel"
                    className="w-32 h-32 sm:w-36 sm:h-36 object-contain"
                  />
                </div>
                <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                  <p className="font-semibold text-white">
                    1. Abre la app <strong>Cámara</strong> en tu Pixel.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    2. Apunta la cámara a este código QR.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    3. Pulsa el botón amarillo que aparecerá en pantalla para abrirlo directamente en <strong>Google Chrome</strong>.
                  </p>
                </div>
              </div>

              {/* Botones de envío alternativos */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Método 2: Enviarte el enlace a tu teléfono
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent('Abre este enlace en Chrome en tu Pixel para instalar FitTrainer:\n' + currentAppUrl)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={playTap}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={`mailto:ramon.arauzo@gmail.com?subject=Enlace%20FitTrainer%20para%20Google%20Pixel&body=${encodeURIComponent('Hola Ramón,\n\nAbre este enlace en Google Chrome en tu Pixel para instalar FitTrainer:\n\n' + currentAppUrl + '\n\nLuego pulsa el menú de 3 puntos (⋮) y selecciona "Instalar aplicación".')}`}
                    onClick={playTap}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Por Email (Gmail)</span>
                  </a>
                </div>

                {/* Copiar enlace botón */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                    {currentAppUrl}
                  </span>
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '¡Copiado!' : 'Copiar URL'}</span>
                  </button>
                </div>
              </div>

              {/* ¿Cómo pegar en Chrome en tu Pixel? */}
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 block">¿Cómo pegar la dirección en Google Chrome en tu Pixel?</span>
                <p>
                  Abre la app <strong>Chrome</strong> en tu Pixel, <strong>mantén pulsado con el dedo la barra de direcciones superior</strong> durante 1 segundo, suelta y pulsa en la opción <strong>"Pegar"</strong> (o <em>"Pegar e ir"</em>).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: INSTALACIÓN PWA DIRECTA (10 SEGUNDOS) */}
        {activeTab === 'pwa' && (
          <div className="space-y-4">
            
            {/* Si el navegador detecta el botón de instalación nativo */}
            {isInstallable && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  ¡Tu navegador está listo para instalar!
                </span>
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg glow-emerald active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 stroke-[3]" />
                  <span>Instalar FitTrainer en mi Android</span>
                </button>
              </div>
            )}

            {isInstalled && (
              <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-3 text-center text-xs text-emerald-400 font-semibold flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>La aplicación ya se encuentra instalada en este dispositivo.</span>
              </div>
            )}

            {/* Pasos en Google Chrome de Android */}
            <div className="space-y-2 text-xs text-slate-300">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Instalación en 3 toques desde Google Chrome:
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div className="text-xs">
                    Abre el enlace de la app en el navegador <strong>Google Chrome</strong> en tu móvil Android.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div className="text-xs">
                    Toca el icono de los <strong>tres puntos verticales (⋮)</strong> en la esquina superior derecha del navegador.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div className="text-xs">
                    Toca en <strong>"Instalar aplicación"</strong> o <strong>"Añadir a la pantalla de inicio"</strong>.
                  </div>
                </div>
              </div>
            </div>

            {/* Ventajas PWA */}
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 text-[11px]">
              <span className="font-bold text-slate-400 uppercase tracking-wider block">
                ¿Por qué es mejor que un APK tradicional?
              </span>
              <ul className="space-y-1.5 text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>No requiere activar orígenes desconocidos</strong> ni permisos de riesgo en Android.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Se actualiza sola</strong>: siempre tendrás la última versión con tus mejoras.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Pantalla completa</strong> sin barras de navegación y funciona offline.</span>
                </li>
              </ul>
            </div>

            {/* Compartir enlace al móvil */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 truncate">
                Enlace para abrir en tu móvil:
              </span>
              <button
                onClick={handleCopyUrl}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Copiado!' : 'Copiar URL'}</span>
              </button>
            </div>

          </div>
        )}

        {/* TAB 2: CÓMO BAJAR O GENERAR EL APK */}
        {activeTab === 'apk' && (
          <div className="space-y-4 text-xs">
            
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 leading-relaxed text-slate-300">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Package className="w-4 h-4" />
                <span>¿Cómo generar el archivo .APK para Android?</span>
              </div>
              <p>
                Un archivo <strong>.APK</strong> es el instalador de Android empaquetado. Esta aplicación ya cumple con todos los estándares modernos de Google (Manifiesto PWA, iconos 512px y Service Worker).
              </p>
              <p>
                Puedes generar el archivo <strong>.APK instalable</strong> en 1 minuto de forma 100% gratuita usando <strong>PWABuilder</strong> (la herramienta oficial respaldada por Google y Microsoft):
              </p>
            </div>

            {/* Pasos para PWABuilder */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Instrucciones para descargar tu APK:
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    Haz clic en el botón de abajo para abrir <strong>PWABuilder</strong> con la dirección de tu aplicación ya cargada.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    En la sección <strong>"Android"</strong>, pulsa en <strong>"Package for Stores"</strong> o <strong>"Generate Package / APK"</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div>
                    Descarga el archivo <code>.apk</code> en tu ordenador o móvil.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                    4
                  </div>
                  <div>
                    En tu teléfono Android, abre el archivo descargado y confirma <strong>"Permitir instalar desde esta fuente"</strong> para completar la instalación.
                  </div>
                </div>
              </div>
            </div>

            {/* Enlace directo a PWABuilder */}
            <a
              href={pwaBuilderUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={playTap}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 shadow-lg glow-cyan"
            >
              <span>Abrir PWABuilder para generar mi APK</span>
              <ExternalLink className="w-4 h-4 stroke-[2.5]" />
            </a>

            <div className="text-[10px] text-slate-500 text-center">
              * Nota: La instalación PWA directa (Pestaña 1) ofrece exactamente la misma experiencia a pantalla completa y sin necesidad de firmar claves APK.
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
