import { create } from "zustand";
import type {
  AffirmationsState,
  AppState,
  AudioLayer,
  BackgroundLayer,
  BinaryState,
  IsochronicLayer,
  PiPLayer,
  PlaybackState,
  StaticLayer,
} from "../types";

function textToBinary(text: string): string {
  return text
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join(" ");
}

function makePiP(id: 1 | 2 | 3 | 4): PiPLayer {
  return {
    id,
    file: null,
    fileUrl: null,
    fileType: null,
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0,
    width: 320,
    height: 180,
    lockAspectRatio: true,
    posX: 0,
    posY: 0,
    opacity: 100,
    startTime: 0,
    endTime: 30,
    isVisible: true,
  };
}

function makeAudio(id: 1 | 2 | 3 | 4): AudioLayer {
  return {
    id,
    file: null,
    fileUrl: null,
    fileName: "",
    volume: 80,
    isActive: false,
  };
}

const defaultBackground: BackgroundLayer = {
  file: null,
  fileUrl: null,
  fileType: null,
  duration: 30,
  isPlaying: false,
};

const defaultAffirmations: AffirmationsState = {
  text: "",
  isPlaying: false,
  volume: 100,
  opacity: 100,
  fgColor: "#FFD700",
  bgColor: "#000000",
  fontSize: 24,
  speed: 50,
  currentIndex: 0,
};

const defaultBinary: BinaryState = {
  inputText: "",
  binaryOutput: "",
  isPlaying: false,
  volume: 100,
  opacity: 100,
  fgColor: "#FFD700",
  bgColor: "#000000",
  fontSize: 16,
  speed: 50,
};

const defaultStatic: StaticLayer = {
  isActive: false,
  volume: 30,
  opacity: 30,
};

const defaultIsochronic: IsochronicLayer = {
  presets: ["alpha"],
  customHz: 10,
  volume: 30,
  isActive: false,
};

const defaultPlayback: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  duration: 30,
};

export const useAppStore = create<AppState>((set) => ({
  background: defaultBackground,
  pips: [makePiP(1), makePiP(2), makePiP(3), makePiP(4)],
  audios: [makeAudio(1), makeAudio(2), makeAudio(3), makeAudio(4)],
  affirmations: defaultAffirmations,
  binary: defaultBinary,
  staticLayer: defaultStatic,
  isochronic: defaultIsochronic,
  playback: defaultPlayback,

  // Background actions
  setBackground: (partial) =>
    set((state) => ({ background: { ...state.background, ...partial } })),

  setBackgroundDuration: (duration) =>
    set((state) => ({
      background: { ...state.background, duration },
      playback: { ...state.playback, duration },
    })),

  toggleBackgroundPlay: () =>
    set((state) => ({
      background: {
        ...state.background,
        isPlaying: !state.background.isPlaying,
      },
    })),

  // PiP actions
  updatePiP: (id, partial) =>
    set((state) => ({
      pips: state.pips.map((pip) =>
        pip.id === id ? { ...pip, ...partial } : pip,
      ),
    })),

  resetPiP: (id) =>
    set((state) => ({
      pips: state.pips.map((pip) =>
        pip.id === id ? makePiP(id as 1 | 2 | 3 | 4) : pip,
      ),
    })),

  // Audio actions
  setAudio: (id, partial) =>
    set((state) => ({
      audios: state.audios.map((audio) =>
        audio.id === id ? { ...audio, ...partial } : audio,
      ),
    })),

  // Affirmations actions
  setAffirmations: (partial) =>
    set((state) => ({ affirmations: { ...state.affirmations, ...partial } })),

  // Binary actions — auto-compute binaryOutput from inputText
  setBinary: (partial) =>
    set((state) => {
      const next = { ...state.binary, ...partial };
      if ("inputText" in partial) {
        next.binaryOutput = partial.inputText
          ? textToBinary(partial.inputText)
          : "";
      }
      return { binary: next };
    }),

  // Static actions
  setStatic: (partial) =>
    set((state) => ({ staticLayer: { ...state.staticLayer, ...partial } })),

  // Isochronic actions
  setIsochronic: (partial) =>
    set((state) => ({ isochronic: { ...state.isochronic, ...partial } })),

  // Playback actions
  setPlayback: (partial) =>
    set((state) => ({ playback: { ...state.playback, ...partial } })),

  play: () =>
    set((state) => ({ playback: { ...state.playback, isPlaying: true } })),

  pause: () =>
    set((state) => ({ playback: { ...state.playback, isPlaying: false } })),

  stop: () =>
    set((state) => ({
      playback: { ...state.playback, isPlaying: false, currentTime: 0 },
    })),

  seekTo: (time) =>
    set((state) => ({ playback: { ...state.playback, currentTime: time } })),
}));
