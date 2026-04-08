import type { RefObject } from "react";
import type { AppState, IsochronicPreset } from "../types";
import { formatTime } from "./time";

// ─── WAV helpers ────────────────────────────────────────────────────────────

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const wavSize = 44 + dataSize;

  const wavBuffer = new ArrayBuffer(wavSize);
  const view = new DataView(wavBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = buffer.getChannelData(ch)[i];
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return wavBuffer;
}

// ─── Isochronic helpers ──────────────────────────────────────────────────────

const PRESET_HZ_MAP: Record<string, number | number[]> = {
  alpha: 10,
  beta: 20,
  theta: 6,
  delta: 2,
  gamma: 40,
  stress_pain_relief: 10,
  healing: 7.83,
  lightning_trail: 40,
  manifestation: 7.83,
  general_hybrid_shapeshifting: [40, 6],
  mermaid_shapeshifting: 4,
  wolf_shapeshifting: 14,
  dragon_shapeshifting: 40,
  feathered_wing_shapeshifting: 8,
  retractable_wing_shapeshifting: 8,
  symbiote_shapeshifting: 30,
  bug_shapeshifting: 3,
  bird_shapeshifting: 8,
  reptile_shapeshifting: 2,
  mammal_shapeshifting: 6,
  amphibian_shapeshifting: 4,
  invertebrate_shapeshifting: 3,
  fish_shapeshifting: 4,
  anthropomorphic_shapeshifting: 6,
  biokinesis: 10,
  nzt_omnicompetence: 40,
  organic_web_shooters: 20,
  improving_powers: [40, 10],
  teleportation_powers: 7.83,
  omniscience: 40,
  omni_manipulation: 40,
  omnificence: 40,
  omnifarious: 6,
  omni_psionics: [40, 6],
  omnilock: 2,
  alpha_reality_manipulation: 7.83,
};

const PRESET_CARRIER_MAP: Record<string, number> = {
  healing: 528,
  biokinesis: 528,
  omnificence: 528,
};

function getIsochronicPairs(
  iso: import("../types").IsochronicLayer,
): Array<{ carrier: number; lfo: number }> {
  const pairs: Array<{ carrier: number; lfo: number }> = [];
  for (const preset of iso.presets) {
    const carrier = PRESET_CARRIER_MAP[preset] ?? 200;
    const hzVal =
      preset === "custom" ? iso.customHz : (PRESET_HZ_MAP[preset] ?? 10);
    const hzList = Array.isArray(hzVal) ? hzVal : [hzVal];
    for (const lfo of hzList) {
      pairs.push({ carrier, lfo });
    }
  }
  return pairs;
}

// ─── Build audio in an OfflineAudioContext ───────────────────────────────────

