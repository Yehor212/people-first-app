import path from "node:path";


export const SAMPLE_RATE = 48_000;
export const CHANNELS = 2;
export const BITRATE = "128k";
export const GENERATOR_VERSION = "2.0.0-cc0-hybrid";
export const STATUS = "SOURCE_RIGHTS_DOCUMENTED_REVIEW_ONLY";

export const FAMILIES = Object.freeze([
  "forest",
  "rain",
  "ocean",
  "fireplace",
  "river",
  "wind",
]);
export const LEVELS = Object.freeze(["soft", "deep", "intense"]);
export const AMBIENCE_FILE_NAMES = Object.freeze([
  "soft-air-veil.mp3",
  "gentle-water-bed.mp3",
  "soft-rain-veil.mp3",
]);
export const FEEDBACK_FILE_NAMES = Object.freeze([
  "feedback-success.mp3",
  "feedback-complete.mp3",
  "feedback-streak.mp3",
  "feedback-milestone.mp3",
  "feedback-notification.mp3",
]);
export const EXPECTED_FILE_NAMES = Object.freeze([
  ...FAMILIES.flatMap((family) =>
    LEVELS.map((level) => `hyperfocus-${family}-${level}.mp3`)
  ),
  ...AMBIENCE_FILE_NAMES,
  ...FEEDBACK_FILE_NAMES,
]);

export const OFFICIAL_LICENSE_URL = "https://bigsoundbank.com/licenses.html";
export const SOURCE_BASE_URL = "https://bigsoundbank.com/UPLOAD/mp3";
export const SOURCE_CACHE_VERSION = 1;

export const SOURCE_MANIFEST = Object.freeze({
  forestSoft: source({
    soundNumber: 1348,
    title: "Forest #2",
    slug: "forest-2-s1348",
    author: "Joseph SARDIN",
    technical: "48 kHz / 24-bit / stereo / ORTF",
    durationSeconds: 412,
  }),
  forestDeep: source({
    soundNumber: 2715,
    title: "Forest #3",
    slug: "forest-3-s2715",
    author: "Pierre SIBANARCO",
    technical: "48 kHz / 24-bit / stereo",
    durationSeconds: 161,
  }),
  forestIntense: source({
    soundNumber: 699,
    title: "Forests of Gironde, France",
    slug: "forests-of-gironde-france-s0699",
    author: "Joseph SARDIN",
    technical: "48 kHz / 16-bit / stereo / XY",
    durationSeconds: 40,
  }),
  rainSoft: source({
    soundNumber: 2679,
    title: "Rain Under an Umbrella",
    slug: "rain-under-an-umbrella-s2679",
    author: "Pierre SIBANARCO",
    technical: "48 kHz / 24-bit / stereo",
    durationSeconds: 32,
  }),
  rainDeep: source({
    soundNumber: 1019,
    title: "Summer Rain on Terrace",
    slug: "summer-rain-on-terrace-s1019",
    author: "Joseph SARDIN",
    technical: "48 kHz / 16-bit / stereo",
    durationSeconds: 157,
  }),
  rainIntense: source({
    soundNumber: 1294,
    title: "Big rain on car roof",
    slug: "big-rain-on-car-roof-s1294",
    author: "Joseph SARDIN",
    technical: "48 kHz / 24-bit / mono",
    durationSeconds: 83,
  }),
  oceanSoft: source({
    soundNumber: 1047,
    title: "Small Waves Back to the Ocean",
    slug: "small-waves-back-to-the-ocean-s1047",
    author: "Joseph SARDIN",
    technical: "48 kHz / 16-bit / stereo",
    durationSeconds: 90,
  }),
  oceanDeep: source({
    soundNumber: 698,
    title: "Sea Waves",
    slug: "sea-waves-s0698",
    author: "Joseph SARDIN",
    technical: "48 kHz / 16-bit / stereo / XY",
    durationSeconds: 166,
  }),
  oceanIntense: source({
    soundNumber: 2570,
    title: "Cliff #1",
    slug: "cliff-1-s2570",
    author: "Joseph SARDIN",
    technical: "48 kHz / 24-bit / stereo",
    durationSeconds: 333,
  }),
  fireplace: source({
    soundNumber: 2856,
    title: "Fireplace #4",
    slug: "fireplace-4-s2856",
    author: "Joseph SARDIN",
    technical: "48 kHz / 24-bit / stereo",
    durationSeconds: 80,
  }),
  riverSoft: source({
    soundNumber: 823,
    title: "Small Stream",
    slug: "small-stream-s0823",
    author: "Joseph SARDIN",
    technical: "48 kHz / 16-bit / stereo",
    durationSeconds: 97,
  }),
  riverDeep: source({
    soundNumber: 3218,
    title: "Mountain stream #5",
    slug: "mountain-stream-5-s3218",
    author: "Joseph SARDIN & Axeline T.",
    technical: "48 kHz / 24-bit / stereo / ORTF",
    durationSeconds: 106,
  }),
  riverIntense: source({
    soundNumber: 871,
    title: "Small dam",
    slug: "small-dam-s0871",
    author: "Joseph SARDIN",
    technical: "48 kHz / 16-bit / stereo",
    durationSeconds: 70,
  }),
  windSoft: source({
    soundNumber: 659,
    title: "Wind in a Tree",
    slug: "wind-in-a-tree-s0659",
    author: "Joseph SARDIN",
    technical: "stereo field recording",
    durationSeconds: 115,
  }),
  windDeep: source({
    soundNumber: 904,
    title: "Wind in the Trees",
    slug: "forest-wind-in-the-trees-s0904",
    author: "Joseph SARDIN",
    technical: "48 kHz / 16-bit / stereo",
    durationSeconds: 219,
  }),
  windIntense: source({
    soundNumber: 1450,
    title: "Strong wind and trees #1",
    slug: "strong-wind-and-trees-1-s1450",
    author: "Joseph SARDIN",
    technical: "48 kHz / 24-bit / stereo / ORTF",
    durationSeconds: 118,
  }),
  ambienceWater: source({
    soundNumber: 1354,
    title: "Small Stream #4",
    slug: "small-stream-4-s1354",
    author: "Joseph SARDIN",
    technical: "48 kHz / 24-bit / stereo / ORTF",
    durationSeconds: 105,
  }),
});

