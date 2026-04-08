import {
  type MutableRefObject,
  type RefCallback,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useAppStore } from "../store/useAppStore";
import type { IsochronicPreset } from "../types";
import { formatTime } from "../utils/time";

function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Cover-fit a source rect into a dest rect, return dest draw params
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

// Text → binary string (8-bit per char, space-separated words)
function textToBinary(text: string): string {
  return text
    .split("")
    .map((c) => c.charCodeAt(0).toString(2).padStart(8, "0"))
    .join(" ");
}

// ---- Rain column types ----
interface RainDrop {
  y: number; // current y position of head (pixels)
  speed: number; // pixels per second
  length: number; // number of trailing chars
  charOffset: number; // starting index into character pool
  flash: boolean; // bright flash on head
}

interface RainColumn {
  x: number;
  drops: RainDrop[];
  nextSpawnTime: number; // seconds until next drop spawns
}

// ---- Preset-specific binary theme text (rich phrase-based, themed per intent) ----
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
  stress_pain_relief:
    "release pain | free from tension | comfort flows | ease body | dissolve stress | breathe relief | calm nerves | soothe deep | pain gates close | relax completely | tension dissolves | soft healing",
  healing:
    "DNA repair | cellular healing | 528 miracle | wholeness restored | perfect health | regenerate cells | heal completely | divine repair | body restores | sacred healing | renew fully | health returns",
  lightning_trail:
    "speed surge | lightning fast | electric charge | kinetic power | streak of light | rapid motion | impulse fires | bolt energy | swift as lightning | speed activated | trail blazing | electric body",
  manifestation:
    "reality bends | desires form | universe aligns | intention manifest | law of attraction | receive now | dream becomes real | attract abundance | creation flows | vision realized | manifest now | universe responds",
  general_hybrid_shapeshifting:
    "body transforms | hybrid form rises | cells reshape | morph begins | new self emerges | shift complete | form alters | hybrid awakens | body changes | transformation flows | emerge reborn | evolve now",
  mermaid_shapeshifting:
    "scales emerge | fins take form | ocean calls | breathe the deep | tail forms now | aquatic shift | sea merges with you | water breathes | mermaid awakens | fluid transformation | ocean born | swim freely",
  wolf_shapeshifting:
    "wolf awakens | pack instinct rises | primal howl | silver fur spreads | moonlit transformation | feral grace | fangs emerge | wolf spirit calls | scent sharpens | hunt instinct | moon calls wolf | shift complete",
  dragon_shapeshifting:
    "scales emerge | fire breath | ancient power | dragon heart beats | wings unfold | mythic form rises | dragon awakens | flame ignites | scales harden | ascend now | draconic shift | dragon reborn",
  feathered_wing_shapeshifting:
    "feathers bloom | wings spread wide | flight awaits | plumage emerges | ascend freely | avian grace | retract smoothly | lightness fills you | soar above | feathers anchor | wing bones form | sky opens",
  retractable_wing_shapeshifting:
    "wings extend | membrane forms | bone reshapes | wing structure grows | retract in | flight mode activates | wings emerge | fold away clean | wingspan expands | structural shift | wings complete | fly now",
  symbiote_shapeshifting:
    "symbiote bonds | dark fluid merges | adapt and absorb | tendrils respond | mimic power | shift at will | bond complete | venom flows | dark symbiosis | absorb and become | one with symbiote | power merges",
  bug_shapeshifting:
    "exoskeleton forms | chitin hardens | antenna emerge | compound eyes open | arthropod shift | molt begins | carapace sets | insect awakens | mandibles form | bug transformation | sense vibration | shift complete",
  bird_shapeshifting:
    "hollow bones form | beak emerges | talons extend | feathers spread | avian shift | plumage blooms | bird awakens | soar instinct rises | wing muscles grow | migration calls | bird form complete | sky claims you",
  reptile_shapeshifting:
    "scales spread | cold blood flows | reptile awakens | skin sheds now | tongue senses all | slither instinct | armor scales form | camouflage activates | ancient reptile | shift complete | poikilotherm mode | evolve now",
  mammal_shapeshifting:
    "warm blood flows | fur spreads | heartbeat shifts | bone reshapes | sinew tightens | mammal awakens | breath deepens | instinct rises | mammal form emerges | adapt and shift | warm body grows | transform now",
  amphibian_shapeshifting:
    "gills and lungs | dual world living | amphibian shift | moist skin adapts | metamorphosis begins | aquatic mode on | land mode on | breathe anywhere | amphibian awakens | transform fully | two worlds unite | shift complete",
  invertebrate_shapeshifting:
    "spine dissolves | fluid body | soft form takes shape | tentacles emerge | bioluminescence glows | regenerate freely | spineless shift | morph continuously | formless becomes form | fluid motion | invertebrate rises | shift now",
  fish_shapeshifting:
    "gills open | scales glide on | fins form | dorsal rises | depth pressure fades | aquatic breathing | streamlined form | cold water calls | fish awakens | swim freely | deep sea shift | transform complete",
  anthropomorphic_shapeshifting:
    "bipedal hybrid | walk upright | animal merges human | speak and howl | reason and instinct | anthropomorph rises | two natures unite | hybrid walks | instinct speaks | form complete | human animal shift | become fully",
  biokinesis:
    "DNA rewrite | cell transform | gene activate | body reshape | biology shifts | genome editing | cellular code | sequence rewrites | reprogram cells | mutate with will | recode biology | evolve life",
  nzt_omnicompetence:
    "unlimited mind | total recall | pattern mastery | genius unlocked | synthesize all | analyze instantly | master everything | NZT activated | cognitive peak | learn instantly | omniscient clarity | mind unlimited",
  organic_web_shooters:
    "spinnerets grow | webbing forms | forearm structures | organic silk | thread fires | weave instinct | wrist mechanics | climb and swing | silk shoots out | organic growth | web shooter active | weave now",
  improving_powers:
    "powers amplify | abilities expand | level up now | boost all skills | unlock potential | multiply strength | enhance power | evolve abilities | power ceiling breaks | all powers rise | improve everything | maximum power",
  teleportation_powers:
    "quantum leap | space fold now | instant travel | dimension shift | teleport activate | phase through space | blink to destination | displace instantly | materialize there | traverse void | quantum tunnel | space collapses",
  omniscience:
    "all knowing | past present future | omniscient mind | universe knowledge | perceive all truth | understand everything | access any knowledge | total awareness | infinite knowing | see all | omniscience active | know now",
  omni_manipulation:
    "control all forces | reality responds | matter obeys | energy bends | time yields | space folds | mind commands | absolute control | omni power | manipulate all | command reality | all forces yield",
  omnificence:
    "create from nothing | infinite power | genesis force | manifest universe | unlimited creation | divine omnificence | all creation yours | infinite creative | genesis activated | create all | omnificence flows | create now",
  omnifarious:
    "infinite forms | any shape possible | limitless transform | become everything | omnifarious shift | all forms available | shift at thought | form is fluid | become anything | transform all | limitless becoming | all forms yours",
  omni_psionics:
    "telekinesis active | telepathy opens | clairvoyance flows | precognition rises | psychic force | psionic awakening | mind force surge | remote viewing | psychometry active | omni psionic | all powers awaken | psi complete",
  omnilock:
    "omnilock seals | transcend causality | immovable self | beyond all reach | stasis absolute | untouchable being | causality locked | omnilock active | nothing reaches you | absolute lock | beyond reality | stasis holds",
  alpha_reality_manipulation:
    "reality rewritten | alpha override | physics bend | laws rewritten | matrix overrides | universe reshapes | intent commands | base reality shifts | alpha source code | rewrite existence | reality yields | manifest alpha",
  custom:
    "frequency tunes | resonance aligns | vibration calibrates | harmonize now | wave in phase | custom frequency | personal resonance | tune your field | align your energy | calibrate being | harmonize self | resonate now",
};

