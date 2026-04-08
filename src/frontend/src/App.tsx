import { useRef, useState } from "react";
import { CanvasPreview } from "./components/CanvasPreview";
import { CollapsiblePanel } from "./components/CollapsiblePanel";
import { AffirmationsPanel } from "./components/panels/AffirmationsPanel";
import { AudioLayerGroup } from "./components/panels/AudioLayerGroup";
import { BackgroundPanel } from "./components/panels/BackgroundPanel";
import { BinaryPanel } from "./components/panels/BinaryPanel";
import { IsochronicPanel } from "./components/panels/IsochronicPanel";
import { PiPPanelsGroup } from "./components/panels/PiPPanelsGroup";
import { StaticLayerPanel } from "./components/panels/StaticLayerPanel";
import { useAppStore } from "./store/useAppStore";
import { exportMP4, exportWAV } from "./utils/exportUtils";
import { formatTime } from "./utils/time";

export default function App() {
  const state = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wavExporting, setWavExporting] = useState(false);
  const [mp4Exporting, setMp4Exporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportElapsed, setExportElapsed] = useState(0);
  const [preparingDownload, setPreparingDownload] = useState(false);

  const handleExportWav = async () => {
    if (wavExporting) return;
    setWavExporting(true);
    try {
      await exportWAV(state);
    } catch (err) {
      console.error("[Xution Video] WAV export failed:", err);
      alert("[Xution Video] WAV export failed. Check console for details.");
    } finally {
      setWavExporting(false);
    }
  };

  const handleExportMp4 = async () => {
    if (mp4Exporting) return;
    setMp4Exporting(true);
    setExportProgress(0);
    setExportElapsed(0);
    setPreparingDownload(false);
    try {
      await exportMP4(state, canvasRef, (percent, elapsed) => {
        setExportProgress(percent);
        setExportElapsed(elapsed);
      });
      setPreparingDownload(true);
      // Brief "preparing download" flash before reset
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err) {
      console.error("[Xution Video] MP4 export failed:", err);
      alert("[Xution Video] MP4 export failed. Check console for details.");
    } finally {
      setMp4Exporting(false);
      setExportProgress(0);
      setExportElapsed(0);
      setPreparingDownload(false);
    }
  };

  const mp4ButtonLabel = preparingDownload
    ? "⬇ Preparing download..."
    : mp4Exporting
      ? `⏳ Rendering... ${exportProgress}%`
      : "▶ Export MP4";

  const footerStatus = wavExporting
    ? "EXPORTING WAV..."
    : mp4Exporting
      ? preparingDownload
        ? "PREPARING DOWNLOAD..."
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
                {preparingDownload
                  ? "Preparing download..."
                  : "Rendering video — compositing all layers"}
              </span>
              <span className="text-[10px] tracking-widest text-[#FFD700]/80 tabular-nums">
                {formatTime(exportElapsed)}&nbsp;/&nbsp;
                {formatTime(totalDuration)}
              </span>
            </div>

            {/* Bar track */}
            <div className="relative w-full h-4 bg-black border border-[#FFD700]/40 overflow-hidden">
              {/* Animated fill */}
              <div
                className="h-full bg-[#FFD700] transition-all duration-500 ease-linear"
                style={{ width: `${exportProgress}%` }}
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
                {exportProgress}%
              </span>
            </div>
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
              <BackgroundPanel />
            </CollapsiblePanel>

            <CollapsiblePanel title="Picture in Picture" defaultOpen={false}>
              <PiPPanelsGroup />
            </CollapsiblePanel>

            <CollapsiblePanel title="Audio Layers" defaultOpen={false}>
              <AudioLayerGroup />
            </CollapsiblePanel>

            <CollapsiblePanel title="Affirmations" defaultOpen={false}>
              <AffirmationsPanel />
            </CollapsiblePanel>

            <CollapsiblePanel title="Binary Code" defaultOpen={false}>
              <BinaryPanel />
            </CollapsiblePanel>

            <CollapsiblePanel title="Static Layer" defaultOpen={false}>
              <StaticLayerPanel />
            </CollapsiblePanel>

            <CollapsiblePanel title="Isochronic Tone" defaultOpen={false}>
              <IsochronicPanel />
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
              ? "text-[#FFD700]"
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