export const LEVEL_TARGETS = Object.freeze({
  soft: Object.freeze({ loudnessLufs: -34, truePeakDbfs: -3.5 }),
  deep: Object.freeze({ loudnessLufs: -30, truePeakDbfs: -3.0 }),
  intense: Object.freeze({ loudnessLufs: -26, truePeakDbfs: -2.5 }),
});

export const PROCEDURAL_SEEDS = Object.freeze({
  softAir: 0x5a17a11,
  success: 0x51cc355,
  complete: 0xc0a1e7e,
  streak: 0x57aea,
  milestone: 0xa11e570,
  notification: 0xa071f1,
});

export const FEEDBACK_SPECS = Object.freeze({
  "feedback-success.mp3": Object.freeze({
    id: "feedback-success",
    durationSeconds: 0.48,
    targetRmsDbfs: -26,
    peakLimitDbfs: -12,
    seed: PROCEDURAL_SEEDS.success,
    notes: Object.freeze([
      Object.freeze([392.0, 0.020, 0.215, 0.68, -0.12]),
      Object.freeze([493.88, 0.135, 0.285, 0.86, 0.10]),
    ]),
  }),
  "feedback-complete.mp3": Object.freeze({
    id: "feedback-complete",
    durationSeconds: 0.62,
    targetRmsDbfs: -25,
    peakLimitDbfs: -11,
    seed: PROCEDURAL_SEEDS.complete,
    notes: Object.freeze([
      Object.freeze([329.63, 0.020, 0.225, 0.56, -0.16]),
      Object.freeze([392.0, 0.140, 0.255, 0.70, 0.00]),
      Object.freeze([493.88, 0.290, 0.285, 0.87, 0.15]),
    ]),
  }),
  "feedback-streak.mp3": Object.freeze({
    id: "feedback-streak",
    durationSeconds: 0.78,
    targetRmsDbfs: -24,
    peakLimitDbfs: -10,
    seed: PROCEDURAL_SEEDS.streak,
    notes: Object.freeze([
      Object.freeze([349.23, 0.020, 0.235, 0.50, -0.20]),
      Object.freeze([440.0, 0.145, 0.255, 0.62, -0.06]),
      Object.freeze([523.25, 0.300, 0.275, 0.75, 0.08]),
      Object.freeze([587.33, 0.450, 0.285, 0.84, 0.20]),
    ]),
  }),
  "feedback-milestone.mp3": Object.freeze({
    id: "feedback-milestone",
    durationSeconds: 0.72,
    targetRmsDbfs: -23.5,
    peakLimitDbfs: -9.5,
    seed: PROCEDURAL_SEEDS.milestone,
    notes: Object.freeze([
      Object.freeze([196.0, 0.000, 0.520, 0.20, 0.00]),
      Object.freeze([392.0, 0.025, 0.255, 0.58, -0.16]),
      Object.freeze([493.88, 0.185, 0.280, 0.73, 0.00]),
      Object.freeze([587.33, 0.365, 0.295, 0.86, 0.16]),
    ]),
  }),
  "feedback-notification.mp3": Object.freeze({
    id: "feedback-notification",
    durationSeconds: 0.34,
    targetRmsDbfs: -28,
    peakLimitDbfs: -16,
    seed: PROCEDURAL_SEEDS.notification,
    notes: Object.freeze([
      Object.freeze([587.33, 0.020, 0.255, 0.70, 0.00]),
    ]),
  }),
});