async function buildOfflineAudio(state: AppState): Promise<AudioBuffer> {
  const duration = state.background.duration;
  if (duration <= 0) throw new Error("buildOfflineAudio: duration must be > 0");
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(
    2,
    Math.ceil(duration * sampleRate),
    sampleRate,
  );

  const pending: Promise<void>[] = [];

  for (const layer of state.audios) {
    if (!layer.isActive || !layer.fileUrl) continue;
    const p = (async () => {
      try {
        const resp = await fetch(layer.fileUrl!);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        const decoded = await offlineCtx.decodeAudioData(arrayBuffer);
        const source = offlineCtx.createBufferSource();
        source.buffer = decoded;
        source.loop = true;
        source.loopEnd = duration;
        const gain = offlineCtx.createGain();
        gain.gain.value = layer.volume / 100;
        source.connect(gain);
        gain.connect(offlineCtx.destination);
        source.start(0);
        console.log(
          `[buildOfflineAudio] Audio layer ${layer.id} loaded — vol=${layer.volume}%`,
        );
      } catch (err) {
        // Log but don't abort — other layers should still render
        console.warn(
          `[buildOfflineAudio] Failed to load audio layer ${layer.id}:`,
          err,
        );
      }
    })();
    pending.push(p);
  }

  await Promise.all(pending);

  if (state.staticLayer.isActive) {
    const numSamples = Math.ceil(duration * sampleRate);
    const noiseBuffer = offlineCtx.createBuffer(2, numSamples, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = noiseBuffer.getChannelData(ch);
      for (let i = 0; i < numSamples; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    const noiseSource = offlineCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = offlineCtx.createGain();
    noiseGain.gain.value = state.staticLayer.volume / 100;
    noiseSource.connect(noiseGain);
    noiseGain.connect(offlineCtx.destination);
    noiseSource.start(0);
    console.log(
      `[buildOfflineAudio] Static noise layer — vol=${state.staticLayer.volume}%`,
    );
  }

  if (state.isochronic.isActive && state.isochronic.presets.length > 0) {
    const pairs = getIsochronicPairs(state.isochronic);
    for (const { carrier: carrierFreq, lfo: isoHz } of pairs) {
      const oscillator = offlineCtx.createOscillator();
      oscillator.frequency.value = carrierFreq;
      oscillator.type = "sine";
      const lfo = offlineCtx.createOscillator();
      lfo.frequency.value = isoHz;
      lfo.type = "square";
      const lfoGain = offlineCtx.createGain();
      lfoGain.gain.value = 0.5;
      const masterGain = offlineCtx.createGain();
      masterGain.gain.value = state.isochronic.volume / 100;
      lfo.connect(lfoGain);
      lfoGain.connect(masterGain.gain);
      oscillator.connect(masterGain);
      masterGain.connect(offlineCtx.destination);
      oscillator.start(0);
      oscillator.stop(duration);
      lfo.start(0);
      lfo.stop(duration);
    }
    console.log(
      `[buildOfflineAudio] Isochronic tones — ${pairs.length} pair(s), vol=${state.isochronic.volume}%`,
    );
  }

  console.log("[buildOfflineAudio] Starting offline render...");
  const rendered = await offlineCtx.startRendering();
  console.log(
    `[buildOfflineAudio] Render complete — ${rendered.duration.toFixed(2)}s @ ${rendered.sampleRate}Hz`,
  );
  return rendered;
}

// ─── Public: exportWAV ───────────────────────────────────────────────────────

export async function exportWAV(state: AppState): Promise<void> {
  const audioBuffer = await buildOfflineAudio(state);
  const wavData = audioBufferToWav(audioBuffer);
  const blob = new Blob([wavData], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "xution-audio-export.wav";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── Progress callback type ──────────────────────────────────────────────────

export type ExportProgressCallback = (
  percent: number,
  elapsed: number,
  error?: string,
) => void;

// ─── Robust download trigger ─────────────────────────────────────────────────

function triggerDownload(
  blob: Blob,
  filename: string,
  onError?: (msg: string) => void,
): void {
  let url: string | null = null;
  try {
    url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (primaryErr) {
    console.warn("[exportVideo] Primary download trigger failed:", primaryErr);
    if (url) {
      try {
        window.open(url, "_blank");
      } catch (fallbackErr) {
        console.error(
          "[exportVideo] Fallback download also failed:",
          fallbackErr,
        );
        onError?.(
          "Download could not be triggered automatically. " +
            "Please try on desktop Chrome or a shorter duration.",
        );
      }
    } else {
      onError?.(
        "Failed to create download URL. Try a shorter duration or close other browser tabs.",
      );
    }
  } finally {
    if (url) {
      setTimeout(() => URL.revokeObjectURL(url!), 60_000);
    }
  }
}

// ─── Preset binary themes ────────────────────────────────────────────────────

const PRESET_BINARY_THEMES: Partial<Record<IsochronicPreset, string>> = {
  alpha:
    "calm mind | alpha state | peaceful focus | creative flow | mental clarity | breathe easy | gentle awareness | soft presence | centered being | open heart | serene now | balanced mind",
  beta: "sharp focus | active mind | execute now | mental clarity | engage fully | think clearly | process fast | achieve more | stay alert | analytical edge | perform peak | cognitive drive",
  theta:
    "dream deep | inner vision | subconscious opens | intuition rises | theta trance | surrender flow | imagination blooms | deep insight | mystic realm | visions emerge | soul speaks | drift within",
  delta:
    "deep sleep | cellular repair | body restores | delta healing | regenerate now | unconscious depth | recover fully | sleep profound | tissue renewal | rest complete | revitalize self | dream restores",
  gamma:
    "peak cognition | hyper aware | gamma binding | synthesize all | expand consciousness | perceive beyond | enlighten mind | integrate fully | clarity surge | neural peak | awaken fully | sense all",
  healing:
    "DNA repair | cellular healing | 528 miracle | wholeness restored | perfect health | regenerate cells | heal completely | divine repair | body restores | sacred healing | renew fully | health returns",
  manifestation:
    "reality bends | desires form | universe aligns | intention manifest | law of attraction | receive now | dream becomes real | attract abundance | creation flows | vision realized | manifest now | universe responds",
  wolf_shapeshifting:
    "wolf awakens | pack instinct rises | primal howl | silver fur spreads | moonlit transformation | feral grace | fangs emerge | wolf spirit calls | scent sharpens | hunt instinct | moon calls wolf | shift complete",
  dragon_shapeshifting:
    "scales emerge | fire breath | ancient power | dragon heart beats | wings unfold | mythic form rises | dragon awakens | flame ignites | scales harden | ascend now | draconic shift | dragon reborn",
  omniscience:
    "all knowing | past present future | omniscient mind | universe knowledge | perceive all truth | understand everything | access any knowledge | total awareness | infinite knowing | see all | omniscience active | know now",
  custom:
    "frequency tunes | resonance aligns | vibration calibrates | harmonize now | wave in phase | custom frequency | personal resonance | tune your field | align your energy | calibrate being | harmonize self | resonate now",
};

function textToBinary(text: string): string {
  return text
    .split("")
    .map((c) => c.charCodeAt(0).toString(2).padStart(8, "0"))
    .join(" ");
}

function getPresetBinaryOutput(
  activePresets: IsochronicPreset[],
  customHz: number,
): string {
  if (activePresets.length === 0) return "";
  const parts = activePresets.map((p) => {
    const theme =
      PRESET_BINARY_THEMES[p] ??
      `FREQUENCY ${customHz}Hz RESONANCE VIBRATION ALIGN`;
    return textToBinary(theme);
  });
  return parts.join(" | ");
}

// ─── Rain animation types & helpers (mirrors CanvasPreview) ──────────────────

interface RainDrop {
  y: number;
  speed: number;
  length: number;
  charOffset: number;
  flash: boolean;
}

interface RainColumn {
  x: number;
  drops: RainDrop[];
  nextSpawnTime: number;
}

function initRainColumns(
  W: number,
  fontSize: number,
  charPool: string,
): RainColumn[] {
  const colW = Math.max(fontSize * 0.65, 8);
  const numCols = Math.floor(W / colW);
  const poolLen = Math.max(1, charPool.length);
  return Array.from({ length: numCols }, (_, i) => ({
    x: i * colW + colW * 0.1,
    drops: [] as RainDrop[],
    nextSpawnTime: (((i * 37 + 13) % poolLen) / poolLen) * 3.5,
  }));
}

function updateRainColumnsExport(
  columns: RainColumn[],
  dt: number,
  H: number,
  fontSize: number,
  charPool: string,
  speedMultiplier: number,
  nextCharIndexRef: { value: number },
): void {
  if (charPool.length === 0) return;
  const charH = fontSize * 1.35;
  const minSpeed = charH * (0.5 + speedMultiplier * 2.5);
  const maxSpeed = charH * (1.2 + speedMultiplier * 5.5);
  const minLen = 4;
  const maxLen = 18;
  const poolLen = charPool.length;
  const spawnProb = 0.008 + speedMultiplier * 0.018;

  for (const col of columns) {
    for (const drop of col.drops) {
      drop.y += drop.speed * dt;
      drop.flash = Math.random() < 0.04;
    }
    col.drops = col.drops.filter((d) => d.y - d.length * charH < H + charH);
    col.nextSpawnTime -= dt;
    if (col.nextSpawnTime <= 0) {
      if (Math.random() < spawnProb + 0.7) {
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        const length = minLen + Math.floor(Math.random() * (maxLen - minLen));
        // Sequential charOffset: pick up exactly where the last drop left off
        const charOffset = nextCharIndexRef.value % poolLen;
        nextCharIndexRef.value = (nextCharIndexRef.value + length) % poolLen;
        col.drops.push({ y: -charH, speed, length, charOffset, flash: false });
      }
      col.nextSpawnTime = 0.2 + Math.random() * 2.6;
    }
  }
}

function drawRainColumnsExport(
  ctx: CanvasRenderingContext2D,
  columns: RainColumn[],
  charPool: string,
  fontSize: number,
  fgColor: string,
  opacity: number,
): void {
  if (charPool.length === 0 || opacity <= 0) return;
  const charH = fontSize * 1.35;
  const poolLen = Math.max(1, charPool.length);
  const r = Number.parseInt(fgColor.slice(1, 3), 16);
  const g = Number.parseInt(fgColor.slice(3, 5), 16);
  const b = Number.parseInt(fgColor.slice(5, 7), 16);

  ctx.save();
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  for (const col of columns) {
    for (const drop of col.drops) {
      const headY = drop.y;
      for (let i = 0; i < drop.length; i++) {
        const charY = headY - i * charH;
        if (charY > ctx.canvas.height + charH) continue;
        if (charY < -charH) break;
        const charIdx = (drop.charOffset + i) % poolLen;
        const ch = charPool[charIdx] ?? "0";
        let alpha: number;
        let drawR = r;
        let drawG = g;
        let drawB = b;
        if (i === 0) {
          alpha = opacity;
          if (drop.flash) {
            drawR = 255;
            drawG = 255;
            drawB = 255;
          } else {
            drawR = Math.min(255, r + 80);
            drawG = Math.min(255, g + 80);
            drawB = Math.min(255, b + 80);
          }
        } else {
          const trailFraction = i / drop.length;
          alpha = opacity * (1 - trailFraction) ** 1.8 * 0.95;
          const dimFactor = 0.4 + (1 - trailFraction) * 0.6;
          drawR = Math.round(r * dimFactor);
          drawG = Math.round(g * dimFactor);
          drawB = Math.round(b * dimFactor);
        }
        if (alpha < 0.01) continue;
        ctx.fillStyle = `rgba(${drawR},${drawG},${drawB},${alpha})`;
        ctx.fillText(ch, col.x, charY);
      }
    }
  }
  ctx.restore();
}

// ─── Cover-fit helper ─────────────────────────────────────────────────────────

function coverFit(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = (dstW - dw) / 2;
  const dy = (dstH - dh) / 2;
  return { dx, dy, dw, dh };
}

// ─── Standalone frame renderer ────────────────────────────────────────────────

function renderExportFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  state: AppState,
  bgEl: HTMLVideoElement | HTMLImageElement | null,
  pipEls: Array<HTMLVideoElement | HTMLImageElement | null>,
  dt: number,
  binaryRainCols: RainColumn[],
  binaryNextCharIndexRef: { value: number },
): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  if (bgEl instanceof HTMLVideoElement && bgEl.readyState >= 2) {
    const { dx, dy, dw, dh } = coverFit(
      bgEl.videoWidth || W,
      bgEl.videoHeight || H,
      W,
      H,
    );
    ctx.drawImage(bgEl, dx, dy, dw, dh);
  } else if (
    bgEl instanceof HTMLImageElement &&
    bgEl.complete &&
    bgEl.naturalWidth > 0
  ) {
    const { dx, dy, dw, dh } = coverFit(
      bgEl.naturalWidth,
      bgEl.naturalHeight,
      W,
      H,
    );
    ctx.drawImage(bgEl, dx, dy, dw, dh);
  } else {
    ctx.save();
    ctx.font = `bold ${Math.round(H * 0.06)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,215,0,0.4)";
    ctx.fillText("NO MEDIA LOADED", W / 2, H / 2);
    ctx.restore();
  }

  state.pips.forEach((pip, idx) => {
    if (!pip.isVisible) return;
    if (t < pip.startTime || t > pip.endTime) return;
    const el = pipEls[idx];
    if (!el) return;

    let natW = 0;
    let natH = 0;
    if (el instanceof HTMLVideoElement) {
      if (el.readyState < 2) return;
      natW = el.videoWidth;
      natH = el.videoHeight;
    } else if (el instanceof HTMLImageElement) {
      if (!el.complete || el.naturalWidth === 0) return;
      natW = el.naturalWidth;
      natH = el.naturalHeight;
    }
    if (natW === 0 || natH === 0) return;

    const sx = pip.cropLeft;
    const sy = pip.cropTop;
    const sw = Math.max(1, natW - pip.cropLeft - pip.cropRight);
    const sh = Math.max(1, natH - pip.cropTop - pip.cropBottom);

    ctx.save();
    ctx.globalAlpha = pip.opacity / 100;
    ctx.drawImage(
      el,
      sx,
      sy,
      sw,
      sh,
      pip.posX,
      pip.posY,
      pip.width,
      pip.height,
    );
    ctx.restore();
  });

  if (state.staticLayer.isActive && state.staticLayer.opacity > 0) {
    const alpha = state.staticLayer.opacity / 100;
    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = (alpha * 255) | 0;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  if (state.binary.binaryOutput && state.binary.opacity > 0) {
    const charPool = state.binary.binaryOutput.replace(/\s/g, "");
    const fontSize = Math.max(8, state.binary.fontSize);
    const speedMult = state.binary.speed / 100;

    updateRainColumnsExport(
      binaryRainCols,
      dt,
      H,
      fontSize,
      charPool,
      speedMult,
      binaryNextCharIndexRef,
    );
    drawRainColumnsExport(
      ctx,
      binaryRainCols,
      charPool,
      fontSize,
      state.binary.fgColor,
      state.binary.opacity / 100,
    );
  }

  if (state.isochronic.isActive && state.isochronic.presets.length > 0) {
    const presetBinaryStr = getPresetBinaryOutput(
      state.isochronic.presets,
      state.isochronic.customHz,
    );
    if (presetBinaryStr) {
      const fontSize = 10;
      const chars = presetBinaryStr.replace(/\s/g, "");
      const charsPerRow = Math.floor(W / (fontSize * 0.6));
      const startRow = Math.floor((H * 0.62) / (fontSize * 1.4));
      const totalRows = Math.ceil((H * 0.38) / (fontSize * 1.4));
      const totalChars = Math.max(1, chars.length);
      const scrollSpeed = 2;
      const offset = Math.floor(t * scrollSpeed) % totalChars;

      ctx.save();
      ctx.font = `${fontSize}px monospace`;
      ctx.textBaseline = "top";

      for (let row = 0; row < totalRows; row++) {
        const rowFraction = row / Math.max(1, totalRows - 1);
        const rowAlpha = 0.08 + rowFraction * 0.28;
        ctx.globalAlpha = rowAlpha;
        for (let col = 0; col < charsPerRow; col++) {
          const charIdx =
            (offset + (startRow + row) * charsPerRow + col) % totalChars;
          const ch = chars[charIdx] ?? "0";
          const brightness = 0.7 + (col % 5) * 0.06;
          ctx.fillStyle = `rgba(255,${Math.round(215 * brightness)},0,1)`;
          ctx.fillText(
            ch,
            col * fontSize * 0.6,
            (startRow + row) * fontSize * 1.4,
          );
        }
      }
      ctx.restore();
    }
  }

  if (
    state.affirmations.isPlaying &&
    state.affirmations.text &&
    state.affirmations.opacity > 0
  ) {
    const lines = state.affirmations.text.split("\n").filter((l) => l.trim());
    if (lines.length > 0) {
      const fontSize = Math.max(12, state.affirmations.fontSize);
      const cycleSeconds = Math.max(
        0.5,
        5 * (1 - state.affirmations.speed / 100) + 0.5,
      );
      const lineIndex = Math.floor(t / cycleSeconds) % lines.length;
      const currentLine = lines[lineIndex];

      const allText = lines.join(" ");
      const chars2 = allText.split("").filter((c) => c !== "\n");
      const charW2 = fontSize * 0.6;
      const charH2 = fontSize * 1.4;
      const cols2 = Math.floor(W / charW2);
      const rows2 = Math.floor(H / charH2);
      const total2 = Math.max(1, chars2.length);
      const scrollSpeed2 = (state.affirmations.speed / 100) * 6 + 0.5;
      const offset2 = Math.floor(t * scrollSpeed2) % total2;
      const r3 = Number.parseInt(state.affirmations.fgColor.slice(1, 3), 16);
      const g3 = Number.parseInt(state.affirmations.fgColor.slice(3, 5), 16);
      const b3 = Number.parseInt(state.affirmations.fgColor.slice(5, 7), 16);

      ctx.save();
      ctx.font = `${fontSize}px monospace`;
      ctx.textBaseline = "top";
      const baseAlpha = (state.affirmations.opacity / 100) * 0.4;
      for (let row = 0; row < rows2; row++) {
        for (let col = 0; col < cols2; col++) {
          const idx = (offset2 + row * cols2 + col) % total2;
          const ch = chars2[idx] ?? " ";
          const rowFrac = row / Math.max(1, rows2 - 1);
          const alpha = baseAlpha * (0.3 + rowFrac * 0.7);
          ctx.fillStyle = `rgba(${r3},${g3},${b3},${alpha})`;
          ctx.fillText(ch, col * charW2, row * charH2);
        }
      }

      ctx.globalAlpha = (state.affirmations.opacity / 100) * 0.85;
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const padding = 12;
      const textW = ctx.measureText(currentLine).width + padding * 2;
      const textH = fontSize + padding;
      const tx = W / 2 - textW / 2;
      const ty = Math.round(H * 0.03);
      const bgR = Number.parseInt(state.affirmations.bgColor.slice(1, 3), 16);
      const bgG = Number.parseInt(state.affirmations.bgColor.slice(3, 5), 16);
      const bgB = Number.parseInt(state.affirmations.bgColor.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${bgR},${bgG},${bgB},0.65)`;
      ctx.fillRect(tx, ty, textW, textH);
      ctx.fillStyle = state.affirmations.fgColor;
      ctx.fillText(currentLine, W / 2, ty + padding / 2);
      ctx.restore();
    }
  }
}

// ─── Load image/video element ─────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const vid = document.createElement("video");
    vid.crossOrigin = "anonymous";
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = "auto";
    vid.oncanplaythrough = () => resolve(vid);
    vid.onerror = reject;
    vid.src = url;
    vid.load();
    setTimeout(() => resolve(vid), 5000);
  });
}

