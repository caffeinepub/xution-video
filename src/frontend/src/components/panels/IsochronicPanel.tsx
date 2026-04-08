import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { IsochronicPreset } from "../../types";

interface PresetDef {
  value: IsochronicPreset;
  label: string;
  hz: number | number[];
  carrier?: number;
  sublabel?: string;
  verbalAffirmations: string[];
  auditoryHz: number;
}

const PRESETS: PresetDef[] = [
  {
    value: "alpha",
    label: "Alpha",
    hz: 10,
    sublabel: "10 Hz — relaxed awareness",
    auditoryHz: 432,
    verbalAffirmations: [
      "Your mind settles into calm, open awareness",
      "Clarity flows gently through every thought",
      "You are relaxed, focused, and fully present",
      "Each breath deepens your peaceful alpha state",
      "Your nervous system unwinds into serene balance",
      "Creative insight flows naturally to you now",
    ],
  },
  {
    value: "beta",
    label: "Beta",
    hz: 20,
    sublabel: "20 Hz — active focus",
    auditoryHz: 320,
    verbalAffirmations: [
      "Your mind is sharp, alert, and fully engaged",
      "Focus sharpens with every passing moment",
      "Your thoughts are clear, precise, and powerful",
      "You execute with confidence and mental clarity",
      "Every task flows effortlessly through you",
    ],
  },
  {
    value: "theta",
    label: "Theta",
    hz: 6,
    sublabel: "6 Hz — deep meditation",
    auditoryHz: 396,
    verbalAffirmations: [
      "You drift deeper into the subconscious realm",
      "Your imagination opens like a vast inner landscape",
      "Wisdom and insight rise from the depths within",
      "You surrender fully to the dream state",
      "Inner visions illuminate your path forward",
    ],
  },
  {
    value: "delta",
    label: "Delta",
    hz: 2,
    sublabel: "2 Hz — deep sleep/healing",
    auditoryHz: 174,
    verbalAffirmations: [
      "Your body enters its deepest healing state",
      "Every cell restores and regenerates completely",
      "You descend into profound, restorative rest",
      "The delta rhythm repairs you at the deepest level",
      "You wake renewed, whole, and fully revitalized",
    ],
  },
  {
    value: "gamma",
    label: "Gamma",
    hz: 40,
    sublabel: "40 Hz — peak cognition",
    auditoryHz: 480,
    verbalAffirmations: [
      "Your consciousness expands to its highest peak",
      "All sensory data integrates in perfect clarity",
      "You perceive connections others cannot see",
      "Peak awareness flows through every neuron",
      "You operate at the absolute edge of cognitive power",
    ],
  },
  {
    value: "custom",
    label: "Custom",
    hz: 0,
    sublabel: "User-defined Hz",
    auditoryHz: 440,
    verbalAffirmations: [
      "Your chosen frequency attunes your being",
      "This vibration resonates with your unique purpose",
      "You align perfectly to your selected resonance",
      "The frequency you chose carries you forward",
    ],
  },
  // ── Specialty / Ability Presets ──────────────────────────────────────────
  {
    value: "stress_pain_relief",
    label: "Physical/Mental Stress & Pain Relief",
    hz: 10,
    sublabel: "10 Hz Alpha — relaxation & pain gating",
    auditoryHz: 396,
    verbalAffirmations: [
      "All tension dissolves from your body and mind",
      "Pain signals quiet as calm washes over you",
      "Your nervous system releases every knot of stress",
      "Comfort expands through every muscle and tissue",
      "You are at ease — body, mind, and spirit at rest",
      "Healing energy fills every place that has hurt",
    ],
  },
  {
    value: "healing",
    label: "Healing",
    hz: 7.83,
    carrier: 528,
    sublabel: "528 Hz carrier / 7.83 Hz LFO — cellular repair",
    auditoryHz: 528,
    verbalAffirmations: [
      "Every cell in your body is healing right now",
      "The 528 Hz miracle tone restores your DNA",
      "Your body knows exactly how to heal itself",
      "Perfect health is your natural, divine state",
      "Cellular repair accelerates with each breath",
      "You emerge whole, renewed, and radiant",
    ],
  },
  {
    value: "lightning_trail",
    label: "Lightning Trail",
    hz: 40,
    sublabel: "40 Hz Gamma — speed & heightened awareness",
    auditoryHz: 440,
    verbalAffirmations: [
      "Your reflexes sharpen to lightning speed",
      "You move faster than the eye can follow",
      "Electrical energy courses through your body",
      "Every movement carries the power of a storm",
      "You leave a trail of light wherever you go",
    ],
  },
  {
    value: "manifestation",
    label: "Manifestation",
    hz: 7.83,
    sublabel: "7.83 Hz Schumann — Earth frequency for manifestation",
    auditoryHz: 432,
    verbalAffirmations: [
      "Your intentions align with the universe perfectly",
      "What you desire is already on its way to you",
      "Reality bends gracefully to your focused will",
      "You are a powerful co-creator of your experience",
      "The law of attraction responds to you now",
      "All that you seek flows effortlessly into your life",
    ],
  },
  // ── Shapeshifting Presets ──────────────────────────────────────────────
  {
    value: "general_hybrid_shapeshifting",
    label: "General Hybrid Shapeshifting",
    hz: [40, 6],
    sublabel: "40+6 Hz Gamma+Theta — full-body transformation",
    auditoryHz: 285,
    verbalAffirmations: [
      "Your body begins to loosen its familiar form",
      "Every cell receives the signal to transform",
      "Your physical and mental identity shifts and opens",
      "You become more than what you were before",
      "The hybrid form rises within you naturally",
      "Transformation flows from your core outward",
    ],
  },
  {
    value: "mermaid_shapeshifting",
    label: "Mermaid Shapeshifting",
    hz: 4,
    sublabel: "4 Hz Theta — aquatic attunement, deep body change",
    auditoryHz: 285,
    verbalAffirmations: [
      "Your connection to water deepens with each breath",
      "Your lower body begins to shift and flow",
      "Scales emerge softly along your skin",
      "You breathe in the rhythm of the ocean",
      "Your tail forms, graceful and powerful",
      "The sea recognizes you as one of its own",
    ],
  },
  {
    value: "wolf_shapeshifting",
    label: "Wolf Shapeshifting",
    hz: 14,
    sublabel: "14 Hz Beta — primal instinct, pack awareness",
    auditoryHz: 285,
    verbalAffirmations: [
      "Feel your spine lengthen and strengthen",
      "Your senses sharpen beyond human limits",
      "The wolf within awakens and rises",
      "You move with primal power and grace",
      "Silver fur unfurls across your shifting skin",
      "The moonlit forest calls you home",
    ],
  },
  {
    value: "dragon_shapeshifting",
    label: "Dragon Shapeshifting",
    hz: 40,
    sublabel: "40 Hz Gamma — fire/power, dominant transformation",
    auditoryHz: 528,
    verbalAffirmations: [
      "Ancient dragon power stirs deep within you",
      "Scales emerge, gleaming and impenetrable",
      "Your wingspan unfolds against the horizon",
      "Fire breath gathers in your transformed chest",
      "You rise to your full mythic, draconic form",
      "The dragon is awake — you are it, and it is you",
    ],
  },
  {
    value: "feathered_wing_shapeshifting",
    label: "Retractable Feathered Wing Shapeshifting",
    hz: 8,
    sublabel: "8 Hz Alpha/Theta — lightness, flight attunement",
    auditoryHz: 285,
    verbalAffirmations: [
      "Feathers sprout gently along your shoulder blades",
      "Your wings unfurl, vast and luminous",
      "You feel weightless, ready to ascend",
      "Each feather anchors your new avian nature",
      "Your wings retract smoothly when at rest",
      "The sky is your domain — you were born to fly",
    ],
  },
  {
    value: "retractable_wing_shapeshifting",
    label: "Retractable Wing Shapeshifting",
    hz: 8,
    sublabel: "8 Hz Alpha/Theta — structural wing growth",
    auditoryHz: 285,
    verbalAffirmations: [
      "Bone and membrane reshape along your back",
      "Your wings emerge strong and fully formed",
      "You extend them to catch the wind",
      "They fold inward perfectly when concealed",
      "You control their growth with effortless will",
      "Flight is now a natural expression of your body",
    ],
  },
  {
    value: "symbiote_shapeshifting",
    label: "Symbiote / Powers / Shapeshifting",
    hz: 30,
    sublabel: "30 Hz Beta — adaptation, symbiosis bonding",
    auditoryHz: 285,
    verbalAffirmations: [
      "The symbiote bonds with you at the cellular level",
      "You feel its dark, adaptive power merge with yours",
      "Your form flows and shifts at your command",
      "You absorb abilities and become something greater",
      "The bond is complete — you are unified as one",
      "Tendrils of power respond to your every thought",
    ],
  },
  {
    value: "bug_shapeshifting",
    label: "Bug Shapeshifting",
    hz: 3,
    sublabel: "3 Hz Delta — exoskeletal restructure, insect attunement",
    auditoryHz: 285,
    verbalAffirmations: [
      "Your exoskeleton hardens and takes shape",
      "Compound eyes open to a thousand-fold vision",
      "Your body restructures into its insect form",
      "Antennae emerge, sensing the world around you",
      "You shed and transform completely and naturally",
    ],
  },
  {
    value: "bird_shapeshifting",
    label: "Bird Shapeshifting",
    hz: 8,
    sublabel: "8 Hz Alpha/Theta — avian transformation",
    auditoryHz: 285,
    verbalAffirmations: [
      "Your bones hollow and lighten for flight",
      "Feathers replace skin, sleek and aerodynamic",
      "Your vision sharpens to that of a bird of prey",
      "Talons extend, wings spread wide",
      "You call out in your new avian voice",
      "The sky opens to receive you completely",
    ],
  },
  {
    value: "reptile_shapeshifting",
    label: "Reptile Shapeshifting",
    hz: 2,
    sublabel: "2 Hz Delta — cold-blooded reptilian restructuring",
    auditoryHz: 285,
    verbalAffirmations: [
      "Your body cools and slows into reptilian rhythm",
      "Scales spread across your skin like ancient armor",
      "Your tongue senses the air with primal acuity",
      "Cold blood and ancient instinct awaken within",
      "You shed your old self and emerge transformed",
    ],
  },
  {
    value: "mammal_shapeshifting",
    label: "Mammal Shapeshifting",
    hz: 6,
    sublabel: "6 Hz Theta — warm mammalian body change",
    auditoryHz: 285,
    verbalAffirmations: [
      "Warm-blooded transformation flows through you",
      "Fur, sinew, and bone reshape to your chosen form",
      "Your heartbeat synchronizes with your new body",
      "Ancient mammalian instincts rise to the surface",
      "You step fully into your transformed mammal form",
    ],
  },
  {
    value: "amphibian_shapeshifting",
    label: "Amphibian Shapeshifting",
    hz: 4,
    sublabel: "4 Hz Theta — aquatic/land dual-mode body change",
    auditoryHz: 285,
    verbalAffirmations: [
      "You breathe equally in water and on land",
      "Gills and lungs activate in perfect harmony",
      "Your skin moistens and adapts to any environment",
      "Metamorphosis completes your amphibian form",
      "You live in two worlds with equal mastery",
    ],
  },
  {
    value: "invertebrate_shapeshifting",
    label: "Invertebrate Shapeshifting",
    hz: 3,
    sublabel: "3 Hz Delta — soft body, spineless restructure",
    auditoryHz: 285,
    verbalAffirmations: [
      "Your spine dissolves into fluid flexibility",
      "Your body becomes soft, adaptive, and formless",
      "Tentacles or limbs emerge as your form desires",
      "Bioluminescence lights your transformed body",
      "You reshape continuously with effortless will",
    ],
  },
  {
    value: "fish_shapeshifting",
    label: "Fish Shapeshifting",
    hz: 4,
    sublabel: "4 Hz Theta — aquatic full-body transformation",
    auditoryHz: 285,
    verbalAffirmations: [
      "Gills open along your neck, breathing the deep",
      "Scales glide over your streamlined form",
      "Your fins guide you through dark aquatic currents",
      "Pressure and depth no longer threaten you",
      "You are one with the ocean, free and transformed",
    ],
  },
  {
    value: "anthropomorphic_shapeshifting",
    label: "Anthropomorphic Shapeshifting",
    hz: 6,
    sublabel: "6 Hz Theta — bipedal/human hybrid form",
    auditoryHz: 285,
    verbalAffirmations: [
      "Human and animal merge into a perfect hybrid",
      "You walk upright, carrying both natures within",
      "Your form blends the best of two worlds",
      "Instinct and reason coexist in your new body",
      "You are the anthropomorphic being you choose to be",
    ],
  },
  // ── Ability / Power Presets ───────────────────────────────────────────────
  {
    value: "biokinesis",
    label: "Biokinesis",
    hz: 10,
    carrier: 528,
    sublabel: "528 Hz carrier / 10 Hz Alpha — DNA/genetic change",
    auditoryHz: 528,
    verbalAffirmations: [
      "Your DNA is rewriting itself right now",
      "Every gene activates according to your will",
      "Cells divide and restructure with perfect precision",
      "Your biology responds to the power of your intention",
      "You command your body at the molecular level",
      "Genetic transformation proceeds completely and safely",
    ],
  },
  {
    value: "nzt_omnicompetence",
    label: "NZT / Omnicompetence",
    hz: 40,
    sublabel: "40 Hz Gamma — peak cognitive enhancement",
    auditoryHz: 480,
    verbalAffirmations: [
      "Every neuron fires in perfect synchronized clarity",
      "You access all knowledge and skill simultaneously",
      "Your mind operates beyond all normal human limits",
      "Pattern recognition and recall reach absolute peak",
      "You are the most capable version of yourself",
      "Unlimited intelligence flows through you now",
    ],
  },
  {
    value: "organic_web_shooters",
    label: "Organic Web Shooters in Forearms",
    hz: 20,
    sublabel: "20 Hz Beta — forearm restructuring, cellular growth",
    auditoryHz: 285,
    verbalAffirmations: [
      "Your forearms tingle as new structures form within",
      "Spinnerets develop beneath the skin of your wrists",
      "Organic silk compresses, ready to release",
      "You feel the first threads fire with perfect aim",
      "Web-shooting is now a natural part of your body",
    ],
  },
  {
    value: "improving_powers",
    label: "Improving Powers",
    hz: [40, 10],
    sublabel: "40+10 Hz Gamma+Alpha — amplify existing abilities",
    auditoryHz: 432,
    verbalAffirmations: [
      "Every ability you possess is amplifying right now",
      "Your existing powers deepen and expand",
      "What was strong grows stronger with every second",
      "You unlock the next level of your potential",
      "Your powers evolve beyond their previous ceiling",
    ],
  },
  {
    value: "teleportation_powers",
    label: "Teleportation Powers",
    hz: 7.83,
    sublabel: "7.83 Hz Earth/quantum resonance",
    auditoryHz: 963,
    verbalAffirmations: [
      "Space folds around you at your command",
      "Distance becomes irrelevant to your being",
      "You quantum-shift to wherever you intend",
      "Your body deconstructs and reconstructs instantly",
      "You have always had the ability to teleport",
      "You blink across dimensions with perfect control",
    ],
  },
  {
    value: "omniscience",
    label: "Omniscience",
    hz: 40,
    sublabel: "40 Hz Gamma — total awareness expansion",
    auditoryHz: 963,
    verbalAffirmations: [
      "All knowledge past, present, and future opens to you",
      "You perceive the complete truth of any situation",
      "Every question you hold is answered within you",
      "Omniscient awareness expands to fill your mind",
      "You know what you need to know, always",
    ],
  },
  {
    value: "omni_manipulation",
    label: "Omni-Manipulation",
    hz: 40,
    sublabel: "40 Hz Gamma — control of all forces",
    auditoryHz: 963,
    verbalAffirmations: [
      "All forces of reality respond to your will",
      "Matter, energy, time, and space bend to you",
      "Your control over all things is absolute",
      "You manipulate the fabric of existence itself",
      "Every element of reality is within your command",
    ],
  },
  {
    value: "omnificence",
    label: "Omnificence",
    hz: 40,
    carrier: 528,
    sublabel: "528 Hz carrier / 40 Hz Gamma — infinite creative power",
    auditoryHz: 528,
    verbalAffirmations: [
      "You create from nothing with infinite power",
      "Your imagination manifests as physical reality",
      "The universe flows through your creative will",
      "You bring into existence whatever you envision",
      "Infinite creation is your birthright and your gift",
    ],
  },
  {
    value: "omnifarious",
    label: "Omnifarious",
    hz: 6,
    sublabel: "6 Hz Theta — infinite form transformation",
    auditoryHz: 285,
    verbalAffirmations: [
      "You can become anything you choose to be",
      "Every form in existence is available to you",
      "Your identity is fluid, limitless, and free",
      "You shift between forms with a single thought",
      "Infinite transformation is your natural state",
    ],
  },
  {
    value: "omni_psionics",
    label: "Omni-Psionics",
    hz: [40, 6],
    sublabel: "40+6 Hz Gamma+Theta — total psionic awakening",
    auditoryHz: 963,
    verbalAffirmations: [
      "Your psionic abilities awaken completely",
      "Telekinesis, telepathy, and clairvoyance activate",
      "Your mind reaches beyond all physical boundaries",
      "Psychic force flows through you like electric current",
      "All psionic powers are fully operational within you",
    ],
  },
  {
    value: "omnilock",
    label: "Omnilock",
    hz: 2,
    sublabel: "2 Hz Delta — absolute immovability, transcendence of causality",
    auditoryHz: 174,
    verbalAffirmations: [
      "You transcend the reach of all external forces",
      "Nothing in any reality can affect you",
      "You exist beyond causality and consequence",
      "You are absolutely immovable in your true nature",
      "The omnilock seals your being in perfect stasis",
    ],
  },
  {
    value: "alpha_reality_manipulation",
    label: "Alpha Reality Manipulation",
    hz: 7.83,
    sublabel: "7.83 Hz Schumann — reshape base reality",
    auditoryHz: 963,
    verbalAffirmations: [
      "Reality reshapes itself around your intention",
      "The laws of physics bend at your command",
      "You rewrite the source code of existence",
      "Every moment of reality is yours to redirect",
      "You are the author of the world you inhabit",
      "Alpha-level reality yields completely to your will",
    ],
  },
];

