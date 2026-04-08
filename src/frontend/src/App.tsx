import { Suspense, lazy, useRef, useState } from "react";
import { CanvasPreview } from "./components/CanvasPreview";
import { CollapsiblePanel } from "./components/CollapsiblePanel";
import { useAppStore } from "./store/useAppStore";
import { formatTime } from "./utils/time";

// Lazy-load all heavy panels — defers parsing until the panel is first opened
const BackgroundPanel = lazy(() =>
  import("./components/panels/BackgroundPanel").then((m) => ({
    default: m.BackgroundPanel,
  })),
);
const PiPPanelsGroup = lazy(() =>
  import("./components/panels/PiPPanelsGroup").then((m) => ({
    default: m.PiPPanelsGroup,
  })),
);
const AudioLayerGroup = lazy(() =>
  import("./components/panels/AudioLayerGroup").then((m) => ({
    default: m.AudioLayerGroup,
  })),
);
const AffirmationsPanel = lazy(() =>
  import("./components/panels/AffirmationsPanel").then((m) => ({
    default: m.AffirmationsPanel,
  })),
);
const BinaryPanel = lazy(() =>
  import("./components/panels/BinaryPanel").then((m) => ({
    default: m.BinaryPanel,
  })),
);
const StaticLayerPanel = lazy(() =>
  import("./components/panels/StaticLayerPanel").then((m) => ({
    default: m.StaticLayerPanel,
  })),
);
const IsochronicPanel = lazy(() =>
  import("./components/panels/IsochronicPanel").then((m) => ({
    default: m.IsochronicPanel,
  })),
);

// Minimal loading placeholder — gold pulse, no layout shift
const PanelLoader = () => (
  <div className="h-16 border border-[#FFD700]/30 animate-pulse bg-[#0a0a00]" />
);