function source({ soundNumber, title, slug, author, technical, durationSeconds }) {
  const padded = String(soundNumber).padStart(4, "0");
  return Object.freeze({
    soundNumber,
    title,
    author,
    technical,
    durationSeconds,
    license: "CC0-1.0 / public-domain equivalent",
    licenseUrl: OFFICIAL_LICENSE_URL,
    pageUrl: `https://bigsoundbank.com/${slug}.html`,
    mp3Url: `${SOURCE_BASE_URL}/${padded}.mp3`,
  });
}
function makeDefinitions() {
  const definitions = [
    familyDefinition("forest", "soft", "forestSoft", 120, "highpass=f=70,lowpass=f=6800,equalizer=f=220:t=q:w=1.1:g=-1.5"),
    familyDefinition("forest", "deep", "forestDeep", 55, "highpass=f=65,lowpass=f=10500,equalizer=f=2800:t=q:w=1.3:g=-1.0"),
    familyDefinition("forest", "intense", "forestIntense", 4, "highpass=f=80,lowpass=f=14000,acompressor=threshold=0.18:ratio=1.7:attack=35:release=280"),

    familyDefinition("rain", "soft", "rainSoft", 0, "highpass=f=115,lowpass=f=9000,equalizer=f=2600:t=q:w=1.1:g=-1.5"),
    familyDefinition("rain", "deep", "rainDeep", 40, "highpass=f=95,lowpass=f=12500,equalizer=f=450:t=q:w=1.0:g=-1.0"),
    familyDefinition("rain", "intense", "rainIntense", 20, "highpass=f=80,lowpass=f=15000,acompressor=threshold=0.12:ratio=2.0:attack=12:release=180"),

    familyDefinition("ocean", "soft", "oceanSoft", 15, "highpass=f=38,lowpass=f=7200,equalizer=f=180:t=q:w=1.0:g=1.2"),
    familyDefinition("ocean", "deep", "oceanDeep", 60, "highpass=f=34,lowpass=f=10500,equalizer=f=320:t=q:w=1.0:g=0.8"),
    familyDefinition("ocean", "intense", "oceanIntense", 90, "highpass=f=32,lowpass=f=13500,acompressor=threshold=0.16:ratio=1.8:attack=28:release=320"),

    familyDefinition("fireplace", "soft", "fireplace", 1, "highpass=f=45,lowpass=f=5200,equalizer=f=2500:t=q:w=1.2:g=-2.0,acompressor=threshold=0.14:ratio=1.7:attack=8:release=160"),
    familyDefinition("fireplace", "deep", "fireplace", 24, "highpass=f=42,lowpass=f=8200,equalizer=f=180:t=q:w=1.0:g=1.2"),
    familyDefinition("fireplace", "intense", "fireplace", 48, "highpass=f=40,lowpass=f=11000,acompressor=threshold=0.10:ratio=2.1:attack=5:release=130"),

    familyDefinition("river", "soft", "riverSoft", 15, "highpass=f=75,lowpass=f=9000,equalizer=f=3500:t=q:w=1.2:g=-1.2"),
    familyDefinition("river", "deep", "riverDeep", 35, "highpass=f=65,lowpass=f=12500,equalizer=f=300:t=q:w=1.0:g=0.6"),
    familyDefinition("river", "intense", "riverIntense", 20, "highpass=f=55,lowpass=f=14500,acompressor=threshold=0.13:ratio=1.9:attack=18:release=220"),

    familyDefinition("wind", "soft", "windSoft", 20, "highpass=f=35,lowpass=f=5200,equalizer=f=1300:t=q:w=1.3:g=-1.8"),
    familyDefinition("wind", "deep", "windDeep", 80, "highpass=f=32,lowpass=f=7600,equalizer=f=240:t=q:w=1.0:g=0.8"),
    familyDefinition("wind", "intense", "windIntense", 40, "highpass=f=30,lowpass=f=10500,acompressor=threshold=0.15:ratio=1.8:attack=45:release=360"),

    sourceAmbienceDefinition({
      id: "gentle-water-bed",
      fileName: "gentle-water-bed.mp3",
      role: "Orb ambience — calm continuous water",
      sourceKey: "ambienceWater",
      sourceStartSeconds: 3,
      durationSeconds: 96,
      targetLoudnessLufs: -31.5,
      truePeakDbfs: -4,
      filters: "highpass=f=55,lowpass=f=9500,equalizer=f=3000:t=q:w=1.1:g=-1.3,acompressor=threshold=0.18:ratio=1.45:attack=40:release=350",
    }),
    sourceAmbienceDefinition({
      id: "soft-rain-veil",
      fileName: "soft-rain-veil.mp3",
      role: "Diary/settings ambience — soft rain veil",
      sourceKey: "rainDeep",
      sourceStartSeconds: 20,
      durationSeconds: 96,
      targetLoudnessLufs: -32.5,
      truePeakDbfs: -4,
      filters: "highpass=f=110,lowpass=f=9500,equalizer=f=2800:t=q:w=1.0:g=-1.5,acompressor=threshold=0.20:ratio=1.35:attack=35:release=300",
    }),
  ];

  const ordered = [];
  for (const family of FAMILIES) {
    for (const level of LEVELS) {
      ordered.push(definitions.find((definition) => definition.id === `${family}:${level}`));
    }
  }
  ordered.push({
    id: "soft-air-veil",
    fileName: "soft-air-veil.mp3",
    category: "ambience",
    role: "Entry/auth ambience — calm air veil",
    durationSeconds: 96,
    looped: true,
    sourceType: "first-party-deterministic-procedural-synthesis",
    sourceKey: null,
  });
  ordered.push(definitions.find((definition) => definition.id === "gentle-water-bed"));
  ordered.push(definitions.find((definition) => definition.id === "soft-rain-veil"));
  for (const fileName of FEEDBACK_FILE_NAMES) {
    const spec = FEEDBACK_SPECS[fileName];
    ordered.push({
      id: spec.id,
      fileName,
      category: "feedback",
      role: feedbackRole(fileName),
      durationSeconds: spec.durationSeconds,
      looped: false,
      sourceType: "first-party-deterministic-procedural-synthesis",
      sourceKey: null,
    });
  }
  if (
    ordered.length !== 26 ||
    ordered.some((definition, index) => definition?.fileName !== EXPECTED_FILE_NAMES[index])
  ) {
    fail("asset definitions violate the exact 26-file inventory");
  }
  return ordered;
}

