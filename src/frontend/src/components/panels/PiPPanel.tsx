import { useAppStore } from "@/store/useAppStore";
import type { PiPLayer } from "@/types";
import { decomposeTime } from "@/utils/time";
import { Eye, EyeOff, Lock, Unlock, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

interface PiPPanelProps {
  pipId: 1 | 2 | 3 | 4;
}

// ── tiny styled primitives ──────────────────────────────────────────────────

function GoldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[#FFD700]/60 text-[10px] font-bold tracking-widest uppercase block mb-0.5">
      {children}
    </span>
  );
}

function GoldNumInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  "data-ocid": ocid,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  "data-ocid"?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      data-ocid={ocid}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full bg-black border border-[#FFD700]/40 text-[#FFD700] text-xs font-mono px-1.5 py-1 focus:outline-none focus:border-[#FFD700] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

function SectionDivider() {
  return <div className="border-t border-[#FFD700]/10 my-2" />;
}

// ── HH:MM:SS three-field input ───────────────────────────────────────────────

interface HmsFieldProps {
  totalSeconds: number;
  onChange: (seconds: number) => void;
  "data-ocid"?: string;
}

function HmsField({
  totalSeconds,
  onChange,
  "data-ocid": ocid,
}: HmsFieldProps) {
  const { h, m, s } = decomposeTime(totalSeconds);

  const commit = (newH: number, newM: number, newS: number) => {
    const cH = Math.max(0, Math.min(36, newH));
    const cM = Math.max(0, Math.min(59, newM));
    const cS = Math.max(0, Math.min(59, newS));
    onChange(cH * 3600 + cM * 60 + cS);
  };

  const colStyle = "flex flex-col items-center gap-0.5";
  const labelStyle = "text-[8px] font-bold tracking-widest text-[#FFD700]/40";
  const inputCls =
    "w-full bg-black border border-[#FFD700]/40 text-[#FFD700] text-[11px] font-mono py-0.5 focus:outline-none focus:border-[#FFD700] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className="grid grid-cols-3 gap-1" data-ocid={ocid}>
      <div className={colStyle}>
        <span className={labelStyle}>HH</span>
        <input
          type="number"
          min={0}
          max={36}
          value={h}
          onChange={(e) => commit(Number(e.target.value) || 0, m, s)}
          className={inputCls}
          data-ocid={ocid ? `${ocid}-h` : undefined}
        />
      </div>
      <div className={colStyle}>
        <span className={labelStyle}>MM</span>
        <input
          type="number"
          min={0}
          max={59}
          value={m}
          onChange={(e) => commit(h, Number(e.target.value) || 0, s)}
          className={inputCls}
          data-ocid={ocid ? `${ocid}-m` : undefined}
        />
      </div>
      <div className={colStyle}>
        <span className={labelStyle}>SS</span>
        <input
          type="number"
          min={0}
          max={59}
          value={s}
          onChange={(e) => commit(h, m, Number(e.target.value) || 0)}
          className={inputCls}
          data-ocid={ocid ? `${ocid}-s` : undefined}
        />
      </div>
    </div>
  );
}

// ── main component ──────────────────────────────────────────────────────────