// ─── Canvas blob capture helper ───────────────────────────────────────────────

function captureFrameBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

// ─── Minimal pure-JS WebM muxer ───────────────────────────────────────────────

function ebmlVInt(value: number): Uint8Array {
  if (value < 0x7f) {
    return new Uint8Array([value | 0x80]);
  }
  if (value < 0x3fff) {
    return new Uint8Array([(value >> 8) | 0x40, value & 0xff]);
  }
  if (value < 0x1fffff) {
    return new Uint8Array([
      (value >> 16) | 0x20,
      (value >> 8) & 0xff,
      value & 0xff,
    ]);
  }
  if (value < 0x0fffffff) {
    return new Uint8Array([
      (value >> 24) | 0x10,
      (value >> 16) & 0xff,
      (value >> 8) & 0xff,
      value & 0xff,
    ]);
  }
  return new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
}

function ebmlUInt(value: number): Uint8Array {
  if (value === 0) return new Uint8Array([0]);
  const bytes: number[] = [];
  let v = value;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  return new Uint8Array(bytes);
}

function ebmlFloat64(value: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, value, false);
  return new Uint8Array(buf);
}

function ebmlString(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function ebmlElem(idHex: number[], data: Uint8Array): Uint8Array {
  const id = new Uint8Array(idHex);
  const size = ebmlVInt(data.length);
  return concat(id, size, data);
}

function buildEbmlHeader(): Uint8Array {
  const ebmlVersion = ebmlElem([0x42, 0x86], ebmlUInt(1));
  const ebmlReadVersion = ebmlElem([0x42, 0xf7], ebmlUInt(1));
  const ebmlMaxIdLength = ebmlElem([0x42, 0xf2], ebmlUInt(4));
  const ebmlMaxSizeLength = ebmlElem([0x42, 0xf3], ebmlUInt(8));
  const docType = ebmlElem([0x42, 0x82], ebmlString("webm"));
  const docTypeVersion = ebmlElem([0x42, 0x87], ebmlUInt(4));
  const docTypeReadVersion = ebmlElem([0x42, 0x85], ebmlUInt(2));
  const inner = concat(
    ebmlVersion,
    ebmlReadVersion,
    ebmlMaxIdLength,
    ebmlMaxSizeLength,
    docType,
    docTypeVersion,
    docTypeReadVersion,
  );
  return ebmlElem([0x1a, 0x45, 0xdf, 0xa3], inner);
}

function buildSegmentInfo(durationMs: number): Uint8Array {
  const timecodeScale = ebmlElem([0x2a, 0xd7, 0xb1], ebmlUInt(1_000_000));
  const segDuration = ebmlElem([0x44, 0x89], ebmlFloat64(durationMs));
  const muxingApp = ebmlElem([0x4d, 0x80], ebmlString("xution-video-muxer"));
  const writingApp = ebmlElem([0x57, 0x41], ebmlString("xution-video-muxer"));
  const inner = concat(timecodeScale, segDuration, muxingApp, writingApp);
  return ebmlElem([0x15, 0x49, 0xa9, 0x66], inner);
}

// Build Tracks for video-only or video+audio (PCM Int16)
function buildTracks(
  width: number,
  height: number,
  frameRateNum: number,
  frameRateDen: number,
  audioSampleRate?: number,
  audioChannels?: number,
): Uint8Array {
  const frameRateFloat = frameRateNum / frameRateDen;

  // Video track entry — V_MJPEG because we store JPEG/WebP image frames
  const pixelWidth = ebmlElem([0xb0], ebmlUInt(width));
  const pixelHeight = ebmlElem([0xba], ebmlUInt(height));
  const frameRate = ebmlElem([0x23, 0x83, 0xe3], ebmlFloat64(frameRateFloat));
  const videoInner = concat(pixelWidth, pixelHeight, frameRate);
  const videoElem = ebmlElem([0xe0], videoInner);

  const videoTrackEntry = concat(
    ebmlElem([0xd7], ebmlUInt(1)), // TrackNumber
    ebmlElem([0x73, 0xc5], ebmlUInt(1)), // TrackUID
    ebmlElem([0x83], ebmlUInt(1)), // TrackType: video
    ebmlElem([0xb9], ebmlUInt(1)), // FlagEnabled
    ebmlElem([0x88], ebmlUInt(1)), // FlagDefault
    ebmlElem(
      [0x23, 0xe3, 0x83],
      ebmlUInt(Math.round(1_000_000_000 / frameRateFloat)),
    ), // DefaultDuration (ns)
    ebmlElem([0x86], ebmlString("V_MJPEG")), // CodecID: Motion JPEG (our frames are JPEG/WebP)
    videoElem,
  );
  const videoTrackElem = ebmlElem([0xae], videoTrackEntry);

  if (!audioSampleRate || !audioChannels) {
    return ebmlElem([0x16, 0x54, 0xae, 0x6b], videoTrackElem);
  }

  // Audio track entry — PCM Int16 little-endian (most universally compatible)
  const samplingFreq = ebmlElem([0xb5], ebmlFloat64(audioSampleRate));
  const channels = ebmlElem([0x9f], ebmlUInt(audioChannels));
  const bitDepth = ebmlElem([0x62, 0x64], ebmlUInt(16)); // 16-bit Int
  const audioElem = ebmlElem([0xe1], concat(samplingFreq, channels, bitDepth));

  const audioTrackEntry = concat(
    ebmlElem([0xd7], ebmlUInt(2)), // TrackNumber
    ebmlElem([0x73, 0xc5], ebmlUInt(2)), // TrackUID
    ebmlElem([0x83], ebmlUInt(2)), // TrackType: audio
    ebmlElem([0xb9], ebmlUInt(1)), // FlagEnabled
    ebmlElem([0x88], ebmlUInt(1)), // FlagDefault
    ebmlElem([0x86], ebmlString("A_PCM/INT/LIT")), // CodecID: PCM Int16 LE — universally supported
    audioElem,
  );
  const audioTrackElem = ebmlElem([0xae], audioTrackEntry);

  return ebmlElem(
    [0x16, 0x54, 0xae, 0x6b],
    concat(videoTrackElem, audioTrackElem),
  );
}

// Build a cluster containing SimpleBlocks for one or both tracks
function buildCluster(
  timecodeMs: number,
  frames: Array<{
    offsetMs: number;
    trackNum: number;
    data: Uint8Array;
    isKeyframe?: boolean;
  }>,
): Uint8Array {
  const timecode = ebmlElem([0xe7], ebmlUInt(timecodeMs));
  const blocks: Uint8Array[] = [timecode];

  for (const frame of frames) {
    const relTimecode = Math.max(0, frame.offsetMs);
    const trackVInt = ebmlVInt(frame.trackNum);
    const tcBytes = new Uint8Array(2);
    new DataView(tcBytes.buffer).setInt16(0, relTimecode & 0x7fff, false);
    const flags = new Uint8Array([frame.isKeyframe !== false ? 0x80 : 0x00]);
    const simpleBlockData = concat(trackVInt, tcBytes, flags, frame.data);
    const simpleBlock = ebmlElem([0xa3], simpleBlockData);
    blocks.push(simpleBlock);
  }

  const inner = concat(...blocks);
  return ebmlElem([0x1f, 0x43, 0xb6, 0x75], inner);
}

interface WebMFrame {
  timecodeMs: number;
  data: Uint8Array;
  trackNum?: number;
  isKeyframe?: boolean;
}

function buildWebM(
  width: number,
  height: number,
  fps: number,
  frames: WebMFrame[],
  audioFrames?: WebMFrame[],
  audioSampleRate?: number,
  audioChannels?: number,
): Blob {
  const videoFrames = frames;
  const lastVideoMs =
    videoFrames.length > 0
      ? videoFrames[videoFrames.length - 1].timecodeMs + Math.round(1000 / fps)
      : 0;
  const lastAudioMs =
    audioFrames && audioFrames.length > 0
      ? audioFrames[audioFrames.length - 1].timecodeMs + 20
      : 0;
  const durationMs = Math.max(lastVideoMs, lastAudioMs);

  const ebmlHeader = buildEbmlHeader();
  const segInfo = buildSegmentInfo(durationMs);
  const tracks = buildTracks(
    width,
    height,
    fps,
    1,
    audioFrames && audioFrames.length > 0 ? audioSampleRate : undefined,
    audioFrames && audioFrames.length > 0 ? audioChannels : undefined,
  );

  // Interleave video and audio frames into clusters of ~1 second
  const CLUSTER_DURATION_MS = 1000;
  const clusters: Uint8Array[] = [];

  type MuxFrame = {
    timecodeMs: number;
    trackNum: number;
    data: Uint8Array;
    isKeyframe?: boolean;
  };
  const allFrames: MuxFrame[] = [
    ...videoFrames.map((f) => ({
      timecodeMs: f.timecodeMs,
      trackNum: 1,
      data: f.data,
      isKeyframe: true,
    })),
    ...(audioFrames ?? []).map((f) => ({
      timecodeMs: f.timecodeMs,
      trackNum: 2,
      data: f.data,
      isKeyframe: f.isKeyframe !== false,
    })),
  ].sort((a, b) => a.timecodeMs - b.timecodeMs || a.trackNum - b.trackNum);

  let clusterStart = 0;
  let clusterFrames: Array<{
    offsetMs: number;
    trackNum: number;
    data: Uint8Array;
    isKeyframe?: boolean;
  }> = [];

  for (const frame of allFrames) {
    if (
      frame.timecodeMs >= clusterStart + CLUSTER_DURATION_MS &&
      clusterFrames.length > 0
    ) {
      clusters.push(buildCluster(clusterStart, clusterFrames));
      clusterStart = frame.timecodeMs;
      clusterFrames = [];
    }
    clusterFrames.push({
      offsetMs: frame.timecodeMs - clusterStart,
      trackNum: frame.trackNum,
      data: frame.data,
      isKeyframe: frame.isKeyframe,
    });
  }
  if (clusterFrames.length > 0) {
    clusters.push(buildCluster(clusterStart, clusterFrames));
  }

  const segBody = concat(segInfo, tracks, ...clusters);
  const segId = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
  const segSize = new Uint8Array([
    0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  ]);
  const segment = concat(segId, segSize, segBody);

  return new Blob(
    [ebmlHeader.buffer as ArrayBuffer, segment.buffer as ArrayBuffer],
    { type: "video/webm" },
  );
}

// ─── Convert AudioBuffer to interleaved PCM Int16 WebM audio frames ──────────
//
// Splits the rendered AudioBuffer into ~100ms PCM chunks encoded as Int16 LE,
// one WebMFrame per chunk. This is muxed as A_PCM/INT/LIT which is the most
// universally compatible raw PCM format for WebM containers.

function audioBufferToPcmFrames(
  buffer: AudioBuffer,
  chunkDurationSec = 0.1,
): WebMFrame[] {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const totalSamples = buffer.length;
  const samplesPerChunk = Math.ceil(sampleRate * chunkDurationSec);
  const frames: WebMFrame[] = [];

  for (
    let startSample = 0;
    startSample < totalSamples;
    startSample += samplesPerChunk
  ) {
    const endSample = Math.min(startSample + samplesPerChunk, totalSamples);
    const chunkSamples = endSample - startSample;
    // Interleaved Int16 little-endian: L0 R0 L1 R1 ...
    const pcmData = new Int16Array(chunkSamples * numChannels);
    for (let i = 0; i < chunkSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const f = Math.max(
          -1,
          Math.min(1, buffer.getChannelData(ch)[startSample + i]),
        );
        // Convert float32 [-1..1] to int16 [-32768..32767]
        pcmData[i * numChannels + ch] =
          f < 0 ? Math.round(f * 32768) : Math.round(f * 32767);
      }
    }
    const timecodeMs = Math.round((startSample / sampleRate) * 1000);
    frames.push({
      timecodeMs,
      data: new Uint8Array(pcmData.buffer),
      trackNum: 2,
      isKeyframe: true,
    });
  }

  return frames;
}

