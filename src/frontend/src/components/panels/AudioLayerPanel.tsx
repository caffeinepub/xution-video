import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAppStore } from "@/store/useAppStore";
import { Music, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

interface AudioLayerPanelProps {
  audioId: 1 | 2 | 3 | 4;
}

export function AudioLayerPanel({ audioId }: AudioLayerPanelProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const audio = useAppStore((s) => s.audios.find((a) => a.id === audioId)!);
  const playback = useAppStore((s) => s.playback);
  const setAudio = useAppStore((s) => s.setAudio);

  // Sync playback state → audio element
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audio.fileUrl) return;

    el.volume = audio.volume / 100;

    if (playback.isPlaying && audio.isActive) {
      el.play().catch(() => {});
    } else {
      el.pause();
      if (!playback.isPlaying) {
        // Full stop — reset to beginning only when playback stopped entirely
        if (playback.currentTime === 0) {
          el.currentTime = 0;
        }
      }
    }
  }, [
    playback.isPlaying,
    playback.currentTime,
    audio.fileUrl,
    audio.isActive,
    audio.volume,
  ]);

  // Sync volume change live
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audio.volume / 100;
    }
  }, [audio.volume]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fileUrl = URL.createObjectURL(file);
      setAudio(audioId, { file, fileUrl, fileName: file.name, isActive: true });
      e.target.value = "";
    },
    [audioId, setAudio],
  );

  const handleClear = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (audio.fileUrl) {
      URL.revokeObjectURL(audio.fileUrl);
    }
    setAudio(audioId, {
      file: null,
      fileUrl: null,
      fileName: "",
      isActive: false,
    });
  }, [audioId, audio.fileUrl, setAudio]);

  const handleVolumeChange = useCallback(
    (val: number[]) => {
      setAudio(audioId, { volume: val[0] });
    },
    [audioId, setAudio],
  );

  const truncateName = (name: string, max = 28) =>
    name.length > max ? `${name.slice(0, max - 3)}...` : name;

  return (
    <div className="flex flex-col gap-3 font-mono">
      {/* Hidden audio element */}
      {audio.fileUrl && (
        <audio ref={audioRef} src={audio.fileUrl} loop preload="auto">
          <track kind="captions" />
        </audio>
      )}

      {/* File upload row */}
      <div className="flex flex-col gap-1.5">
        <Label
          className="text-[#FFD700] text-xs tracking-widest uppercase"
          htmlFor={`audio-upload-${audioId}`}
        >
          FILE
        </Label>

        {audio.fileUrl ? (
          <div
            className="flex items-center gap-2 px-2 py-1.5 border border-[#FFD700]/40 bg-[#0d0d00]"
            style={{ borderRadius: "2px" }}
          >
            <Music size={12} className="text-[#FFD700]/70 flex-shrink-0" />
            <span
              className="text-[#FFD700] text-xs flex-1 min-w-0 truncate"
              title={audio.fileName}
              data-ocid={`audio-${audioId}-filename`}
            >
              {truncateName(audio.fileName)}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-[#FFD700]/50 hover:text-[#FFD700] transition-colors flex-shrink-0"
              aria-label="Remove audio file"
              data-ocid={`audio-${audioId}-clear`}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 border border-[#FFD700]/40 bg-[#0d0d00] hover:bg-[#1a1a00] hover:border-[#FFD700]/70 transition-colors text-[#FFD700] text-xs tracking-wide w-full"
            style={{ borderRadius: "2px" }}
            data-ocid={`audio-${audioId}-upload-btn`}
          >
            <Upload size={12} />
            <span>UPLOAD AUDIO</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          id={`audio-upload-${audioId}`}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
          data-ocid={`audio-${audioId}-file-input`}
        />
      </div>

      {/* Volume slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-[#FFD700] text-xs tracking-widest uppercase">
            VOLUME
          </Label>
          <span
            className="text-[#FFD700] text-xs tabular-nums"
            data-ocid={`audio-${audioId}-volume-value`}
          >
            {audio.volume}%
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[audio.volume]}
          onValueChange={handleVolumeChange}
          className="w-full"
          data-ocid={`audio-${audioId}-volume-slider`}
          style={
            {
              "--slider-thumb-color": "#FFD700",
              "--slider-range-color": "#FFD700",
              "--slider-track-color": "#333300",
            } as React.CSSProperties
          }
          disabled={!audio.isActive}
        />
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{
            backgroundColor: audio.isActive
              ? playback.isPlaying
                ? "#FFD700"
                : "#664d00"
              : "#333",
            boxShadow:
              audio.isActive && playback.isPlaying ? "0 0 4px #FFD700" : "none",
          }}
        />
        <span className="text-[#FFD700]/50 text-xs">
          {!audio.isActive
            ? "NO FILE"
            : playback.isPlaying
              ? "PLAYING"
              : "READY"}
        </span>
      </div>
    </div>
  );
}
