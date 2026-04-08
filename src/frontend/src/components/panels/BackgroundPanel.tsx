import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { useAppStore } from "@/store/useAppStore";
import { decomposeTime } from "@/utils/time";
import { Film, Image, Pause, Play, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const GOLD = "#FFD700";
const GOLD_40 = "#FFD70066";
const GOLD_20 = "#FFD70033";

// ── HMS input component ──────────────────────────────────────────────────────

interface HmsInputProps {
  totalSeconds: number;
  onChange: (seconds: number) => void;
  maxHours?: number;
  "data-ocid"?: string;
}

function HmsInput({
  totalSeconds,
  onChange,
  maxHours = 9999,
  "data-ocid": ocid,
}: HmsInputProps) {
  const { h, m, s } = decomposeTime(totalSeconds);

  const commit = (newH: number, newM: number, newS: number) => {
    const cH = Math.max(0, Math.min(maxHours, newH));
    const cM = Math.max(0, Math.min(59, newM));
    const cS = Math.max(0, Math.min(59, newS));
    onChange(cH * 3600 + cM * 60 + cS);
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    background: "#000",
    border: `1px solid ${GOLD_40}`,
    color: GOLD,
    fontSize: 11,
    fontFamily: "monospace",
    textAlign: "center",
    padding: "3px 2px",
    outline: "none",
    appearance: "textfield",
  };

  return (
    <div className="flex flex-col gap-1" data-ocid={ocid}>
      <div className="grid grid-cols-3 gap-1">
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="text-[9px] tracking-widest"
            style={{ color: GOLD_40 }}
          >
            HH
          </span>
          <input
            type="number"
            min={0}
            max={maxHours}
            value={h}
            onChange={(e) => commit(Number(e.target.value) || 0, m, s)}
            style={fieldStyle}
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-[#FFD700]"
            data-ocid={ocid ? `${ocid}-h` : undefined}
          />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="text-[9px] tracking-widest"
            style={{ color: GOLD_40 }}
          >
            MM
          </span>
          <input
            type="number"
            min={0}
            max={59}
            value={m}
            onChange={(e) => commit(h, Number(e.target.value) || 0, s)}
            style={fieldStyle}
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-[#FFD700]"
            data-ocid={ocid ? `${ocid}-m` : undefined}
          />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="text-[9px] tracking-widest"
            style={{ color: GOLD_40 }}
          >
            SS
          </span>
          <input
            type="number"
            min={0}
            max={59}
            value={s}
            onChange={(e) => commit(h, m, Number(e.target.value) || 0)}
            style={fieldStyle}
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-[#FFD700]"
            data-ocid={ocid ? `${ocid}-s` : undefined}
          />
        </div>
      </div>
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────

export function BackgroundPanel() {
  const {
    background,
    setBackground,
    setBackgroundDuration,
    toggleBackgroundPlay,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const prevUrl = background.fileUrl;
      if (prevUrl) URL.revokeObjectURL(prevUrl);

      const url = URL.createObjectURL(file);
      const fileType = file.type.startsWith("video/") ? "video" : "image";
      setBackground({ file, fileUrl: url, fileType, isPlaying: false });
    },
    [background.fileUrl, setBackground],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (
        file &&
        (file.type.startsWith("image/") || file.type.startsWith("video/"))
      ) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleClear = () => {
    if (background.fileUrl) URL.revokeObjectURL(background.fileUrl);
    setBackground({
      file: null,
      fileUrl: null,
      fileType: null,
      isPlaying: false,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (background.isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    toggleBackgroundPlay();
  };

  const handleDurationSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackgroundDuration(Number(e.target.value));
  };

  const fileName = background.file?.name ?? null;

  const titleExtra = background.fileType ? (
    background.fileType === "video" ? (
      <Film size={12} color={GOLD} />
    ) : (
      <Image size={12} color={GOLD} />
    )
  ) : null;

  return (
    <CollapsiblePanel
      title="Background Layer"
      defaultOpen
      titleExtra={titleExtra}
    >
      <div className="flex flex-col gap-3 font-mono">
        {/* File Upload Zone */}
        {!background.fileUrl ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className="border transition-colors duration-200"
            style={{
              borderColor: isDragging ? GOLD : GOLD_40,
              background: isDragging ? "#1a1a00" : "#0a0a00",
              borderStyle: "dashed",
            }}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-ocid="bg-upload-zone"
              className="flex flex-col items-center justify-center gap-2 cursor-pointer py-6 px-4 w-full"
              style={{ background: "transparent" }}
            >
              <Upload size={22} color={isDragging ? GOLD : GOLD_40} />
              <span
                className="text-xs text-center"
                style={{ color: isDragging ? GOLD : GOLD_40 }}
              >
                DRAG & DROP OR CLICK TO UPLOAD
                <br />
                <span className="opacity-60">IMAGE / VIDEO</span>
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              data-ocid="bg-file-input"
            />
          </div>
        ) : (
          /* Loaded file header */
          <div
            className="flex items-center justify-between px-2 py-1.5"
            style={{ background: "#0a0a00", border: `1px solid ${GOLD_20}` }}
          >
            <span
              className="text-xs truncate min-w-0 flex-1"
              style={{ color: GOLD }}
              title={fileName ?? ""}
            >
              {fileName}
            </span>
            <button
              type="button"
              onClick={handleClear}
              data-ocid="bg-clear-btn"
              className="flex-shrink-0 ml-2 p-0.5 hover:opacity-80 transition-opacity"
              aria-label="Remove background file"
              style={{ color: GOLD }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Video Preview */}
        {background.fileType === "video" && background.fileUrl && (
          <div className="flex flex-col gap-2">
            <video
              ref={videoRef}
              src={background.fileUrl}
              className="w-full object-contain"
              style={{ maxHeight: "140px", border: `1px solid ${GOLD}` }}
              muted
              loop
              playsInline
              data-ocid="bg-video-preview"
            />
            <button
              type="button"
              onClick={handleTogglePlay}
              data-ocid="bg-play-btn"
              className="flex items-center justify-center gap-2 py-1.5 text-xs font-bold tracking-widest uppercase transition-colors duration-200 hover:opacity-80"
              style={{
                border: `1px solid ${GOLD_40}`,
                background: "#111",
                color: GOLD,
              }}
            >
              {background.isPlaying ? (
                <>
                  <Pause size={12} /> PAUSE
                </>
              ) : (
                <>
                  <Play size={12} /> PLAY
                </>
              )}
            </button>
          </div>
        )}

        {/* Image Preview */}
        {background.fileType === "image" && background.fileUrl && (
          <img
            src={background.fileUrl}
            alt="Background preview"
            className="w-full object-contain"
            style={{ maxHeight: "140px", border: `1px solid ${GOLD}` }}
            data-ocid="bg-image-preview"
          />
        )}

        {/* Duration Control */}
        <div className="flex flex-col gap-1.5">
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: GOLD }}
          >
            DURATION (HH:MM:SS)
          </span>

          {/* Slider */}
          <input
            type="range"
            min={1}
            max={129600}
            value={background.duration}
            onChange={handleDurationSlider}
            data-ocid="bg-duration-slider"
            className="w-full h-1.5 appearance-none cursor-pointer"
            style={{
              accentColor: GOLD,
              background: `linear-gradient(to right, ${GOLD} ${((background.duration - 1) / 129599) * 100}%, #333 0%)`,
            }}
          />

          {/* H / M / S fields */}
          <HmsInput
            totalSeconds={background.duration}
            onChange={setBackgroundDuration}
            maxHours={36}
            data-ocid="bg-duration"
          />

          <div
            className="flex justify-between text-[10px]"
            style={{ color: GOLD_40 }}
          >
            <span>00:00:01</span>
            <span>36:00:00</span>
          </div>
        </div>
      </div>
    </CollapsiblePanel>
  );
}
