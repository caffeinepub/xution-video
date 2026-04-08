import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../../store/useAppStore";

const GOLD = "#FFD700";
const ttsSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

function mapSpeedToRate(speed: number): number {
  // speed 0-100 → rate 0.5-2.0, midpoint 50 → 1.0
  return 0.5 + (speed / 100) * 1.5;
}

function mapVolumeToUtterance(volume: number): number {
  return volume / 100;
}

export function AffirmationsPanel() {
  const affirmations = useAppStore((s) => s.affirmations);
  const setAffirmations = useAppStore((s) => s.setAffirmations);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const indexRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  const lines = affirmations.text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const currentAffirmation = lines[affirmations.currentIndex] ?? "";

  const speakNext = useCallback(() => {
    if (!ttsSupported || !isPlayingRef.current) return;
    const currentLines = useAppStore
      .getState()
      .affirmations.text.split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (currentLines.length === 0) return;

    const idx = indexRef.current % currentLines.length;
    indexRef.current = idx;
    setAffirmations({ currentIndex: idx });

    const utter = new SpeechSynthesisUtterance(currentLines[idx]);
    utter.volume = mapVolumeToUtterance(
      useAppStore.getState().affirmations.volume,
    );
    utter.rate = mapSpeedToRate(useAppStore.getState().affirmations.speed);

    utter.onend = () => {
      if (!isPlayingRef.current) return;
      indexRef.current = (indexRef.current + 1) % currentLines.length;
      speakNext();
    };

    utter.onerror = () => {
      if (isPlayingRef.current) {
        indexRef.current = (indexRef.current + 1) % currentLines.length;
        speakNext();
      }
    };

    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [setAffirmations]);

  const handlePlay = useCallback(() => {
    if (!ttsSupported) return;
    if (lines.length === 0) return;
    window.speechSynthesis.cancel();
    isPlayingRef.current = true;
    indexRef.current = affirmations.currentIndex;
    setAffirmations({ isPlaying: true });
    speakNext();
  }, [lines.length, affirmations.currentIndex, setAffirmations, speakNext]);

  const handleStop = useCallback(() => {
    if (!ttsSupported) return;
    isPlayingRef.current = false;
    window.speechSynthesis.cancel();
    indexRef.current = 0;
    setAffirmations({ isPlaying: false, currentIndex: 0 });
  }, [setAffirmations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, []);

  const labelStyle = {
    color: GOLD,
    fontFamily: "monospace",
    fontSize: "0.7rem",
    letterSpacing: "0.1em",
  };
  const sectionStyle = {
    borderTop: `1px solid ${GOLD}22`,
    paddingTop: "0.75rem",
    marginTop: "0.75rem",
  };

  return (
    <div
      className="flex flex-col gap-3 font-mono"
      style={{ background: "#000", color: GOLD, padding: "0.75rem" }}
      data-ocid="affirmations-panel"
    >
      {/* Textarea */}
      <div className="flex flex-col gap-1">
        <Label style={labelStyle}>AFFIRMATIONS (ONE PER LINE)</Label>
        <Textarea
          data-ocid="affirmations-text"
          value={affirmations.text}
          onChange={(e) => setAffirmations({ text: e.target.value })}
          placeholder="I am confident&#10;I am focused&#10;I achieve my goals"
          rows={5}
          className="font-mono text-xs resize-none"
          style={{
            background: "#0a0a0a",
            color: GOLD,
            border: `1px solid ${GOLD}55`,
            outline: "none",
          }}
        />
      </div>

      {/* Current affirmation preview */}
      <div
        style={{
          background: "#0a0a0a",
          border: `1px solid ${GOLD}33`,
          padding: "0.5rem 0.75rem",
          borderRadius: "4px",
          minHeight: "2.25rem",
        }}
      >
        <span style={{ color: GOLD, fontSize: "0.75rem", opacity: 0.6 }}>
          CURRENT:{" "}
        </span>
        <span
          data-ocid="affirmations-current"
          style={{
            color: GOLD,
            fontSize: "0.8rem",
            fontStyle: currentAffirmation ? "normal" : "italic",
            opacity: currentAffirmation ? 1 : 0.4,
          }}
        >
          {currentAffirmation || "(none)"}
        </span>
      </div>

      {/* TTS Controls */}
      <div style={sectionStyle} className="flex flex-col gap-2">
        <Label style={labelStyle}>TTS CONTROLS</Label>

        {!ttsSupported && (
          <p style={{ color: "#ff4444", fontSize: "0.7rem" }}>
            ⚠ Web Speech API not supported in this browser.
          </p>
        )}

        <div className="flex gap-2">
          <Button
            data-ocid="affirmations-play"
            size="sm"
            onClick={handlePlay}
            disabled={
              !ttsSupported || affirmations.isPlaying || lines.length === 0
            }
            className="font-mono text-xs flex-1"
            style={{
              background: affirmations.isPlaying ? "#FFD70044" : GOLD,
              color: "#000",
              border: `1px solid ${GOLD}`,
              fontWeight: 700,
            }}
          >
            ▶ PLAY TTS
          </Button>
          <Button
            data-ocid="affirmations-stop"
            size="sm"
            onClick={handleStop}
            disabled={!ttsSupported || !affirmations.isPlaying}
            className="font-mono text-xs flex-1"
            style={{
              background: "transparent",
              color: GOLD,
              border: `1px solid ${GOLD}88`,
            }}
          >
            ■ STOP TTS
          </Button>
        </div>

        {/* Volume */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <Label style={labelStyle}>VOLUME</Label>
            <span style={{ color: GOLD, fontSize: "0.7rem", opacity: 0.7 }}>
              {affirmations.volume}%
            </span>
          </div>
          <Slider
            data-ocid="affirmations-volume"
            min={0}
            max={100}
            step={1}
            value={[affirmations.volume]}
            onValueChange={([v]) => setAffirmations({ volume: v })}
            style={{ "--slider-thumb-color": GOLD } as React.CSSProperties}
          />
        </div>

        {/* Speed (TTS rate) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <Label style={labelStyle}>SPEED (TTS RATE)</Label>
            <span style={{ color: GOLD, fontSize: "0.7rem", opacity: 0.7 }}>
              {affirmations.speed}% →{" "}
              {mapSpeedToRate(affirmations.speed).toFixed(2)}x
            </span>
          </div>
          <Slider
            data-ocid="affirmations-speed"
            min={0}
            max={100}
            step={1}
            value={[affirmations.speed]}
            onValueChange={([v]) => setAffirmations({ speed: v })}
          />
        </div>
      </div>

      {/* Display Controls */}
      <div style={sectionStyle} className="flex flex-col gap-2">
        <Label style={labelStyle}>DISPLAY CONTROLS</Label>

        {/* Opacity */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <Label style={labelStyle}>OPACITY</Label>
            <span style={{ color: GOLD, fontSize: "0.7rem", opacity: 0.7 }}>
              {affirmations.opacity}%
            </span>
          </div>
          <Slider
            data-ocid="affirmations-opacity"
            min={0}
            max={100}
            step={1}
            value={[affirmations.opacity]}
            onValueChange={([v]) => setAffirmations({ opacity: v })}
          />
        </div>

        {/* Font Size */}
        <div className="flex items-center gap-2">
          <Label style={labelStyle} className="w-24 shrink-0">
            FONT SIZE
          </Label>
          <Input
            data-ocid="affirmations-fontsize"
            type="number"
            min={8}
            max={120}
            value={affirmations.fontSize}
            onChange={(e) =>
              setAffirmations({ fontSize: Number(e.target.value) })
            }
            className="font-mono text-xs w-20"
            style={{
              background: "#0a0a0a",
              color: GOLD,
              border: `1px solid ${GOLD}55`,
            }}
          />
          <span style={{ color: GOLD, fontSize: "0.7rem", opacity: 0.6 }}>
            px
          </span>
        </div>

        {/* Colors */}
        <div className="flex gap-4">
          <div className="flex flex-col gap-1">
            <Label style={labelStyle}>FG COLOR</Label>
            <div className="flex items-center gap-2">
              <input
                data-ocid="affirmations-fg-color"
                type="color"
                value={affirmations.fgColor}
                onChange={(e) => setAffirmations({ fgColor: e.target.value })}
                style={{
                  width: "2rem",
                  height: "2rem",
                  border: `1px solid ${GOLD}55`,
                  background: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
              <span
                style={{
                  color: GOLD,
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                }}
              >
                {affirmations.fgColor.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label style={labelStyle}>BG COLOR</Label>
            <div className="flex items-center gap-2">
              <input
                data-ocid="affirmations-bg-color"
                type="color"
                value={affirmations.bgColor}
                onChange={(e) => setAffirmations({ bgColor: e.target.value })}
                style={{
                  width: "2rem",
                  height: "2rem",
                  border: `1px solid ${GOLD}55`,
                  background: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
              <span
                style={{
                  color: GOLD,
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                }}
              >
                {affirmations.bgColor.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