function familyDefinition(family, level, sourceKey, sourceStartSeconds, filters) {
  const target = LEVEL_TARGETS[level];
  return {
    id: `${family}:${level}`,
    fileName: `hyperfocus-${family}-${level}.mp3`,
    category: "hyperfocus",
    role: `${family} focus bed — ${level}`,
    family,
    level,
    durationSeconds: 30,
    overlapSeconds: 1,
    looped: true,
    sourceType: "CC0-derived-field-recording",
    sourceKey,
    sourceStartSeconds,
    filters,
    targetLoudnessLufs: target.loudnessLufs,
    truePeakDbfs: target.truePeakDbfs,
  };
}

function sourceAmbienceDefinition({
  id,
  fileName,
  role,
  sourceKey,
  sourceStartSeconds,
  durationSeconds,
  targetLoudnessLufs,
  truePeakDbfs,
  filters,
}) {
  return {
    id,
    fileName,
    category: "ambience",
    role,
    family: null,
    level: null,
    durationSeconds,
    overlapSeconds: 2,
    looped: true,
    sourceType: "CC0-derived-field-recording",
    sourceKey,
    sourceStartSeconds,
    filters,
    targetLoudnessLufs,
    truePeakDbfs,
  };
}

function feedbackRole(fileName) {
  return {
    "feedback-success.mp3": "Quiet saved-action confirmation",
    "feedback-complete.mp3": "Completed-activity confirmation",
    "feedback-streak.mp3": "Occasional streak milestone cue",
    "feedback-milestone.mp3": "Rare milestone cue",
    "feedback-notification.mp3": "Opt-in reminder preview",
  }[fileName];
}

export const ASSET_DEFINITIONS = Object.freeze(makeDefinitions());

export function outputRelativePath(definition) {
  if (definition.category === "hyperfocus") {
    return path.join("audio", "hyperfocus", definition.fileName);
  }
  return path.join("audio", definition.category, definition.fileName);
}
