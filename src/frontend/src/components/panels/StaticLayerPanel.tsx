import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../../store/useAppStore";

export function StaticLayerPanel() {
  const { staticLayer, setStatic } = useAppStore();
  const { isActive, volume, opacity } = staticLayer;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const stopNoise = useCallback(() => {
    if (scriptNodeRef.current) {
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  const startNoise = useCallback((vol: number) => {
    if (audioCtxRef.current) return; // already running
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const bufferSize = 4096;
    const scriptNode = ctx.createScriptProcessor(bufferSize, 1, 1);
    scriptNodeRef.current = scriptNode;

    scriptNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < output.length; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    };

    const gainNode = ctx.createGain();
    gainNodeRef.current = gainNode;
    gainNode.gain.value = vol / 100;

    scriptNode.connect(gainNode);
    gainNode.connect(ctx.destination);
  }, []);

  // React to isActive changes — re-run when isActive flips
  // Volume handled separately to avoid restarting the engine
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    if (isActive) {
      startNoise(volumeRef.current);
    } else {
      stopNoise();
    }
    return () => {
      stopNoise();
    };
  }, [isActive, startNoise, stopNoise]);

  // Update gain when volume changes while active
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume / 100;
    }
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopNoise();
  }, [stopNoise]);

  const handleToggle = () => {
    setStatic({ isActive: !isActive });
  };

  return (
    <div
      className="font-mono"
      style={{
        background: "#0a0a0a",
        border: "1px solid #FFD700",
        borderRadius: 4,
        padding: 16,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span style={{ color: "#FFD700", fontSize: 13, letterSpacing: 2 }}>
          STATIC LAYER
        </span>
        <span
          style={{
            fontSize: 11,
            color: isActive ? "#FFD700" : "#555",
            border: `1px solid ${isActive ? "#FFD700" : "#333"}`,
            borderRadius: 2,
            padding: "2px 8px",
            letterSpacing: 1,
          }}
        >
          {isActive ? "STATIC ON" : "STATIC OFF"}
        </span>
      </div>

      {/* Toggle */}
      <button
        type="button"
        data-ocid="static-toggle"
        onClick={handleToggle}
        style={{
          width: "100%",
          padding: "8px 0",
          marginBottom: 16,
          background: isActive ? "#FFD700" : "#111",
          color: isActive ? "#000" : "#FFD700",
          border: "1px solid #FFD700",
          borderRadius: 2,
          fontFamily: "inherit",
          fontSize: 12,
          letterSpacing: 2,
          cursor: "pointer",
          transition: "background 0.2s, color 0.2s",
        }}
      >
        {isActive ? "■ DEACTIVATE" : "▶ ACTIVATE"}
      </button>

      {/* Volume */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <Label
            className="font-mono text-xs"
            style={{ color: "#FFD700", letterSpacing: 1 }}
          >
            WHITE NOISE VOLUME
          </Label>
          <span style={{ color: "#FFD700", fontSize: 11 }}>{volume}%</span>
        </div>
        <Slider
          data-ocid="static-volume"
          min={0}
          max={100}
          step={1}
          value={[volume]}
          onValueChange={([v]) => setStatic({ volume: v })}
          className="[&_.bg-primary]:bg-[#FFD700] [&_[role=slider]]:border-[#FFD700] [&_[role=slider]]:bg-[#FFD700]"
        />
      </div>

      {/* Opacity */}
      <div>
        <div className="flex justify-between mb-1">
          <Label
            className="font-mono text-xs"
            style={{ color: "#FFD700", letterSpacing: 1 }}
          >
            VISUAL OPACITY
          </Label>
          <span style={{ color: "#FFD700", fontSize: 11 }}>{opacity}%</span>
        </div>
        <Slider
          data-ocid="static-opacity"
          min={0}
          max={100}
          step={1}
          value={[opacity]}
          onValueChange={([v]) => setStatic({ opacity: v })}
          className="[&_.bg-primary]:bg-[#FFD700] [&_[role=slider]]:border-[#FFD700] [&_[role=slider]]:bg-[#FFD700]"
        />
      </div>
    </div>
  );
}