export function PiPPanel({ pipId }: PiPPanelProps) {
  const pip = useAppStore((s) => s.pips[pipId - 1]) as PiPLayer;
  const updatePiP = useAppStore((s) => s.updatePiP);
  const thumbnailRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const up = useCallback(
    (partial: Partial<PiPLayer>) => updatePiP(pipId, partial),
    [updatePiP, pipId],
  );

  // Draw thumbnail whenever fileUrl changes
  useEffect(() => {
    const canvas = thumbnailRef.current;
    if (!canvas || !pip.fileUrl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (pip.fileType === "image") {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, 160, 90);
        ctx.drawImage(img, 0, 0, 160, 90);
      };
      img.src = pip.fileUrl;
    } else if (pip.fileType === "video") {
      const video = document.createElement("video");
      video.src = pip.fileUrl;
      video.currentTime = 0.1;
      video.onloadeddata = () => {
        ctx.clearRect(0, 0, 160, 90);
        ctx.drawImage(video, 0, 0, 160, 90);
      };
    }
  }, [pip.fileUrl, pip.fileType]);

  // File upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const fileType: "image" | "video" = file.type.startsWith("video/")
      ? "video"
      : "image";
    up({ file, fileUrl: url, fileType });
    e.target.value = "";
  };

  const handleClearFile = () => {
    if (pip.fileUrl) URL.revokeObjectURL(pip.fileUrl);
    up({ file: null, fileUrl: null, fileType: null });
  };

  // Aspect-ratio-locked dimension updates
  const handleWidthChange = (w: number) => {
    if (pip.lockAspectRatio && pip.width > 0) {
      up({ width: w, height: Math.round((w / pip.width) * pip.height) });
    } else {
      up({ width: w });
    }
  };

  const handleHeightChange = (h: number) => {
    if (pip.lockAspectRatio && pip.height > 0) {
      up({ height: h, width: Math.round((h / pip.height) * pip.width) });
    } else {
      up({ height: h });
    }
  };

  return (
    <div className="flex flex-col gap-2 font-mono text-[#FFD700]">
      {/* ── File Upload ─────────────────────────────────────────────────── */}
      <div>
        <GoldLabel>Media File</GoldLabel>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-ocid={`pip${pipId}-upload`}
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold tracking-widest uppercase border border-[#FFD700]/50 text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors duration-150"
          >
            <Upload size={10} />
            {pip.fileUrl ? "CHANGE" : "UPLOAD"}
          </button>
          {pip.fileUrl && (
            <button
              type="button"
              onClick={handleClearFile}
              data-ocid={`pip${pipId}-clear`}
              className="p-1 border border-[#FFD700]/30 text-[#FFD700]/50 hover:text-[#FFD700] hover:border-[#FFD700]/60 transition-colors duration-150"
              aria-label="Clear file"
            >
              <X size={10} />
            </button>
          )}
          <span className="text-[#FFD700]/40 text-[10px] truncate max-w-[120px]">
            {pip.file?.name ?? "No file"}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
          data-ocid={`pip${pipId}-file-input`}
        />
      </div>

      {/* ── Thumbnail Preview ────────────────────────────────────────────── */}
      <div>
        <GoldLabel>Preview</GoldLabel>
        <div
          className="border border-[#FFD700]/40 bg-[#0a0a00] inline-block"
          style={{ lineHeight: 0 }}
        >
          {pip.fileUrl ? (
            <canvas
              ref={thumbnailRef}
              width={160}
              height={90}
              data-ocid={`pip${pipId}-thumbnail`}
              className="block"
              style={{ maxWidth: "160px", maxHeight: "90px" }}
            />
          ) : (
            <div
              className="flex items-center justify-center text-[#FFD700]/20 text-[10px] tracking-widest"
              style={{ width: "160px", height: "90px" }}
            >
              NO MEDIA
            </div>
          )}
        </div>
      </div>

      <SectionDivider />

      {/* ── Crop Controls ────────────────────────────────────────────────── */}
      <div>
        <GoldLabel>Crop (px)</GoldLabel>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              { label: "TOP", key: "cropTop" },
              { label: "BOT", key: "cropBottom" },
              { label: "LEFT", key: "cropLeft" },
              { label: "RIGHT", key: "cropRight" },
            ] as { label: string; key: keyof PiPLayer }[]
          ).map(({ label, key }) => (
            <div key={key}>
              <GoldLabel>{label}</GoldLabel>
              <GoldNumInput
                value={pip[key] as number}
                onChange={(v) => up({ [key]: v })}
                min={0}
                data-ocid={`pip${pipId}-${key}`}
              />
            </div>
          ))}
        </div>
      </div>

      <SectionDivider />

      {/* ── Resize Controls ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <GoldLabel>Size (px)</GoldLabel>
          <button
            type="button"
            onClick={() => up({ lockAspectRatio: !pip.lockAspectRatio })}
            data-ocid={`pip${pipId}-lock-aspect`}
            aria-label={
              pip.lockAspectRatio ? "Unlock aspect ratio" : "Lock aspect ratio"
            }
            className="flex items-center gap-1 text-[10px] border px-1.5 py-0.5 transition-colors duration-150"
            style={{
              borderColor: pip.lockAspectRatio ? "#FFD700" : "#FFD70040",
              color: pip.lockAspectRatio ? "#FFD700" : "#FFD70060",
            }}
          >
            {pip.lockAspectRatio ? <Lock size={9} /> : <Unlock size={9} />}
            <span className="tracking-widest">
              {pip.lockAspectRatio ? "LOCK" : "FREE"}
            </span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <div>
            <GoldLabel>W</GoldLabel>
            <GoldNumInput
              value={pip.width}
              onChange={handleWidthChange}
              min={1}
              data-ocid={`pip${pipId}-width`}
            />
          </div>
          <div>
            <GoldLabel>H</GoldLabel>
            <GoldNumInput
              value={pip.height}
              onChange={handleHeightChange}
              min={1}
              data-ocid={`pip${pipId}-height`}
            />
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* ── Position Controls ────────────────────────────────────────────── */}
      <div>
        <GoldLabel>Position (px)</GoldLabel>
        <div className="grid grid-cols-2 gap-1">
          <div>
            <GoldLabel>X</GoldLabel>
            <GoldNumInput
              value={pip.posX}
              onChange={(v) => up({ posX: v })}
              data-ocid={`pip${pipId}-pos-x`}
            />
          </div>
          <div>
            <GoldLabel>Y</GoldLabel>
            <GoldNumInput
              value={pip.posY}
              onChange={(v) => up({ posY: v })}
              data-ocid={`pip${pipId}-pos-y`}
            />
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* ── Opacity ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <GoldLabel>Opacity</GoldLabel>
          <span className="text-[#FFD700] text-[11px] font-bold">
            {pip.opacity}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pip.opacity}
          onChange={(e) => up({ opacity: Number(e.target.value) })}
          data-ocid={`pip${pipId}-opacity`}
          className="w-full h-1 appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #FFD700 ${pip.opacity}%, #333 ${pip.opacity}%)`,
            accentColor: "#FFD700",
          }}
        />
      </div>

      <SectionDivider />

      {/* ── Time Range (HH:MM:SS) ─────────────────────────────────────────── */}
      <div>
        <GoldLabel>Time Range (HH:MM:SS)</GoldLabel>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <GoldLabel>IN</GoldLabel>
            <HmsField
              totalSeconds={pip.startTime}
              onChange={(v) => up({ startTime: v })}
              data-ocid={`pip${pipId}-start-time`}
            />
          </div>
          <div>
            <GoldLabel>OUT</GoldLabel>
            <HmsField
              totalSeconds={pip.endTime}
              onChange={(v) => up({ endTime: v })}
              data-ocid={`pip${pipId}-end-time`}
            />
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* ── Visibility Toggle ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => up({ isVisible: !pip.isVisible })}
        data-ocid={`pip${pipId}-visibility`}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-[10px] font-bold tracking-widest uppercase border transition-colors duration-150"
        style={{
          borderColor: pip.isVisible ? "#FFD700" : "#FFD70040",
          color: pip.isVisible ? "#000000" : "#FFD70060",
          backgroundColor: pip.isVisible ? "#FFD700" : "transparent",
        }}
      >
        {pip.isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
        {pip.isVisible ? "SHOW" : "HIDE"}
      </button>
    </div>
  );
}
