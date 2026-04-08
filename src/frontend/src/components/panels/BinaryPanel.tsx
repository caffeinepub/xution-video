import { useCallback, useRef } from "react";
import { useAppStore } from "../../store/useAppStore";

// ---------- types ---------------------------------------------------------- //
type WebAudioContext = AudioContext & { state: AudioContextState };
interface OscScheduled {
  osc: OscillatorNode;
  gain: GainNode;
}

// ---------- helpers --------------------------------------------------------- //
const LABEL_CLS =
  "block text-[10px] tracking-[0.2em] uppercase text-[#FFD700]/60 mb-1";
const SECTION_CLS =
  "flex flex-col gap-1 border-t border-[#FFD700]/10 pt-3 mt-3";
const SLIDER_CLS =
  "w-full h-1 appearance-none bg-[#1a1a00] cursor-pointer accent-[#FFD700]";

// ---------- component ------------------------------------------------------- //
export function BinaryPanel() {
  const binary = useAppStore((s) => s.binary);
  const setBinary = useAppStore((s) => s.setBinary);

  // Audio refs
  const audioCtxRef = useRef<WebAudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeOscsRef = useRef<OscScheduled[]>([]);
  const playLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);

  // ---------- audio --------------------------------------------------------- //
  const getAudioCtx = useCallback((): WebAudioContext => {
    if (!audioCtxRef.current) {
      const Ctx =
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext ?? AudioContext;
      audioCtxRef.current = new Ctx() as WebAudioContext;
    }
    return audioCtxRef.current;
  }, []);

  const getMasterGain = useCallback((ctx: AudioContext): GainNode => {
    if (!masterGainRef.current) {
      const g = ctx.createGain();
      g.connect(ctx.destination);
      masterGainRef.current = g;
    }
    return masterGainRef.current;
  }, []);

  const stopAllOscs = useCallback(() => {
    for (const { osc, gain } of activeOscsRef.current) {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      } catch {
        // already stopped
      }
    }
    activeOscsRef.current = [];
    if (playLoopRef.current) {
      clearTimeout(playLoopRef.current);
      playLoopRef.current = null;
    }
  }, []);

  const playBinarySequence = useCallback(
    (bits: string, volume: number) => {
      const ctx = getAudioCtx();
      const master = getMasterGain(ctx);
      master.gain.setValueAtTime(volume / 100, ctx.currentTime);

      const bitArray = bits.replace(/\s/g, "").split("");
      if (!bitArray.length) return;

      let offset = ctx.currentTime + 0.01;
      const bitDuration = 0.08; // 80ms
      const gapDuration = 0.04; // 40ms

      for (const bit of bitArray) {
        const freq = bit === "1" ? 900 : 300;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, offset);

        gain.gain.setValueAtTime(0.0001, offset);
        gain.gain.linearRampToValueAtTime(1, offset + 0.005);
        gain.gain.setValueAtTime(1, offset + bitDuration - 0.01);
        gain.gain.linearRampToValueAtTime(0.0001, offset + bitDuration);

        osc.connect(gain);
        gain.connect(master);
        osc.start(offset);
        osc.stop(offset + bitDuration);

        activeOscsRef.current.push({ osc, gain });
        offset += bitDuration + gapDuration;
      }

      const totalMs = (bitDuration + gapDuration) * bitArray.length * 1000;
      playLoopRef.current = setTimeout(() => {
        if (isPlayingRef.current) {
          activeOscsRef.current = [];
          playBinarySequence(bits, volume);
        }
      }, totalMs + 20);
    },
    [getAudioCtx, getMasterGain],
  );

  const handlePlay = useCallback(() => {
    if (!binary.binaryOutput) return;
    stopAllOscs();
    isPlayingRef.current = true;
    setBinary({ isPlaying: true });
    playBinarySequence(binary.binaryOutput, binary.volume);
  }, [
    binary.binaryOutput,
    binary.volume,
    playBinarySequence,
    setBinary,
    stopAllOscs,
  ]);

  const handleStop = useCallback(() => {
    isPlayingRef.current = false;
    stopAllOscs();
    setBinary({ isPlaying: false });
  }, [setBinary, stopAllOscs]);

  const handleVolumeChange = useCallback(
    (val: number) => {
      setBinary({ volume: val });
      if (masterGainRef.current && audioCtxRef.current) {
        masterGainRef.current.gain.setValueAtTime(
          val / 100,
          audioCtxRef.current.currentTime,
        );
      }
    },
    [setBinary],
  );

  // ---------- derived -------------------------------------------------------- //
  const previewBinary = binary.binaryOutput.slice(0, 64);

  // ---------- render --------------------------------------------------------- //
  return (
    <div className="flex flex-col gap-3 px-1 py-2 font-mono text-[#FFD700]">
      {/* ── INPUT TEXT ─────────────────────────────────────────────────────── */}
      <div>
        <label className={LABEL_CLS} htmlFor="binary-input">
          Input Text
        </label>
        <textarea
          id="binary-input"
          data-ocid="binary-input"
          rows={3}
          value={binary.inputText}
          onChange={(e) => setBinary({ inputText: e.target.value })}
          placeholder="Type to convert to binary…"
          className="w-full bg-black border border-[#FFD700]/30 focus:border-[#FFD700]/70 text-[#FFD700] text-xs p-2 resize-none outline-none placeholder:text-[#FFD700]/20 font-mono"
        />
      </div>

      {/* ── BINARY OUTPUT ───────────────────────────────────────────────────── */}
      <div>
        <label className={LABEL_CLS} htmlFor="binary-output">
          Binary Output
        </label>
        <textarea
          id="binary-output"
          data-ocid="binary-output"
          rows={4}
          readOnly
          value={binary.binaryOutput}
          className="w-full bg-[#0a0a00] border border-[#FFD700]/20 text-[#FFD700] text-[10px] p-2 resize-none outline-none font-mono leading-relaxed"
        />
      </div>

      {/* ── PREVIEW ─────────────────────────────────────────────────────────── */}
      {previewBinary && (
        <div
          data-ocid="binary-preview"
          className="border border-[#FFD700]/15 bg-[#050500] p-2"
        >
          <span className={LABEL_CLS}>Preview (64 chars)</span>
          <div
            className="text-[#FFD700]/70 text-[9px] font-mono leading-relaxed"
            style={{ wordBreak: "break-all" }}
          >
            {previewBinary}
          </div>
        </div>
      )}

      {/* ── AUDIO CONTROLS ──────────────────────────────────────────────────── */}
      <div className={SECTION_CLS}>
        <span className={LABEL_CLS}>Binary Audio</span>

        <button
          type="button"
          data-ocid="binary-audio-play"
          disabled={!binary.binaryOutput}
          onClick={binary.isPlaying ? handleStop : handlePlay}
          className={[
            "w-full py-1 text-xs font-bold tracking-widest uppercase border transition-colors duration-200",
            binary.isPlaying
              ? "bg-[#FFD700]/20 border-[#FFD700] text-[#FFD700]"
              : "bg-transparent border-[#FFD700]/50 text-[#FFD700]/70 hover:bg-[#FFD700]/10 hover:border-[#FFD700] hover:text-[#FFD700]",
            !binary.binaryOutput ? "opacity-30 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {binary.isPlaying ? "■ STOP" : "▶ PLAY BINARY AUDIO"}
        </button>

        <div className="mt-1">
          <label className={LABEL_CLS} htmlFor="binary-audio-vol">
            Volume — {binary.volume}%
          </label>
          <input
            id="binary-audio-vol"
            data-ocid="binary-audio-vol"
            type="range"
            min={0}
            max={100}
            value={binary.volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className={SLIDER_CLS}
          />
        </div>
      </div>

      {/* ── VISUAL OVERLAY ──────────────────────────────────────────────────── */}
      <div className={SECTION_CLS}>
        <span className={LABEL_CLS}>Visual Overlay</span>

        {/* Opacity */}
        <div>
          <label className={LABEL_CLS} htmlFor="binary-opacity">
            Opacity — {binary.opacity}%
          </label>
          <input
            id="binary-opacity"
            data-ocid="binary-opacity"
            type="range"
            min={0}
            max={100}
            value={binary.opacity}
            onChange={(e) => setBinary({ opacity: Number(e.target.value) })}
            className={SLIDER_CLS}
          />
        </div>

        {/* Speed */}
        <div>
          <label className={LABEL_CLS} htmlFor="binary-speed">
            Speed — {binary.speed}%
          </label>
          <input
            id="binary-speed"
            data-ocid="binary-speed"
            type="range"
            min={0}
            max={100}
            value={binary.speed}
            onChange={(e) => setBinary({ speed: Number(e.target.value) })}
            className={SLIDER_CLS}
          />
        </div>

        {/* Font Size */}
        <div>
          <label className={LABEL_CLS} htmlFor="binary-font-size">
            Font Size (px)
          </label>
          <input
            id="binary-font-size"
            data-ocid="binary-font-size"
            type="number"
            min={8}
            max={72}
            value={binary.fontSize}
            onChange={(e) => setBinary({ fontSize: Number(e.target.value) })}
            className="w-full bg-black border border-[#FFD700]/30 focus:border-[#FFD700]/70 text-[#FFD700] text-xs px-2 py-1 outline-none font-mono"
          />
        </div>

        {/* Colors row */}
        <div className="flex items-start gap-3 mt-1">
          {/* FG Color */}
          <div className="flex-1">
            <label className={LABEL_CLS} htmlFor="binary-fg-color">
              FG Color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="binary-fg-color"
                data-ocid="binary-fg-color"
                type="color"
                value={binary.fgColor}
                onChange={(e) => setBinary({ fgColor: e.target.value })}
                className="w-8 h-6 bg-black border border-[#FFD700]/30 cursor-pointer p-0"
              />
              <span className="text-[10px] text-[#FFD700]/50 font-mono">
                {binary.fgColor.toUpperCase()}
              </span>
            </div>
          </div>

          {/* BG Color */}
          <div className="flex-1">
            <label className={LABEL_CLS} htmlFor="binary-bg-color">
              BG Color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="binary-bg-color"
                data-ocid="binary-bg-color"
                type="color"
                value={binary.bgColor}
                onChange={(e) => setBinary({ bgColor: e.target.value })}
                className="w-8 h-6 bg-black border border-[#FFD700]/30 cursor-pointer p-0"
              />
              <span className="text-[10px] text-[#FFD700]/50 font-mono">
                {binary.bgColor.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── LIVE SWATCH ─────────────────────────────────────────────────────── */}
      <div
        data-ocid="binary-swatch"
        className="border border-[#FFD700]/15 p-2 flex items-center justify-center"
        style={{
          background: binary.bgColor,
          opacity: binary.opacity / 100,
          minHeight: "32px",
        }}
      >
        <span
          style={{
            color: binary.fgColor,
            fontSize: `${Math.min(binary.fontSize, 20)}px`,
            fontFamily: "monospace",
          }}
        >
          01001000 01100101 01101100
        </span>
      </div>
    </div>
  );
}
