export interface BackgroundLayer {
  file: File | null;
  fileUrl: string | null;
  fileType: "image" | "video" | null;
  duration: number; // seconds, default 30
  isPlaying: boolean;
}

export interface PiPLayer {
  id: 1 | 2 | 3 | 4;
  file: File | null;
  fileUrl: string | null;
  fileType: "image" | "video" | null;
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  width: number;
  height: number;
  lockAspectRatio: boolean;
  posX: number;
  posY: number;
  opacity: number; // 0-100
  startTime: number; // seconds, max 129600 (36 hours)
  endTime: number; // seconds, max 129600 (36 hours)
  isVisible: boolean;
}

export interface AudioLayer {
  id: 1 | 2 | 3 | 4;
  file: File | null;
  fileUrl: string | null;
  fileName: string;
  volume: number; // 0-100
  isActive: boolean;
}

export interface AffirmationsState {
  text: string;
  isPlaying: boolean;
  volume: number; // 0-100
  opacity: number; // 0-100
  fgColor: string;
  bgColor: string;
  fontSize: number;
  speed: number; // 0-100
  currentIndex: number;
}

export interface BinaryState {
  inputText: string;
  binaryOutput: string;
  isPlaying: boolean;
  volume: number; // 0-100
  opacity: number; // 0-100
  fgColor: string;
  bgColor: string;
  fontSize: number;
  speed: number; // 0-100
}

export interface StaticLayer {
  isActive: boolean;
  volume: number; // 0-100
  opacity: number; // 0-100
}

export type IsochronicPreset =
  | "alpha"
  | "beta"
  | "theta"
  | "delta"
  | "gamma"
  | "custom"
  | "stress_pain_relief"
  | "healing"
  | "lightning_trail"
  | "manifestation"
  | "general_hybrid_shapeshifting"
  | "mermaid_shapeshifting"
  | "wolf_shapeshifting"
  | "dragon_shapeshifting"
  | "feathered_wing_shapeshifting"
  | "retractable_wing_shapeshifting"
  | "symbiote_shapeshifting"
  | "bug_shapeshifting"
  | "bird_shapeshifting"
  | "reptile_shapeshifting"
  | "mammal_shapeshifting"
  | "biokinesis"
  | "nzt_omnicompetence"
  | "organic_web_shooters"
  | "improving_powers"
  | "teleportation_powers"
  | "omniscience"
  | "omni_manipulation"
  | "omnificence"
  | "omnifarious"
  | "omni_psionics"
  | "omnilock"
  | "alpha_reality_manipulation"
  | "amphibian_shapeshifting"
  | "invertebrate_shapeshifting"
  | "fish_shapeshifting"
  | "anthropomorphic_shapeshifting";

export interface IsochronicLayer {
  presets: IsochronicPreset[]; // multi-select
  customHz: number;
  volume: number; // 0-100
  isActive: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export interface AppState {
  background: BackgroundLayer;
  pips: PiPLayer[];
  audios: AudioLayer[];
  affirmations: AffirmationsState;
  binary: BinaryState;
  staticLayer: StaticLayer;
  isochronic: IsochronicLayer;
  playback: PlaybackState;

  // Background actions
  setBackground: (partial: Partial<BackgroundLayer>) => void;
  setBackgroundDuration: (duration: number) => void;
  toggleBackgroundPlay: () => void;

  // PiP actions
  updatePiP: (id: number, partial: Partial<PiPLayer>) => void;
  resetPiP: (id: number) => void;

  // Audio actions
  setAudio: (id: number, partial: Partial<AudioLayer>) => void;

  // Affirmations actions
  setAffirmations: (partial: Partial<AffirmationsState>) => void;

  // Binary actions
  setBinary: (partial: Partial<BinaryState>) => void;

  // Static actions
  setStatic: (partial: Partial<StaticLayer>) => void;

  // Isochronic actions
  setIsochronic: (partial: Partial<IsochronicLayer>) => void;

  // Playback actions
  setPlayback: (partial: Partial<PlaybackState>) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
}