export default function App() {
  const state = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wavExporting, setWavExporting] = useState(false);
  const [mp4Exporting, setMp4Exporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportElapsed, setExportElapsed] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);

  const clearExportError = () => setExportError(null);

  const handleExportWav = async () => {
    if (wavExporting) return;
    setWavExporting(true);
    setExportError(null);
    try {
      const { exportWAV } = await import("./utils/exportUtils");
      await exportWAV(state);
    } catch (err) {
      console.error("[Xution Video] WAV export failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setExportError(`WAV export failed: ${msg}`);
      setTimeout(clearExportError, 10_000);
    } finally {
      setWavExporting(false);
    }
  };

  const handleExportMp4 = async () => {
    if (mp4Exporting) return;
    setMp4Exporting(true);
    setExportProgress(0);
    setExportElapsed(0);
    setExportError(null);
    setDownloadComplete(false);
    try {
      const { exportMP4 } = await import("./utils/exportUtils");
      await exportMP4(state, canvasRef, (percent, elapsed, error) => {
        setExportProgress(percent);
        setExportElapsed(elapsed);
        if (error) {
          setExportError(error);
          setTimeout(clearExportError, 10_000);
        }
      });
      // Success — show confirmation for 3 seconds
      setDownloadComplete(true);
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      console.error("[Xution Video] MP4 export failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      // Only set if not already set via progress callback
      setExportError((prev) => prev ?? `Export failed: ${msg}`);
      setTimeout(clearExportError, 10_000);
    } finally {
      setMp4Exporting(false);
      setExportProgress(0);
      setExportElapsed(0);
      setDownloadComplete(false);
    }
  };

  const mp4ButtonLabel = downloadComplete
    ? "✓ Download ready!"
    : mp4Exporting
      ? `⏳ Rendering... ${exportProgress}%`
      : "▶ Export Video";

  const footerStatus = wavExporting
    ? "EXPORTING WAV..."
    : mp4Exporting
      ? downloadComplete
        ? "DOWNLOAD COMPLETE"
        : "RENDERING VIDEO — PLEASE WAIT..."
      : "READY";

  const totalDuration = state.background.duration;

  return (
    <div className="flex flex-col h-screen bg-black text-[#FFD700] font-mono overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[#FFD700]/30 bg-[#0a0a00]">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[#FFD700] rounded-none" />
            <span className="text-[#FFD700] text-sm font-bold tracking-[0.25em] uppercase">
              Xution Video
            </span>
            <span className="text-[#FFD700]/30 text-xs tracking-widest">
              ◆ COMPOSITION TOOL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportWav}
              disabled={wavExporting}
              data-ocid="export-wav"
              className="px-3 py-1 text-xs font-bold tracking-widest uppercase border border-[#FFD700]/50 text-[#FFD700] bg-transparent hover:bg-[#FFD700]/10 hover:border-[#FFD700] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {wavExporting ? "⏳ EXPORTING..." : "▶ Export WAV"}
            </button>
            <button
              type="button"
              onClick={handleExportMp4}
              disabled={mp4Exporting}
              data-ocid="export-mp4"
              className="px-3 py-1 text-xs font-bold tracking-widest uppercase border border-[#FFD700] text-black bg-[#FFD700] hover:bg-[#FFD700]/90 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed min-w-[160px] text-center"
            >
              {mp4ButtonLabel}
            </button>
          </div>
        </div>

        {/* Progress bar — visible only during MP4 export */}
        {mp4Exporting && (
          <div className="px-4 pb-2" data-ocid="export-progress-bar-container">
            {/* Time info row */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] tracking-widest text-[#FFD700]/60 uppercase">
                {downloadComplete
                  ? "Download ready! Check your downloads folder."
                  : "Rendering frames — building WebM video frame by frame"}
              </span>
              {!downloadComplete && (
                <span className="text-[10px] tracking-widest text-[#FFD700]/80 tabular-nums">
                  {formatTime(exportElapsed)}&nbsp;/&nbsp;
                  {formatTime(totalDuration)}
                </span>
              )}
            </div>

            {/* Bar track */}
            <div className="relative w-full h-4 bg-black border border-[#FFD700]/40 overflow-hidden">
              {/* Animated fill */}
              <div
                className="h-full transition-all duration-500 ease-linear"
                style={{
                  width: `${exportProgress}%`,
                  backgroundColor: downloadComplete ? "#4ade80" : "#FFD700",
                }}
              />
              {/* Scanline shimmer overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
                }}
              />
              {/* Percentage label centred on bar */}
              <span
                className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-widest mix-blend-difference"
                style={{ color: "#FFD700" }}
              >
                {downloadComplete ? "✓ READY" : `${exportProgress}%`}
              </span>
            </div>
          </div>
        )}

        {/* Export error banner */}
        {exportError && (
          <div
            className="mx-4 mb-2 px-3 py-2 border border-[#FFD700] bg-black flex items-start justify-between gap-3"
            data-ocid="export-error-banner"
            role="alert"
          >
            <div className="flex items-start gap-2 min-w-0">
              <span className="text-[#FFD700] text-xs font-bold shrink-0">
                ⚠ EXPORT ERROR
              </span>
              <span className="text-[#FFD700]/80 text-[10px] leading-relaxed break-words">
                {exportError}
                <br />
                <span className="text-[#FFD700]/50">
                  Try a shorter duration, close other tabs, or try on desktop
                  Chrome.
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={clearExportError}
              aria-label="Dismiss error"
              className="shrink-0 text-[#FFD700]/50 hover:text-[#FFD700] text-xs transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — control panels */}
        <aside
          className="flex-shrink-0 w-[380px] overflow-y-auto border-r border-[#FFD700]/20 bg-[#050500]"
          style={{ scrollbarColor: "#FFD700 #000", scrollbarWidth: "thin" }}
        >
          <div className="flex flex-col gap-px p-2">
            <CollapsiblePanel title="Background Layer" defaultOpen={true}>
              <Suspense fallback={<PanelLoader />}>
                <BackgroundPanel />
              </Suspense>
            </CollapsiblePanel>

            <CollapsiblePanel title="Picture in Picture" defaultOpen={false}>
              <Suspense fallback={<PanelLoader />}>
                <PiPPanelsGroup />
              </Suspense>
            </CollapsiblePanel>

            <CollapsiblePanel title="Audio Layers" defaultOpen={false}>
              <Suspense fallback={<PanelLoader />}>
                <AudioLayerGroup />
              </Suspense>
            </CollapsiblePanel>

            <CollapsiblePanel title="Affirmations" defaultOpen={false}>
              <Suspense fallback={<PanelLoader />}>
                <AffirmationsPanel />
              </Suspense>
            </CollapsiblePanel>

            <CollapsiblePanel title="Binary Code" defaultOpen={false}>
              <Suspense fallback={<PanelLoader />}>
                <BinaryPanel />
              </Suspense>
            </CollapsiblePanel>

            <CollapsiblePanel title="Static Layer" defaultOpen={false}>
              <Suspense fallback={<PanelLoader />}>
                <StaticLayerPanel />
              </Suspense>
            </CollapsiblePanel>

            <CollapsiblePanel title="Isochronic Tone" defaultOpen={false}>
              <Suspense fallback={<PanelLoader />}>
                <IsochronicPanel />
              </Suspense>
            </CollapsiblePanel>

            <div className="h-4" />
          </div>
        </aside>

        {/* Right — canvas preview */}
        <main className="flex-1 flex flex-col bg-[#080800] overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-4xl">
              <CanvasPreview ref={canvasRef} />
            </div>
          </div>
        </main>
      </div>

      {/* Status bar */}
      <footer className="flex-shrink-0 flex items-center justify-between px-4 py-1 border-t border-[#FFD700]/15 bg-[#050500]">
        <span className="text-[#FFD700]/30 text-[10px] tracking-widest uppercase">
          © {new Date().getFullYear()} &nbsp;·&nbsp; Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
              typeof window !== "undefined" ? window.location.hostname : "",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FFD700]/50 hover:text-[#FFD700] transition-colors"
          >
            caffeine.ai
          </a>
        </span>
        <span
          className={`text-[10px] tracking-widest ${
            mp4Exporting || wavExporting
              ? downloadComplete
                ? "text-green-400"
                : "text-[#FFD700]"
              : "text-[#FFD700]/20"
          }`}
          data-ocid="footer-status"
        >
          {footerStatus}
        </span>
      </footer>
    </div>
  );
}
