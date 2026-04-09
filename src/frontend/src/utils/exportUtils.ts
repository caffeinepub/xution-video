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
  return new Promise((resolve) => {
    const vid = document.createElement("video");
    vid.crossOrigin = "anonymous";
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = "auto";
    vid.oncanplaythrough = () => resolve(vid);
    vid.onerror = () => resolve(vid); // resolve anyway so export continues
    vid.src = url;
    vid.load();
    setTimeout(() => resolve(vid), 5000);
  });
}

// ─── Detect best supported MediaRecorder mime type ───────────────────────────

function getBestMimeType(): string | null {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

// ─── Public: exportMP4 ────────────────────────────────────────────────────────
//
// Strategy:
//   1. Pre-render all audio to an AudioBuffer via OfflineAudioContext.
//   2. Create an OFFSCREEN canvas (same size as live canvas) — MediaRecorder
//      only reliably captures the canvas it was set up with. Using offscreen
//      avoids interfering with the live preview canvas.
//   3. Feed canvas.captureStream() + AudioContext→BufferSource→MediaStreamDest
//      as a single combined MediaStream into MediaRecorder.
//   4. Run a setInterval render loop that draws each frame onto the offscreen
//      canvas at the target fps for totalDuration seconds.
//   5. Stop MediaRecorder → collect chunks → download as .webm.
//
// This path works on desktop Chrome, Firefox, and Safari (where MediaRecorder
// supports canvas capture). Mobile Chrome is unreliable for canvas capture
// and gets a clear error message rather than a broken file.

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

  if (duration <= 0) {
    throw new Error(
      "Duration must be greater than 0. Set a background duration first.",
    );
  }

  // Check MediaRecorder support
  const mimeType = getBestMimeType();
  if (!mimeType) {
    throw new Error(
      "Your browser does not support WebM video recording. " +
        "Please use Chrome, Firefox, or Edge on desktop.",
    );
  }

  console.log(
    `[exportVideo] Starting export — ${W}x${H}, ${duration}s, mimeType=${mimeType}`,
  );
  progress(2, 0);

  // ── Step 1: Pre-render all audio offline ────────────────────────────────────
  const hasAudio =
    state.audios.some((a) => a.isActive && a.fileUrl) ||
    state.staticLayer.isActive ||
    (state.isochronic.isActive && state.isochronic.presets.length > 0);

  let renderedAudioBuffer: AudioBuffer | null = null;
  if (hasAudio) {
    console.log("[exportVideo] Pre-rendering audio offline...");
    progress(5, 0);
    try {
      renderedAudioBuffer = await buildOfflineAudio(state);
      console.log(
        `[exportVideo] Audio ready — ${renderedAudioBuffer.duration.toFixed(1)}s`,
      );
    } catch (e) {
      console.warn(
        "[exportVideo] Audio pre-render failed (continuing without audio):",
        e,
      );
    }
  }

  progress(10, 0);

  // ── Step 2: Load all media elements ─────────────────────────────────────────
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

  progress(15, 0);

  // ── Step 3: Create offscreen canvas for export rendering ────────────────────
  // Using a fresh offscreen canvas means MediaRecorder captures only export
  // frames, not whatever the live preview might be doing.
  const offscreen = document.createElement("canvas");
  offscreen.width = W;
  offscreen.height = H;
  const ctx = offscreen.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2D context for export canvas.");
  }

  // Draw first frame immediately so the stream has content before recorder starts
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // ── Step 4: Set up audio stream from pre-rendered buffer ─────────────────────
  let audioCtx: AudioContext | null = null;
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  let audioSource: AudioBufferSourceNode | null = null;

  if (renderedAudioBuffer) {
    try {
      // Use the same sample rate as the pre-rendered buffer to avoid codec mismatch
      audioCtx = new AudioContext({
        sampleRate: renderedAudioBuffer.sampleRate,
      });
      // Ensure context is running before creating nodes (browser autoplay policy)
      if (audioCtx.state === "suspended") await audioCtx.resume();
      audioDestination = audioCtx.createMediaStreamDestination();
      audioSource = audioCtx.createBufferSource();
      audioSource.buffer = renderedAudioBuffer;
      audioSource.connect(audioDestination);

      // *** FIX: Start audio source BEFORE the recorder so frames are flowing
      // when recording begins. The source must be playing into the destination
      // stream before MediaRecorder.start() is called, otherwise the audio
      // track delivers zero frames and the export is silent.
      audioSource.start(0);
      console.log(
        `[exportVideo] Audio source started — sampleRate=${renderedAudioBuffer.sampleRate}Hz, duration=${renderedAudioBuffer.duration.toFixed(1)}s`,
      );

      // Give the audio stream 150ms to buffer frames before we check track state
      await new Promise<void>((res) => setTimeout(res, 150));

      const audioTracks = audioDestination.stream.getAudioTracks();
      console.log(
        `[exportVideo] Audio destination tracks: ${audioTracks.length} — states: ${audioTracks.map((t) => t.readyState).join(", ")}`,
      );
      if (audioTracks.length === 0) {
        console.warn(
          "[exportVideo] No audio tracks on destination stream — export will be silent",
        );
      }
    } catch (e) {
      console.warn("[exportVideo] Audio context setup failed:", e);
      audioCtx = null;
      audioDestination = null;
      audioSource = null;
    }
  }

  // ── Step 5: Create combined MediaStream (canvas video + audio) ───────────────
  const fps = duration > 300 ? 15 : duration > 60 ? 20 : 24;
  const videoStream = offscreen.captureStream(fps);

  let combinedStream: MediaStream;
  const audioTracks = audioDestination?.stream.getAudioTracks() ?? [];
  if (audioTracks.length > 0) {
    combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioTracks,
    ]);
    console.log(
      `[exportVideo] Combined video+audio stream ready — ${audioTracks.length} audio track(s)`,
    );
  } else {
    combinedStream = videoStream;
    console.log("[exportVideo] Video-only stream (no audio tracks available)");
  }

  // ── Step 6: Init rain columns for binary overlay ─────────────────────────────
  const exportBinaryRainCols: RainColumn[] =
    state.binary.binaryOutput && state.binary.opacity > 0
      ? initRainColumns(
          W,
          Math.max(8, state.binary.fontSize),
          state.binary.binaryOutput.replace(/\s/g, ""),
        )
      : [];
  const exportBinaryNextCharRef = { value: 0 };

  // ── Step 7: Start MediaRecorder and render loop ──────────────────────────────
  return new Promise<void>((resolve, reject) => {
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: W >= 1280 ? 4_000_000 : 2_000_000,
      });
    } catch (e) {
      audioCtx?.close();
      reject(
        new Error(
          `MediaRecorder failed to start: ${e instanceof Error ? e.message : String(e)}. Try Chrome, Firefox, or Edge on desktop.`,
        ),
      );
      return;
    }

    const chunks: Blob[] = [];
    let gotData = false;
    const startWallTime = Date.now();
    let frameTick: ReturnType<typeof setInterval> | null = null;
    let currentTime = 0;
    const frameDt = 1 / fps;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
        gotData = true;
      }
    };

    recorder.onstop = () => {
      if (frameTick !== null) clearInterval(frameTick);

      // Stop audio source
      try {
        audioSource?.stop();
      } catch {}
      setTimeout(() => {
        try {
          audioCtx?.close();
        } catch {}
      }, 500);

      if (!gotData || chunks.length === 0) {
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(
          navigator.userAgent,
        );
        const errMsg = isMobile
          ? "Video capture failed on mobile. Mobile Chrome does not reliably support canvas recording. " +
            "Please try on desktop Chrome, Firefox, or Edge for best results."
          : "No video data was captured. This can happen if the browser blocked canvas recording. " +
            "Try refreshing the page and exporting again, or try a different browser.";
        progress(100, duration, errMsg);
        reject(new Error(errMsg));
        return;
      }

      progress(98, duration);
      const blob = new Blob(chunks, { type: "video/webm" });
      console.log(
        `[exportVideo] Export complete — ${(blob.size / 1024 / 1024).toFixed(1)}MB, ${chunks.length} chunks`,
      );

      progress(100, duration);
      triggerDownload(blob, "xution-video-export.webm", (err) => {
        progress(100, duration, err);
      });
      resolve();
    };

    recorder.onerror = (e) => {
      if (frameTick !== null) clearInterval(frameTick);
      try {
        audioSource?.stop();
      } catch {}
      audioCtx?.close();
      const msg =
        (e as ErrorEvent).message ?? "MediaRecorder encountered an error";
      console.error("[exportVideo] MediaRecorder error:", msg);
      reject(new Error(`Export error: ${msg}`));
    };

    // Audio source was already started before recorder setup (see Step 4).
    // Give the stream one final 100ms settle before recording begins so the
    // encoder's first keyframe lands on a frame with live audio data.
    setTimeout(() => {
      recorder.start(500); // collect chunks every 500ms
    }, 100);

    // Render loop: draw frames onto the offscreen canvas at target fps
    // setInterval is used (not rAF) so it runs even when tab is backgrounded
    frameTick = setInterval(
      () => {
        if (currentTime > duration) {
          // All frames rendered — request final data chunk and stop
          clearInterval(frameTick!);
          frameTick = null;
          try {
            audioSource?.stop();
          } catch {}
          setTimeout(() => {
            recorder.requestData();
            setTimeout(() => {
              if (recorder.state !== "inactive") recorder.stop();
            }, 600);
          }, 200);
          return;
        }

        // Update video element current times
        const t = currentTime;
        if (bgEl instanceof HTMLVideoElement) {
          const vidDur = bgEl.duration || duration;
          bgEl.currentTime = t % Math.max(0.001, vidDur);
        }
        for (const el of pipEls) {
          if (el instanceof HTMLVideoElement) {
            const vidDur = el.duration || duration;
            el.currentTime = t % Math.max(0.001, vidDur);
          }
        }

        // Draw this frame
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

        currentTime += frameDt;

        // Update progress (15% → 95% during render)
        const renderProgress = Math.min(1, currentTime / duration);
        const pct = 15 + Math.round(renderProgress * 80);
        const elapsed = (Date.now() - startWallTime) / 1000;
        progress(pct, elapsed);
      },
      Math.round(1000 / fps),
    );

    // Safety timeout: if no data after 10s of recording, abort
    setTimeout(() => {
      if (!gotData && recorder.state !== "inactive") {
        console.warn("[exportVideo] Timed out waiting for data — aborting");
        clearInterval(frameTick!);
        frameTick = null;
        try {
          audioSource?.stop();
        } catch {}
        recorder.stop();
        // onstop will handle the no-data error
      }
    }, 10_000);
  });
}

// Ensure formatTime is referenced (imported but needed for other callers)
void formatTime;
