import type { RefObject } from "react";
import type { AppState } from "../types";
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

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channels
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

/** Returns flat list of [carrierHz, lfoHz] pairs for a preset */
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
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(
    2,
    Math.ceil(duration * sampleRate),
    sampleRate,
  );

  const pending: Promise<void>[] = [];

  // Audio layers
  for (const layer of state.audios) {
    if (!layer.isActive || !layer.fileUrl) continue;

    const p = (async () => {
      try {
        const resp = await fetch(layer.fileUrl!);
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
      } catch (err) {
        console.warn(
          `[exportWAV] Failed to load audio layer ${layer.id}:`,
          err,
        );
      }
    })();
    pending.push(p);
  }

  await Promise.all(pending);

  // Static noise
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
  }

  // Isochronic tones — one oscillator pair per preset/hz combination
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
  }

  return offlineCtx.startRendering();
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

export type ExportProgressCallback = (percent: number, elapsed: number) => void;

// ─── Public: exportMP4 (webm container) ─────────────────────────────────────

export async function exportMP4(
  state: AppState,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onProgress?: ExportProgressCallback,
): Promise<void> {
  const canvas = canvasRef.current;
  if (!canvas) {
    alert(
      "[Xution Video] Canvas not available. Please wait for preview to initialize.",
    );
    return;
  }

  const duration = state.background.duration;
  const durationHMS = formatTime(duration);
  alert(
    `[Xution Video] Rendering your video composition (${durationHMS}) — this may take a while. Please keep this tab open.`,
  );

  // Live AudioContext for real-time recording
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();

  // Audio layers (live)
  for (const layer of state.audios) {
    if (!layer.isActive || !layer.fileUrl) continue;
    try {
      const resp = await fetch(layer.fileUrl);
      const arrayBuffer = await resp.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = decoded;
      source.loop = true;
      const gain = audioCtx.createGain();
      gain.gain.value = layer.volume / 100;
      source.connect(gain);
      gain.connect(dest);
      source.start();
    } catch (err) {
      console.warn("[exportMP4] Audio layer failed:", err);
    }
  }

  // Static noise (live)
  if (state.staticLayer.isActive) {
    const numSamples = Math.ceil(duration * audioCtx.sampleRate);
    const noiseBuffer = audioCtx.createBuffer(
      2,
      numSamples,
      audioCtx.sampleRate,
    );
    for (let ch = 0; ch < 2; ch++) {
      const data = noiseBuffer.getChannelData(ch);
      for (let i = 0; i < numSamples; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const gain = audioCtx.createGain();
    gain.gain.value = state.staticLayer.volume / 100;
    src.connect(gain);
    gain.connect(dest);
    src.start();
  }

  // Isochronic (live) — one oscillator pair per preset/hz combination
  if (state.isochronic.isActive && state.isochronic.presets.length > 0) {
    const pairs = getIsochronicPairs(state.isochronic);
    for (const { carrier: carrierFreq, lfo: isoHz } of pairs) {
      const osc = audioCtx.createOscillator();
      osc.frequency.value = carrierFreq;
      osc.type = "sine";
      const lfo = audioCtx.createOscillator();
      lfo.frequency.value = isoHz;
      lfo.type = "square";
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 0.5;
      const masterGain = audioCtx.createGain();
      masterGain.gain.value = state.isochronic.volume / 100;
      lfo.connect(lfoGain);
      lfoGain.connect(masterGain.gain);
      osc.connect(masterGain);
      masterGain.connect(dest);
      osc.start();
      lfo.start();
      setTimeout(
        () => {
          osc.stop();
          lfo.stop();
        },
        duration * 1000 + 200,
      );
    }
  }

  // Combine canvas + audio streams
  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  // Determine supported mime type
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";

  const recorder = new MediaRecorder(combinedStream, { mimeType });
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    audioCtx.close();
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "xution-video-export.webm";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  recorder.start(100); // collect chunks every 100ms

  // Progress tracking — fires every 500ms
  const startTime = Date.now();
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const percent = Math.min(100, Math.round((elapsed / duration) * 100));
    onProgress?.(percent, elapsed);
  }, 500);

  // Stop after duration
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      clearInterval(progressInterval);
      onProgress?.(100, duration);
      recorder.stop();
      resolve();
    }, duration * 1000);
  });
}