function getHzList(preset: IsochronicPreset, customHz: number): number[] {
  if (preset === "custom") return [customHz];
  const def = PRESETS.find((p) => p.value === preset);
  if (!def) return [10];
  const hz = def.hz;
  return Array.isArray(hz) ? hz : [hz];
}

function getCarrier(preset: IsochronicPreset): number {
  return PRESETS.find((p) => p.value === preset)?.carrier ?? 200;
}

function getAuditoryHz(preset: IsochronicPreset): number {
  return PRESETS.find((p) => p.value === preset)?.auditoryHz ?? 432;
}

function getVerbalAffirmations(preset: IsochronicPreset): string[] {
  return PRESETS.find((p) => p.value === preset)?.verbalAffirmations ?? [];
}

// Each active preset gets its own oscillator pair + optional auditory tone
interface ToneNodes {
  ctx: AudioContext;
  carrier: OscillatorNode;
  lfo: OscillatorNode;
  masterGain: GainNode;
  lfoGain: GainNode;
  auditoryOsc?: OscillatorNode;
  auditoryGain?: GainNode;
}

export function IsochronicPanel() {
  const { isochronic, setIsochronic } = useAppStore();
  const { presets, customHz, volume, isActive } = isochronic;

  const [searchQuery, setSearchQuery] = useState("");
  const [auditoryEnabled, setAuditoryEnabled] = useState(true);
  const [verbalEnabled, setVerbalEnabled] = useState(true);

  const tonesRef = useRef<Map<string, ToneNodes>>(new Map());
  // Verbal speech interval refs per preset
  const verbalIntervalsRef = useRef<
    Map<string, ReturnType<typeof setInterval>>
  >(new Map());
  const verbalIndexRef = useRef<Map<string, number>>(new Map());

  // ---- Verbal affirmation helpers ----
  const startVerbalForPreset = useCallback((preset: IsochronicPreset) => {
    const phrases = getVerbalAffirmations(preset);
    if (
      !phrases.length ||
      typeof window === "undefined" ||
      !window.speechSynthesis
    )
      return;
    // Clear existing interval for this preset
    const existing = verbalIntervalsRef.current.get(preset);
    if (existing) clearInterval(existing);
    verbalIndexRef.current.set(preset, 0);

    const speakNext = () => {
      if (!window.speechSynthesis) return;
      const idx = verbalIndexRef.current.get(preset) ?? 0;
      const phrase = phrases[idx % phrases.length];
      const utt = new SpeechSynthesisUtterance(phrase);
      utt.rate = 0.85;
      utt.pitch = 0.9;
      // Scale TTS volume proportionally with the preset volume slider
      utt.volume = (volumeRef.current / 100) * 0.85;
      window.speechSynthesis.speak(utt);
      verbalIndexRef.current.set(preset, (idx + 1) % phrases.length);
    };

    // Speak first phrase immediately
    speakNext();
    const interval = setInterval(speakNext, 8000);
    verbalIntervalsRef.current.set(preset, interval);
  }, []);

  const stopVerbalForPreset = useCallback((preset: IsochronicPreset) => {
    const interval = verbalIntervalsRef.current.get(preset);
    if (interval) {
      clearInterval(interval);
      verbalIntervalsRef.current.delete(preset);
    }
    verbalIndexRef.current.delete(preset);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stopAllVerbal = useCallback(() => {
    for (const preset of verbalIntervalsRef.current.keys()) {
      const interval = verbalIntervalsRef.current.get(preset);
      if (interval) clearInterval(interval);
    }
    verbalIntervalsRef.current.clear();
    verbalIndexRef.current.clear();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Stop all running tones
  const stopAll = useCallback(() => {
    for (const nodes of tonesRef.current.values()) {
      try {
        nodes.carrier.stop();
      } catch (_) {
        /* already stopped */
      }
      try {
        nodes.lfo.stop();
      } catch (_) {
        /* already stopped */
      }
      if (nodes.auditoryOsc) {
        try {
          nodes.auditoryOsc.stop();
        } catch (_) {
          /* */
        }
      }
      nodes.carrier.disconnect();
      nodes.lfo.disconnect();
      nodes.lfoGain.disconnect();
      nodes.masterGain.disconnect();
      nodes.auditoryOsc?.disconnect();
      nodes.auditoryGain?.disconnect();
      nodes.ctx.close().catch(() => {});
    }
    tonesRef.current.clear();
  }, []);

  // Start one oscillator pair for a given key/hz/carrier/volume
  const startOneTone = useCallback(
    (
      key: string,
      hzValues: number[],
      carrierHz: number,
      vol: number,
      presetValue: IsochronicPreset,
      withAuditory: boolean,
    ) => {
      const ctx = new AudioContext();
      const masterGain = ctx.createGain();
      masterGain.gain.value = (vol / 100) * 0.5;
      masterGain.connect(ctx.destination);

      const lfoHz = hzValues[0];

      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = carrierHz;

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = lfoHz;

      const lfoGain = ctx.createGain();
      lfoGain.gain.value = (vol / 100) * 0.5;

      lfo.connect(lfoGain);
      lfoGain.connect(masterGain.gain);
      carrier.connect(masterGain);

      carrier.start();
      lfo.start();

      const nodes: ToneNodes = { ctx, carrier, lfo, masterGain, lfoGain };

      // Auditory affirmation layer — soft continuous sine
      if (withAuditory && presetValue !== "custom") {
        const auditoryHz = getAuditoryHz(presetValue);
        const auditoryOsc = ctx.createOscillator();
        auditoryOsc.type = "sine";
        auditoryOsc.frequency.value = auditoryHz;
        const auditoryGain = ctx.createGain();
        // Scale auditory affirmation gain proportionally with the preset volume slider
        auditoryGain.gain.value = (vol / 100) * 0.08;
        auditoryOsc.connect(auditoryGain);
        auditoryGain.connect(ctx.destination);
        auditoryOsc.start();
        nodes.auditoryOsc = auditoryOsc;
        nodes.auditoryGain = auditoryGain;
      }

      tonesRef.current.set(key, nodes);
    },
    [],
  );

  // Sync running tones to active presets
  const syncTones = useCallback(
    (
      activePresets: IsochronicPreset[],
      vol: number,
      active: boolean,
      withAuditory: boolean,
      withVerbal: boolean,
    ) => {
      if (!active) {
        stopAll();
        stopAllVerbal();
        return;
      }

      const desired = new Map<
        string,
        { hzValues: number[]; carrierHz: number; presetValue: IsochronicPreset }
      >();
      for (const p of activePresets) {
        const hzList = getHzList(p, customHz);
        const carrierHz = getCarrier(p);
        hzList.forEach((hz, i) => {
          const key = `${p}__${i}`;
          desired.set(key, { hzValues: [hz], carrierHz, presetValue: p });
        });
      }

      // Stop tones that are no longer needed
      for (const key of tonesRef.current.keys()) {
        if (!desired.has(key)) {
          const nodes = tonesRef.current.get(key)!;
          try {
            nodes.carrier.stop();
          } catch (_) {
            /* */
          }
          try {
            nodes.lfo.stop();
          } catch (_) {
            /* */
          }
          if (nodes.auditoryOsc) {
            try {
              nodes.auditoryOsc.stop();
            } catch (_) {
              /* */
            }
          }
          nodes.carrier.disconnect();
          nodes.lfo.disconnect();
          nodes.lfoGain.disconnect();
          nodes.masterGain.disconnect();
          nodes.auditoryOsc?.disconnect();
          nodes.auditoryGain?.disconnect();
          nodes.ctx.close().catch(() => {});
          tonesRef.current.delete(key);
        }
      }

      // Start new tones
      for (const [
        key,
        { hzValues, carrierHz, presetValue },
      ] of desired.entries()) {
        if (!tonesRef.current.has(key)) {
          startOneTone(
            key,
            hzValues,
            carrierHz,
            vol,
            presetValue,
            withAuditory,
          );
        }
      }

      // Sync verbal — start for active, stop for removed
      for (const p of activePresets) {
        if (withVerbal && !verbalIntervalsRef.current.has(p)) {
          startVerbalForPreset(p);
        } else if (!withVerbal && verbalIntervalsRef.current.has(p)) {
          stopVerbalForPreset(p);
        }
      }
      for (const p of verbalIntervalsRef.current.keys()) {
        if (!activePresets.includes(p as IsochronicPreset)) {
          stopVerbalForPreset(p as IsochronicPreset);
        }
      }
    },
    [
      customHz,
      startOneTone,
      stopAll,
      stopAllVerbal,
      startVerbalForPreset,
      stopVerbalForPreset,
    ],
  );

  const presetsRef = useRef(presets);
  const volumeRef = useRef(volume);
  const isActiveRef = useRef(isActive);
  const auditoryEnabledRef = useRef(auditoryEnabled);
  const verbalEnabledRef = useRef(verbalEnabled);
  presetsRef.current = presets;
  volumeRef.current = volume;
  isActiveRef.current = isActive;
  auditoryEnabledRef.current = auditoryEnabled;
  verbalEnabledRef.current = verbalEnabled;

  const syncTonesRef = useRef(syncTones);
  syncTonesRef.current = syncTones;

  useEffect(() => {
    syncTonesRef.current(
      presetsRef.current,
      volumeRef.current,
      isActive,
      auditoryEnabledRef.current,
      verbalEnabledRef.current,
    );
  }, [isActive]);

  useEffect(() => {
    if (isActiveRef.current) {
      syncTonesRef.current(
        presets,
        volumeRef.current,
        true,
        auditoryEnabledRef.current,
        verbalEnabledRef.current,
      );
    }
  }, [presets]);

  // When auditory toggle changes, restart tones so they reflect the new state
  useEffect(() => {
    if (isActiveRef.current) {
      stopAll();
      syncTonesRef.current(
        presetsRef.current,
        volumeRef.current,
        true,
        auditoryEnabled,
        verbalEnabledRef.current,
      );
    }
  }, [auditoryEnabled, stopAll]);

  // When verbal toggle changes, sync verbal without restarting tones
  useEffect(() => {
    if (!isActiveRef.current) return;
    if (verbalEnabled) {
      for (const p of presetsRef.current) {
        if (!verbalIntervalsRef.current.has(p)) startVerbalForPreset(p);
      }
    } else {
      stopAllVerbal();
    }
  }, [verbalEnabled, startVerbalForPreset, stopAllVerbal]);

  // Update volume on all running tones — scales main tone, auditory affirmation, and verbal guide
  useEffect(() => {
    for (const nodes of tonesRef.current.values()) {
      nodes.masterGain.gain.value = (volume / 100) * 0.5;
      nodes.lfoGain.gain.value = (volume / 100) * 0.5;
      // Also scale the auditory affirmation gain node if present
      if (nodes.auditoryGain) {
        nodes.auditoryGain.gain.value = (volume / 100) * 0.08;
      }
    }
    // The verbal guide (TTS) reads volumeRef.current at speak time, so no action needed here —
    // each new utterance will pick up the updated volume automatically via volumeRef.
  }, [volume]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      stopAll();
      stopAllVerbal();
    },
    [stopAll, stopAllVerbal],
  );

  const togglePreset = (preset: IsochronicPreset) => {
    const current = presets;
    const next = current.includes(preset)
      ? current.filter((p) => p !== preset)
      : [...current, preset];
    setIsochronic({ presets: next });
  };

  const handlePlay = () => setIsochronic({ isActive: true });
  const handleStop = () => setIsochronic({ isActive: false });

  const showCustomInput = presets.includes("custom");

  const activeLabels = PRESETS.filter((p) => presets.includes(p.value)).map(
    (p) => {
      const hzList = getHzList(p.value, customHz);
      return `${p.label} (${hzList.map((h) => `${h}Hz`).join("+")})`;
    },
  );

  const filteredPresets = searchQuery.trim()
    ? PRESETS.filter((p) =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : PRESETS;

  const noResults = filteredPresets.length === 0;

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
          ISOCHRONIC TONE
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
          {isActive ? "ACTIVE" : "INACTIVE"}
        </span>
      </div>

      {/* Preset multi-select with search */}
      <div className="mb-4">
        <Label
          className="font-mono text-xs block mb-2"
          style={{ color: "#FFD700", letterSpacing: 1 }}
        >
          PRESETS — SELECT ONE OR MORE
        </Label>

        {/* Search input */}
        <div className="mb-2">
          <Input
            data-ocid="iso-preset-search"
            type="text"
            placeholder="Search presets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "#111",
              color: "#FFD700",
              border: "1px solid #FFD700",
              borderRadius: 2,
              fontFamily: "inherit",
              fontSize: 11,
              height: 32,
            }}
          />
        </div>

        <div
          className="flex flex-col gap-0.5 overflow-y-auto"
          style={{ maxHeight: 260, paddingRight: 2 }}
          data-ocid="iso-preset-list"
        >
          {noResults ? (
            <div
              style={{
                color: "#555",
                fontSize: 11,
                padding: "8px 4px",
                textAlign: "center",
              }}
            >
              No presets found
            </div>
          ) : (
            filteredPresets.map((p) => {
              const checked = presets.includes(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  data-ocid={`iso-preset-${p.value}`}
                  onClick={() => togglePreset(p.value)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "5px 8px",
                    background: checked ? "#1a1400" : "transparent",
                    border: `1px solid ${checked ? "#FFD700" : "#333"}`,
                    borderRadius: 2,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 14,
                      height: 14,
                      border: `1px solid ${checked ? "#FFD700" : "#555"}`,
                      borderRadius: 2,
                      background: checked ? "#FFD700" : "transparent",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {checked && (
                      <span
                        style={{
                          color: "#000",
                          fontSize: 9,
                          fontWeight: "bold",
                          lineHeight: 1,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span
                      style={{
                        color: checked ? "#FFD700" : "#888",
                        fontSize: 11,
                        display: "block",
                        letterSpacing: 0.5,
                      }}
                    >
                      {p.label}
                    </span>
                    {p.sublabel && (
                      <span
                        style={{
                          color: checked ? "#FFD70099" : "#555",
                          fontSize: 10,
                          display: "block",
                          marginTop: 1,
                        }}
                      >
                        {p.sublabel}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Custom Hz input */}
      {showCustomInput && (
        <div className="mb-4">
          <Label
            className="font-mono text-xs block mb-1"
            style={{ color: "#FFD700", letterSpacing: 1 }}
          >
            CUSTOM FREQUENCY (Hz)
          </Label>
          <Input
            data-ocid="iso-custom-hz"
            type="number"
            min={0.5}
            max={1000}
            step={0.5}
            value={customHz}
            onChange={(e) =>
              setIsochronic({
                customHz: Number.parseFloat(e.target.value) || 10,
              })
            }
            style={{
              background: "#111",
              color: "#FFD700",
              border: "1px solid #FFD700",
              borderRadius: 2,
              fontFamily: "inherit",
              fontSize: 12,
            }}
          />
        </div>
      )}

      {/* Active summary */}
      <div
        className="mb-4"
        style={{
          border: "1px solid #333",
          borderRadius: 2,
          padding: "6px 8px",
          background: "#050505",
          minHeight: 36,
        }}
        data-ocid="iso-active-summary"
      >
        {presets.length === 0 ? (
          <span style={{ color: "#444", fontSize: 11 }}>
            No presets selected
          </span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {activeLabels.map((label) => (
              <span
                key={label}
                style={{ color: "#FFD700", fontSize: 11, letterSpacing: 0.5 }}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Auditory Affirmation toggle */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span style={{ color: "#FFD700", fontSize: 11, letterSpacing: 1 }}>
            AUDITORY AFFIRMATION
          </span>
          <span
            style={{
              color: "#555",
              fontSize: 10,
              display: "block",
              marginTop: 1,
            }}
          >
            Soft reinforcement tone per preset
          </span>
        </div>
        <button
          type="button"
          data-ocid="iso-auditory-toggle"
          onClick={() => setAuditoryEnabled((v) => !v)}
          style={{
            padding: "4px 10px",
            background: auditoryEnabled ? "#1a1400" : "transparent",
            color: auditoryEnabled ? "#FFD700" : "#555",
            border: `1px solid ${auditoryEnabled ? "#FFD700" : "#333"}`,
            borderRadius: 2,
            fontFamily: "inherit",
            fontSize: 10,
            letterSpacing: 1,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {auditoryEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* Verbal Guide toggle */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span style={{ color: "#FFD700", fontSize: 11, letterSpacing: 1 }}>
            VERBAL GUIDE
          </span>
          <span
            style={{
              color: "#555",
              fontSize: 10,
              display: "block",
              marginTop: 1,
            }}
          >
            Spoken phrases guide your shift
          </span>
        </div>
        <button
          type="button"
          data-ocid="iso-verbal-toggle"
          onClick={() => setVerbalEnabled((v) => !v)}
          style={{
            padding: "4px 10px",
            background: verbalEnabled ? "#1a1400" : "transparent",
            color: verbalEnabled ? "#FFD700" : "#555",
            border: `1px solid ${verbalEnabled ? "#FFD700" : "#333"}`,
            borderRadius: 2,
            fontFamily: "inherit",
            fontSize: 10,
            letterSpacing: 1,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {verbalEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* Volume */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <Label
            className="font-mono text-xs"
            style={{ color: "#FFD700", letterSpacing: 1 }}
          >
            VOLUME
          </Label>
          <span style={{ color: "#FFD700", fontSize: 11 }}>{volume}%</span>
        </div>
        <Slider
          data-ocid="iso-volume"
          min={0}
          max={100}
          step={1}
          value={[volume]}
          onValueChange={([v]) => setIsochronic({ volume: v })}
          className="[&_.bg-primary]:bg-[#FFD700] [&_[role=slider]]:border-[#FFD700] [&_[role=slider]]:bg-[#FFD700]"
        />
      </div>

      {/* Play / Stop buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          data-ocid="iso-play"
          onClick={handlePlay}
          disabled={isActive || presets.length === 0}
          style={{
            flex: 1,
            padding: "8px 0",
            background: isActive ? "#1a1a0a" : "#111",
            color: isActive
              ? "#554400"
              : presets.length === 0
                ? "#444"
                : "#FFD700",
            border: `1px solid ${isActive ? "#443300" : presets.length === 0 ? "#333" : "#FFD700"}`,
            borderRadius: 2,
            fontFamily: "inherit",
            fontSize: 12,
            letterSpacing: 2,
            cursor:
              isActive || presets.length === 0 ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          ▶ PLAY
        </button>
        <button
          type="button"
          data-ocid="iso-stop"
          onClick={handleStop}
          disabled={!isActive}
          style={{
            flex: 1,
            padding: "8px 0",
            background: !isActive ? "#0a0a0a" : "#111",
            color: !isActive ? "#444" : "#FFD700",
            border: `1px solid ${!isActive ? "#222" : "#FFD700"}`,
            borderRadius: 2,
            fontFamily: "inherit",
            fontSize: 12,
            letterSpacing: 2,
            cursor: !isActive ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          ■ STOP
        </button>
      </div>
    </div>
  );
}