// Get binary string for active presets (concatenated, unique)
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

// ---- Initialize rain columns ----
function initRainColumns(
  W: number,
  fontSize: number,
  charPool: string,
  totalCols?: number,
): RainColumn[] {
  const colW = Math.max(fontSize * 0.65, 8);
  const numCols = totalCols ?? Math.floor(W / colW);
  const poolLen = Math.max(1, charPool.length);
  return Array.from({ length: numCols }, (_, i) => ({
    x: i * colW + colW * 0.1,
    drops: [],
    nextSpawnTime: Math.random() * 3.5, // staggered initial spawn (seconds)
    // pre-assign a random char offset so each column starts at different point
  })).map((col, i) => ({
    ...col,
    drops: [] as RainDrop[],
    _initOffset: (i * 37 + 13) % poolLen, // unused field used just for init
  })) as RainColumn[];
}

// ---- Update rain columns (delta-time based) ----
// nextCharIndexRef is a { value: number } box so we can mutate it from outside
function updateRainColumns(
  columns: RainColumn[],
  dt: number,
  H: number,
  fontSize: number,
  charPool: string,
  speedMultiplier: number, // 0..1 mapped from speed slider
  nextCharIndexRef: { value: number },
): void {
  if (charPool.length === 0) return;

  const charH = fontSize * 1.35;
  const minSpeed = charH * (0.5 + speedMultiplier * 2.5); // px/sec
  const maxSpeed = charH * (1.2 + speedMultiplier * 5.5);
  const minLen = 4;
  const maxLen = 18;
  const poolLen = charPool.length;
  // spawn probability per column per frame — low = progressive/staggered feel
  const spawnProb = 0.008 + speedMultiplier * 0.018;

  for (const col of columns) {
    // Update existing drops
    for (const drop of col.drops) {
      drop.y += drop.speed * dt;
      // Occasional head flash flicker
      drop.flash = Math.random() < 0.04;
    }
    // Remove drops that have fully scrolled off canvas
    col.drops = col.drops.filter((d) => d.y - d.length * charH < H + charH);

    // Spawn timer approach — decrement and check
    col.nextSpawnTime -= dt;
    if (col.nextSpawnTime <= 0) {
      // Spawn a new drop
      if (Math.random() < spawnProb + 0.7) {
        // high probability when timer fires
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        const length = minLen + Math.floor(Math.random() * (maxLen - minLen));
        // Sequential charOffset: pick up exactly where the last drop left off
        const charOffset = nextCharIndexRef.value % poolLen;
        nextCharIndexRef.value = (nextCharIndexRef.value + length) % poolLen;
        col.drops.push({
          y: -charH, // start above the canvas
          speed,
          length,
          charOffset,
          flash: false,
        });
      }
      // Reset spawn timer: random 0.2 - 2.8 sec (creates staggered "downloading" feel)
      col.nextSpawnTime = 0.2 + Math.random() * 2.6;
    }
  }
}