// ─── Primary: MediaRecorder with pre-rendered audio via BufferSourceNode ──────
//
// NOTE: MediaRecorder is unreliable on mobile Chrome for canvas capture with
// audio. This function is kept for desktop Chrome but falls back gracefully.
// The primary path for mobile is the frame-by-frame WebM muxer in exportMP4.

async function tryMediaRecorderExport(
  state: AppState,
  liveCanvas: HTMLCanvasElement,
  onProgress: ExportProgressCallback,
): Promise<Blob | null> {
  // Skip MediaRecorder on mobile — it consistently fails to capture canvas frames
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    console.log(
      "[exportVideo] Mobile detected — skipping MediaRecorder, using frame-by-frame muxer",
    );
    return null;
  }

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
    ? "video/webm;codecs=vp8,opus"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : null;

  if (!mimeType) {
    console.log(
      "[exportVideo] MediaRecorder does not support webm — using fallback",
    );
    return null;
  }

  console.log(`[exportVideo] Trying MediaRecorder with mimeType=${mimeType}`);

  const duration = state.background.duration;
  const fps = duration > 300 ? 15 : duration > 60 ? 20 : 24;

  const hasAudio =
    state.audios.some((a) => a.isActive && a.fileUrl) ||
    state.staticLayer.isActive ||
    (state.isochronic.isActive && state.isochronic.presets.length > 0);

  // Step 1: render audio offline — this is deterministic and always works
  let audioCtx: AudioContext | null = null;
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  let audioBufferSource: AudioBufferSourceNode | null = null;

  if (hasAudio) {
    onProgress(3, 0);
    console.log("[exportVideo] Rendering audio offline before recording...");
    try {
      const renderedBuffer = await buildOfflineAudio(state);
      // Resume or create AudioContext — must happen from user gesture context
      audioCtx = new AudioContext({ sampleRate: renderedBuffer.sampleRate });
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      audioDestination = audioCtx.createMediaStreamDestination();
      audioBufferSource = audioCtx.createBufferSource();
      audioBufferSource.buffer = renderedBuffer;
      audioBufferSource.connect(audioDestination);
      console.log(
        `[exportVideo] Offline render ready — ${renderedBuffer.duration.toFixed(1)}s`,
      );
    } catch (e) {
      console.warn("[exportVideo] Offline audio render failed:", e);
      audioCtx = null;
      audioDestination = null;
      audioBufferSource = null;
    }
  }

  return new Promise<Blob | null>((resolve) => {
    // Combine canvas video stream + pre-rendered audio stream
    const videoStream = liveCanvas.captureStream(fps);
    let combinedStream: MediaStream;

    if (audioDestination) {
      combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);
      console.log(
        "[exportVideo] Combined canvas video + pre-rendered audio stream",
      );
    } else {
      combinedStream = videoStream;
      console.log("[exportVideo] No audio — recording video only");
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(combinedStream, { mimeType });
    } catch {
      console.warn("[exportVideo] MediaRecorder constructor failed");
      audioCtx?.close();
      resolve(null);
      return;
    }

    const chunks: Blob[] = [];
    let gotData = false;
    const startTime = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
        gotData = true;
      }
    };

    recorder.onstop = () => {
      try {
        audioBufferSource?.stop();
      } catch {}
      setTimeout(() => {
        try {
          audioCtx?.close();
        } catch {}
      }, 500);

      if (!gotData || chunks.length === 0) {
        console.warn("[exportVideo] MediaRecorder produced no data");
        resolve(null);
        return;
      }
      const blob = new Blob(chunks, { type: "video/webm" });
      console.log(
        `[exportVideo] MediaRecorder success — size=${(blob.size / 1024 / 1024).toFixed(1)}MB`,
      );
      resolve(blob);
    };

    recorder.onerror = () => {
      try {
        audioBufferSource?.stop();
      } catch {}
      audioCtx?.close();
      console.warn("[exportVideo] MediaRecorder error");
      resolve(null);
    };

    // Start audio source node at the exact same time as recorder
    // This ensures perfect sync: audio plays from t=0 as recording begins
    audioBufferSource?.start(0);
    recorder.start(200);

    const totalMs = duration * 1000;
    let rafId = 0;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const percent = Math.min(95, 5 + Math.round((elapsed / totalMs) * 90));
      onProgress(percent, elapsed / 1000);

      if (elapsed < totalMs) {
        rafId = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(rafId);
        setTimeout(() => {
          recorder.requestData();
          setTimeout(() => recorder.stop(), 500);
        }, 300);
      }
    };

    rafId = requestAnimationFrame(tick);

    // Safety timeout: if no data after 8s, give up
    setTimeout(() => {
      if (!gotData && recorder.state !== "inactive") {
        console.warn(
          "[exportVideo] MediaRecorder timed out with no data — aborting",
        );
        cancelAnimationFrame(rafId);
        try {
          audioBufferSource?.stop();
        } catch {}
        recorder.stop();
        resolve(null);
      }
    }, 8000);
  });
}