// ---- Draw rain columns onto canvas ----
function drawRainColumns(
  ctx: CanvasRenderingContext2D,
  columns: RainColumn[],
  charPool: string,
  fontSize: number,
  fgColor: string, // hex
  opacity: number, // 0..1
): void {
  if (charPool.length === 0 || opacity <= 0) return;

  const charH = fontSize * 1.35;
  const poolLen = Math.max(1, charPool.length);

  // Parse fg color for RGB components
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
        // Skip chars not yet on canvas
        if (charY > ctx.canvas.height + charH) continue;
        if (charY < -charH) break;

        const charIdx = (drop.charOffset + i) % poolLen;
        const ch = charPool[charIdx] ?? "0";

        let alpha: number;
        let drawR = r;
        let drawG = g;
        let drawB = b;

        if (i === 0) {
          // Head: bright white/gold flash
          alpha = opacity;
          if (drop.flash) {
            // Ultra-bright white flash on leading edge
            drawR = 255;
            drawG = 255;
            drawB = 255;
          } else {
            // Bright gold/white: mix toward white
            drawR = Math.min(255, r + 80);
            drawG = Math.min(255, g + 80);
            drawB = Math.min(255, b + 80);
          }
        } else {
          // Trailing chars: fade out exponentially going up
          const trailFraction = i / drop.length;
          // Exponential decay: head is bright, tail is near invisible
          alpha = opacity * (1 - trailFraction) ** 1.8 * 0.95;
          // Slight color variation for "data stream" look
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

// ---------------- component ----------------
export const CanvasPreview = forwardRef<HTMLCanvasElement>(
  function CanvasPreviewInner(_props, forwardedRef) {
    const internalRef = useRef<HTMLCanvasElement>(null);

    // Sync forwardedRef with internal canvasRef
    const setCanvasRef = useCallback(
      (node: HTMLCanvasElement | null) => {
        (internalRef as MutableRefObject<HTMLCanvasElement | null>).current =
          node;
        if (typeof forwardedRef === "function") {
          (forwardedRef as RefCallback<HTMLCanvasElement>)(node);
        } else if (forwardedRef) {
          (forwardedRef as MutableRefObject<HTMLCanvasElement | null>).current =
            node;
        }
      },
      [forwardedRef],
    );
    const animFrameRef = useRef<number>(0);
    const lastTickRef = useRef<number>(0);
    const staticImageDataRef = useRef<ImageData | null>(null);

    // ---- Rain state refs (never trigger re-renders) ----
    const binaryRainColsRef = useRef<RainColumn[]>([]);
    const affirmRainColsRef = useRef<RainColumn[]>([]);
    const prevBinaryOutputRef = useRef<string>("");
    const prevAffirmTextRef = useRef<string>("");
    const prevBinaryFontSizeRef = useRef<number>(0);
    const prevAffirmFontSizeRef = useRef<number>(0);
    const lastFrameTimeRef = useRef<number>(0);
    // Sequential char index counters — ensure drops fall in user-typed order
    const binaryNextCharRef = useRef<{ value: number }>({ value: 0 });
    const affirmNextCharRef = useRef<{ value: number }>({ value: 0 });

    // Stable refs for media elements
    const bgVideoRef = useRef<HTMLVideoElement | null>(null);
    const pipVideoRefs = useRef<(HTMLVideoElement | null)[]>([
      null,
      null,
      null,
      null,
    ]);
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const pipImageRefs = useRef<(HTMLImageElement | null)[]>([
      null,
      null,
      null,
      null,
    ]);

    const {
      background,
      pips,
      affirmations,
      binary,
      staticLayer,
      isochronic,
      playback,
      play,
      pause,
      stop,
      seekTo,
    } = useAppStore();

    const isPlaying = playback.isPlaying;
    const currentTime = playback.currentTime;
    const duration = playback.duration;

    // Derive "has any media loaded" to decide if the RAF loop should run.
    // We check background url + any pip url from the store directly.
    const hasMedia = !!background.fileUrl || pips.some((p) => !!p.fileUrl);

    // ---- Load background media ----
    useEffect(() => {
      if (!background.fileUrl) {
        bgVideoRef.current = null;
        bgImageRef.current = null;
        return;
      }
      if (background.fileType === "video") {
        const vid = document.createElement("video");
        vid.src = background.fileUrl;
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = "metadata";
        bgVideoRef.current = vid;
        bgImageRef.current = null;
      } else if (background.fileType === "image") {
        const img = new Image();
        img.src = background.fileUrl;
        bgImageRef.current = img;
        bgVideoRef.current = null;
      }
    }, [background.fileUrl, background.fileType]);

    // ---- Load PiP media ----
    useEffect(() => {
      pips.forEach((pip, idx) => {
        if (!pip.fileUrl) {
          pipVideoRefs.current[idx] = null;
          pipImageRefs.current[idx] = null;
          return;
        }
        if (pip.fileType === "video") {
          const vid = document.createElement("video");
          vid.src = pip.fileUrl;
          vid.muted = true;
          vid.playsInline = true;
          vid.preload = "metadata";
          pipVideoRefs.current[idx] = vid;
          pipImageRefs.current[idx] = null;
        } else if (pip.fileType === "image") {
          const img = new Image();
          img.src = pip.fileUrl;
          pipImageRefs.current[idx] = img;
          pipVideoRefs.current[idx] = null;
        }
      });
    }, [pips]);

    // ---- Sync video currentTime when scrubbing (not playing) ----
    useEffect(() => {
      if (!isPlaying) {
        if (bgVideoRef.current) {
          bgVideoRef.current.currentTime =
            currentTime % (bgVideoRef.current.duration || 1);
        }
        for (const vid of pipVideoRefs.current) {
          if (vid) vid.currentTime = currentTime % (vid.duration || 1);
        }
      }
    }, [currentTime, isPlaying]);

    // ---- Play / pause video elements ----
    useEffect(() => {
      if (isPlaying) {
        bgVideoRef.current?.play().catch(() => null);
        for (const vid of pipVideoRefs.current) {
          vid?.play().catch(() => null);
        }
      } else {
        bgVideoRef.current?.pause();
        for (const vid of pipVideoRefs.current) {
          vid?.pause();
        }
      }
    }, [isPlaying]);

    // ---- Playback tick ----
    useEffect(() => {
      if (!isPlaying) return;
      const tick = (now: number) => {
        if (lastTickRef.current === 0) lastTickRef.current = now;
        const delta = (now - lastTickRef.current) / 1000;
        lastTickRef.current = now;
        useAppStore.setState((s) => {
          const next = Math.min(
            s.playback.currentTime + delta,
            s.playback.duration,
          );
          const done = next >= s.playback.duration;
          return {
            playback: { ...s.playback, currentTime: next, isPlaying: !done },
          };
        });
        animFrameRef.current = requestAnimationFrame(tick);
      };
      lastTickRef.current = 0;
      animFrameRef.current = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(animFrameRef.current);
        lastTickRef.current = 0;
      };
    }, [isPlaying]);

    // ---- Canvas render loop ----
    const renderFrame = useCallback(
      (nowMs: number) => {
        const canvas = internalRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const W = canvas.width;
        const H = canvas.height;

        // Compute delta time (capped at 100ms to avoid huge jumps on tab focus)
        const dt = Math.min(
          (nowMs - (lastFrameTimeRef.current || nowMs)) / 1000,
          0.1,
        );
        lastFrameTimeRef.current = nowMs;

        // ---- Background ----
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, W, H);

        const bgVid = bgVideoRef.current;
        const bgImg = bgImageRef.current;

        if (bgVid && bgVid.readyState >= 2) {
          const { dx, dy, dw, dh } = coverFit(
            bgVid.videoWidth || W,
            bgVid.videoHeight || H,
            W,
            H,
          );
          ctx.drawImage(bgVid, dx, dy, dw, dh);
        } else if (bgImg?.complete && bgImg.naturalWidth > 0) {
          const { dx, dy, dw, dh } = coverFit(
            bgImg.naturalWidth,
            bgImg.naturalHeight,
            W,
            H,
          );
          ctx.drawImage(bgImg, dx, dy, dw, dh);
        } else {
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,1)";
          ctx.fillRect(0, 0, W, H);
          ctx.font = `bold ${Math.round(H * 0.06)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "rgba(255,215,0,0.4)";
          ctx.fillText("NO MEDIA LOADED", W / 2, H / 2);
          ctx.restore();
        }

        // ---- PiP layers ----
        const state = useAppStore.getState();
        const ct = state.playback.currentTime;

        pips.forEach((pip, idx) => {
          if (!pip.isVisible) return;
          if (ct < pip.startTime || ct > pip.endTime) return;

          const pipVid = pipVideoRefs.current[idx];
          const pipImg = pipImageRefs.current[idx];

          let source: HTMLVideoElement | HTMLImageElement | null = null;
          let natW = 0;
          let natH = 0;

          if (pipVid && pipVid.readyState >= 2) {
            source = pipVid;
            natW = pipVid.videoWidth;
            natH = pipVid.videoHeight;
          } else if (pipImg?.complete && pipImg.naturalWidth > 0) {
            source = pipImg;
            natW = pipImg.naturalWidth;
            natH = pipImg.naturalHeight;
          }

          if (!source || natW === 0 || natH === 0) return;

          const sx = pip.cropLeft;
          const sy = pip.cropTop;
          const sw = Math.max(1, natW - pip.cropLeft - pip.cropRight);
          const sh = Math.max(1, natH - pip.cropTop - pip.cropBottom);

          ctx.save();
          ctx.globalAlpha = pip.opacity / 100;
          ctx.drawImage(
            source,
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

        // ---- Static noise overlay ----
        if (staticLayer.isActive && staticLayer.opacity > 0) {
          const alpha = staticLayer.opacity / 100;
          if (
            !staticImageDataRef.current ||
            staticImageDataRef.current.width !== W ||
            staticImageDataRef.current.height !== H
          ) {
            staticImageDataRef.current = ctx.createImageData(W, H);
          }
          const data = staticImageDataRef.current.data;
          for (let i = 0; i < data.length; i += 4) {
            const v = (Math.random() * 255) | 0;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
            data[i + 3] = (alpha * 255) | 0;
          }
          ctx.putImageData(staticImageDataRef.current, 0, 0);
        }

        // ---- Binary Rain overlay (user) ----
        if (binary.binaryOutput && binary.opacity > 0) {
          const binFontSize = Math.max(8, binary.fontSize);
          const charPool = binary.binaryOutput.replace(/\s/g, "");
          const speedMult = binary.speed / 100;

          // Reinitialize columns when content or font size changes
          if (
            binary.binaryOutput !== prevBinaryOutputRef.current ||
            binFontSize !== prevBinaryFontSizeRef.current
          ) {
            prevBinaryOutputRef.current = binary.binaryOutput;
            prevBinaryFontSizeRef.current = binFontSize;
            // Reset sequential counter so order restarts with the new input
            binaryNextCharRef.current.value = 0;
            binaryRainColsRef.current = initRainColumns(
              W,
              binFontSize,
              charPool,
            );
          }

          // Update rain physics — always runs when there's binary text
          updateRainColumns(
            binaryRainColsRef.current,
            dt,
            H,
            binFontSize,
            charPool,
            speedMult,
            binaryNextCharRef.current,
          );

          // Draw rain
          drawRainColumns(
            ctx,
            binaryRainColsRef.current,
            charPool,
            binFontSize,
            binary.fgColor,
            binary.opacity / 100,
          );
        }

        // ---- Preset binary overlay (isochronic theme) — UNCHANGED ----
        if (isochronic.isActive && isochronic.presets.length > 0) {
          const presetBinaryStr = getPresetBinaryOutput(
            isochronic.presets,
            isochronic.customHz,
          );
          if (presetBinaryStr) {
            const fontSize = 10;
            const chars = presetBinaryStr.replace(/\s/g, "");
            const charsPerRow = Math.floor(W / (fontSize * 0.6));
            const startRow = Math.floor((H * 0.62) / (fontSize * 1.4));
            const totalRows = Math.ceil((H * 0.38) / (fontSize * 1.4));
            const totalChars = chars.length;

            const scrollSpeed = 2;
            const offset =
              Math.floor(ct * scrollSpeed) % Math.max(1, totalChars);

            ctx.save();
            ctx.font = `${fontSize}px monospace`;
            ctx.textBaseline = "top";

            for (let row = 0; row < totalRows; row++) {
              const rowFraction = row / Math.max(1, totalRows - 1);
              const rowAlpha = 0.08 + rowFraction * 0.28;
              ctx.globalAlpha = rowAlpha;

              for (let col = 0; col < charsPerRow; col++) {
                const charIdx =
                  (offset + (startRow + row) * charsPerRow + col) %
                  Math.max(1, totalChars);
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

        // ---- Affirmations Rain overlay ----
        if (
          affirmations.isPlaying &&
          affirmations.text &&
          affirmations.opacity > 0
        ) {
          const lines = affirmations.text.split("\n").filter((l) => l.trim());
          if (lines.length > 0) {
            const affFontSize = Math.max(12, affirmations.fontSize);
            const speedMult = affirmations.speed / 100;

            // Build char pool from ALL affirmation lines (words separated by spaces)
            // Use individual characters for true Matrix rain feel
            const allText = lines.join(" ").replace(/\n/g, " ");
            // For affirmations: use words as "characters" in the stream for readability
            const words = allText.split(/\s+/).filter(Boolean);
            // Interleave chars + words: split into single chars for the rain
            const charPool = allText.split("").filter((c) => c !== "\n");

            // Reinitialize if text or font size changed
            if (
              affirmations.text !== prevAffirmTextRef.current ||
              affFontSize !== prevAffirmFontSizeRef.current
            ) {
              prevAffirmTextRef.current = affirmations.text;
              prevAffirmFontSizeRef.current = affFontSize;
              // Reset sequential counter so order restarts with the new text
              affirmNextCharRef.current.value = 0;
              // Fewer columns for affirmations — wider spacing so text is legible
              const colW = Math.max(affFontSize * 1.2, 14);
              const numCols = Math.floor(W / colW);
              affirmRainColsRef.current = initRainColumns(
                W,
                affFontSize,
                charPool.join(""),
                numCols,
              );
            }

            // Update rain physics
            updateRainColumns(
              affirmRainColsRef.current,
              dt,
              H,
              affFontSize,
              charPool.join(""),
              speedMult,
              affirmNextCharRef.current,
            );

            // Draw rain — affirmations use their color scheme
            drawRainColumns(
              ctx,
              affirmRainColsRef.current,
              charPool.join(""),
              affFontSize,
              affirmations.fgColor,
              affirmations.opacity / 100,
            );

            // ---- Also show current affirmation word-stream at top (subtle) ----
            // A single bright line at top showing the current phrase being "received"
            const cycleSeconds = Math.max(
              0.5,
              5 * (1 - affirmations.speed / 100) + 0.5,
            );
            const lineIndex = Math.floor(ct / cycleSeconds) % lines.length;
            const currentLine = lines[lineIndex];

            ctx.save();
            ctx.globalAlpha = (affirmations.opacity / 100) * 0.85;
            ctx.font = `bold ${affFontSize}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";

            const padding = 12;
            const textW = ctx.measureText(currentLine).width + padding * 2;
            const textH = affFontSize + padding;
            const tx = W / 2 - textW / 2;
            const ty = Math.round(H * 0.03);

            ctx.fillStyle = hexToRgba(affirmations.bgColor, 0.65);
            ctx.fillRect(tx, ty, textW, textH);

            ctx.fillStyle = affirmations.fgColor;
            ctx.fillText(currentLine, W / 2, ty + padding / 2);
            ctx.restore();

            // Suppress unused variable warning
            void words;
          }
        }
      },
      [pips, affirmations, binary, staticLayer, isochronic],
    );

    // ---- Canvas render loop — only runs when playing or media is loaded ----
    // When idle with no media, no RAF loop runs, saving CPU/GPU entirely.
    useEffect(() => {
      // Always draw at least one static frame so the canvas isn't blank.
      renderFrame(performance.now());

      // Only start the continuous loop if there's something to animate.
      if (!isPlaying && !hasMedia) return;

      let frameId: number;
      const loop = (now: number) => {
        renderFrame(now);
        frameId = requestAnimationFrame(loop);
      };
      frameId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(frameId);
    }, [renderFrame, isPlaying, hasMedia]);

    // ---- Controls ----
    const handlePlay = () => {
      if (isPlaying) {
        pause();
      } else {
        if (currentTime >= duration) stop();
        play();
      }
    };

    const handleStop = () => stop();

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
      seekTo(Number(e.target.value));
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const playLabel = isPlaying ? "⏸ PAUSE" : "▶ PLAY";

    return (
      <div className="w-full flex flex-col gap-3">
        {/* Canvas — 16:9 responsive */}
        <div
          className="relative w-full bg-black"
          style={{ border: "2px solid #FFD700", aspectRatio: "16 / 9" }}
        >
          <canvas
            ref={setCanvasRef}
            width={1280}
            height={720}
            className="absolute inset-0 w-full h-full"
            style={{ display: "block" }}
          />
          {/* Corner marks */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#FFD700]/60 pointer-events-none" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#FFD700]/60 pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#FFD700]/60 pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#FFD700]/60 pointer-events-none" />
        </div>

        {/* Transport + timeline */}
        <div className="border border-[#FFD700]/20 bg-[#0a0a00] p-3 flex flex-col gap-2">
          {/* Buttons row */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStop}
              data-ocid="playback-stop"
              title="Stop"
              className="font-mono text-xs border border-[#FFD700]/40 text-[#FFD700]/70 bg-transparent hover:border-[#FFD700] hover:text-[#FFD700] px-3 py-1 transition-colors duration-200 tracking-widest"
            >
              ■ STOP
            </button>
            <button
              type="button"
              onClick={handlePlay}
              data-ocid={isPlaying ? "playback-pause" : "playback-play"}
              title={isPlaying ? "Pause" : "Play"}
              className={`font-mono text-xs font-bold px-4 py-1 border tracking-widest transition-colors duration-200 ${
                isPlaying
                  ? "border-[#FFD700]/60 text-[#FFD700]/80 bg-transparent hover:bg-[#FFD700]/10 hover:text-[#FFD700]"
                  : "border-[#FFD700] text-black bg-[#FFD700] hover:bg-[#FFD700]/90"
              }`}
            >
              {playLabel}
            </button>
            <div className="flex-1" />
            {/* Time display — HH:MM:SS */}
            <span className="font-mono text-[#FFD700]/50 text-xs tracking-widest tabular-nums">
              {formatTime(currentTime)}&nbsp;/&nbsp;{formatTime(duration)}
            </span>
          </div>

          {/* Timeline scrubber */}
          <div className="relative flex flex-col gap-1">
            <div
              className="relative h-3 bg-[#111] cursor-pointer overflow-hidden"
              style={{ border: "1px solid rgba(255,215,0,0.2)" }}
            >
              <div
                className="absolute left-0 top-0 h-full bg-[#FFD700]/50 transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={handleScrub}
              data-ocid="timeline-scrubber"
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-3"
              aria-label="Timeline scrubber"
            />
            {/* Tick marks — HH:MM:SS */}
            <div className="flex justify-between mt-0.5 px-0.5">
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                <span
                  key={`tick-${fraction}`}
                  className="font-mono text-[#FFD700]/20 text-[9px] tabular-nums"
                >
                  {formatTime(duration * fraction)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