// ─── Public: exportMP4 ────────────────────────────────────────────────────────
//
// Strategy:
//   1. Pre-render audio offline to AudioBuffer (deterministic, always includes
//      uploaded files + static noise + isochronic tones).
//   2. On mobile: skip MediaRecorder (unreliable), go straight to frame-by-frame
//      WebM muxer with Int16 PCM audio track (A_PCM/INT/LIT). Video frames are
//      stored as V_MJPEG (JPEG/WebP images per frame).
//   3. On desktop: try MediaRecorder with canvas stream + BufferSourceNode audio.
//      If it produces no data, fall back to the same frame-by-frame muxer.

export async function exportMP4(
  state: AppState,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onProgress?: ExportProgressCallback,
): Promise<void> {
  const progress = onProgress ?? (() => {});

  const liveCanvas = canvasRef.current;
  if (!liveCanvas) {
    throw new Error(
      "Canvas not available. Please wait for preview to initialize.",
    );
  }

  const W = liveCanvas.width || 1280;
  const H = liveCanvas.height || 720;
  const duration = state.background.duration;

  // ── Step 1: Try MediaRecorder with pre-rendered audio ───────────────────────
  const mrBlob = await tryMediaRecorderExport(
    state,
    liveCanvas,
    (pct, elapsed) => {
      progress(pct, elapsed);
    },
  );

  if (mrBlob && mrBlob.size > 10_000) {
    progress(100, duration);
    triggerDownload(mrBlob, "xution-video-export.webm", (err) => {
      progress(100, duration, err);
    });
    return;
  }

  // ── Step 2: Pure-JS WebM muxer with PCM audio ──────────────────────────────
  console.log(
    "[exportVideo] Falling back to frame-by-frame WebM muxer with PCM audio",
  );

  const fps = duration > 300 ? 15 : duration > 60 ? 20 : 24;
  const totalFrames = Math.ceil(duration * fps);
  const startRealTime = Date.now();

  console.log(
    `[exportVideo] Frame-by-frame WebM — ${W}x${H}, ${fps}fps, ${totalFrames} frames`,
  );

  // Pre-render audio to buffer now (before frame loop) so it's ready to mux
  let renderedAudioBuffer: AudioBuffer | null = null;
  const hasAudio =
    state.audios.some((a) => a.isActive && a.fileUrl) ||
    state.staticLayer.isActive ||
    (state.isochronic.isActive && state.isochronic.presets.length > 0);

  if (hasAudio) {
    progress(5, 0);
    console.log("[exportVideo] Pre-rendering audio for fallback muxer...");
    try {
      renderedAudioBuffer = await buildOfflineAudio(state);
      console.log(
        `[exportVideo] Audio pre-render done — ${renderedAudioBuffer.duration.toFixed(1)}s`,
      );
    } catch (e) {
      console.warn("[exportVideo] Audio pre-render failed:", e);
    }
  }

  // Create offscreen canvas for rendering
  const offscreen = document.createElement("canvas");
  offscreen.width = W;
  offscreen.height = H;
  const ctx = offscreen.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Could not get 2D context for export canvas.");
  }

  // Load background media
  let bgEl: HTMLVideoElement | HTMLImageElement | null = null;
  if (state.background.fileUrl) {
    try {
      if (state.background.fileType === "video") {
        bgEl = await loadVideo(state.background.fileUrl);
        (bgEl as HTMLVideoElement).muted = true;
      } else if (state.background.fileType === "image") {
        bgEl = await loadImage(state.background.fileUrl);
      }
    } catch (e) {
      console.warn("[exportVideo] Failed to load background:", e);
    }
  }

  // Load PiP media elements
  const pipEls: Array<HTMLVideoElement | HTMLImageElement | null> = [
    null,
    null,
    null,
    null,
  ];
  await Promise.all(
    state.pips.map(async (pip, idx) => {
      if (!pip.fileUrl || !pip.isVisible) return;
      try {
        if (pip.fileType === "video") {
          pipEls[idx] = await loadVideo(pip.fileUrl);
          (pipEls[idx] as HTMLVideoElement).muted = true;
        } else if (pip.fileType === "image") {
          pipEls[idx] = await loadImage(pip.fileUrl);
        }
      } catch (e) {
        console.warn(`[exportVideo] Failed to load PiP ${idx + 1}:`, e);
      }
    }),
  );

  const supportsWebP = offscreen
    .toDataURL("image/webp")
    .startsWith("data:image/webp");
  const captureType = supportsWebP ? "image/webp" : "image/jpeg";
  const captureQuality = 0.85;
  console.log(`[exportVideo] Frame capture format: ${captureType}`);

  const webmFrames: WebMFrame[] = [];
  const frameDt = 1 / fps;

  const exportBinaryRainCols: RainColumn[] =
    state.binary.binaryOutput && state.binary.opacity > 0
      ? initRainColumns(
          W,
          Math.max(8, state.binary.fontSize),
          state.binary.binaryOutput.replace(/\s/g, ""),
        )
      : [];
  const exportBinaryNextCharRef = { value: 0 };

  // Frame rendering loop — audio is pre-rendered so no parallel capture needed
  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    const t = frameIdx / fps;
    const timecodeMs = Math.round(t * 1000);

    if (bgEl instanceof HTMLVideoElement) {
      const vidDur = bgEl.duration || duration;
      bgEl.currentTime = t % vidDur;
      if (frameIdx === 0) {
        await new Promise<void>((r) => setTimeout(r, 100));
      }
    }
    for (const el of pipEls) {
      if (el instanceof HTMLVideoElement) {
        const vidDur = el.duration || duration;
        el.currentTime = t % vidDur;
      }
    }

    renderExportFrame(
      ctx,
      W,
      H,
      t,
      state,
      bgEl,
      pipEls,
      frameDt,
      exportBinaryRainCols,
      exportBinaryNextCharRef,
    );

    const blob = await captureFrameBlob(offscreen, captureType, captureQuality);
    if (blob) {
      const arrayBuffer = await blob.arrayBuffer();
      webmFrames.push({ timecodeMs, data: new Uint8Array(arrayBuffer) });
    }

    // Progress: 10–85% for video frames
    const percent = 10 + Math.round(((frameIdx + 1) / totalFrames) * 75);
    const elapsed = (Date.now() - startRealTime) / 1000;
    progress(percent, elapsed);

    if (frameIdx % 10 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  progress(85, (Date.now() - startRealTime) / 1000);
  console.log("[exportVideo] All frames captured. Converting audio to PCM...");

  // Convert the pre-rendered AudioBuffer to PCM WebM frames — no codec needed
  let audioWebMFrames: WebMFrame[] | undefined;
  let audioSampleRate: number | undefined;
  let audioChannels: number | undefined;

  if (renderedAudioBuffer) {
    try {
      audioWebMFrames = audioBufferToPcmFrames(renderedAudioBuffer, 0.1);
      audioSampleRate = renderedAudioBuffer.sampleRate;
      audioChannels = renderedAudioBuffer.numberOfChannels;
      console.log(
        `[exportVideo] PCM audio frames: ${audioWebMFrames.length} chunks @ ${audioSampleRate}Hz`,
      );
    } catch (e) {
      console.warn("[exportVideo] PCM audio frame conversion failed:", e);
      audioWebMFrames = undefined;
    }
  }

  progress(90, (Date.now() - startRealTime) / 1000);
  console.log("[exportVideo] Assembling WebM container...");

  const videoBlob =
    audioWebMFrames && audioWebMFrames.length > 0
      ? buildWebM(
          W,
          H,
          fps,
          webmFrames,
          audioWebMFrames,
          audioSampleRate,
          audioChannels,
        )
      : buildWebM(W, H, fps, webmFrames);

  console.log(
    `[exportVideo] WebM assembled — size=${(videoBlob.size / 1024 / 1024).toFixed(1)}MB, audio=${audioWebMFrames?.length ?? 0} PCM chunks`,
  );

  progress(100, (Date.now() - startRealTime) / 1000);

  triggerDownload(videoBlob, "xution-video-export.webm", (err) => {
    progress(100, (Date.now() - startRealTime) / 1000, err);
  });
}

// Ensure formatTime is referenced (imported but needed for other callers)
void formatTime;
