// Deterministic DEMO data for Greenhouse #003. Not connected to any sensors.
export type ZoneId = "propagation" | "fruiting" | "herb" | "nursery";
export type Health = "thriving" | "watch" | "stressed";
export type Stage = "Seedling" | "Vegetative" | "Flowering" | "Fruiting" | "Hardening off";

export interface Zone { id: ZoneId; name: string; short: string; targetTemp: [number, number]; targetHumidity: [number, number]; }
export interface Observation { date: string; note: string; }
export interface PlantBatch {
  id: string; code: string; species: string; variety: string; zone: ZoneId; stage: Stage;
  count: number; sownOn: string; health: Health; issue?: string; careAction?: string;
  heights: number[]; // daily mean height cm, index 0 = 90 days ago, last = today
  observations: Observation[];
}
export interface EnvReading { date: string; zone: ZoneId; temp: number; humidity: number; light: number; }

export const DAYS = 91;
export const TODAY = new Date(2025, 4, 30); // fixed demo anchor: 30 May 2025

export const ZONES: Zone[] = [
  { id: "propagation", name: "Propagation House", short: "Prop", targetTemp: [20, 24], targetHumidity: [70, 85] },
  { id: "fruiting", name: "Fruiting Glasshouse", short: "Fruit", targetTemp: [18, 26], targetHumidity: [60, 75] },
  { id: "herb", name: "Herb Tunnel", short: "Herb", targetTemp: [16, 24], targetHumidity: [50, 65] },
  { id: "nursery", name: "Ornamental Nursery", short: "Nursery", targetTemp: [15, 22], targetHumidity: [55, 70] },
];
export const zoneName = (z: ZoneId) => ZONES.find((x) => x.id === z)!.name;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export function dateAt(i: number): Date {
  const d = new Date(TODAY); d.setDate(d.getDate() - (DAYS - 1 - i)); return d;
}
export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseLocal(s: string) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }

type Def = [string, string, ZoneId, Stage, number, number, number, number, Health, string?, string?];
// species, variety, zone, stage, count, startCm, cm/day, sownDaysAgo, health, issue, care
const DEFS: Def[] = [
  ["Tomato", "San Marzano Redorta", "fruiting", "Fruiting", 64, 38, 1.05, 118, "thriving"],
  ["Tomato", "Sungold F1", "fruiting", "Flowering", 48, 30, 1.18, 104, "watch", "Blossom drop on lower trusses", "Raise night vent threshold, hand-pollinate trusses 3–5"],
  ["Tomato", "Black Krim", "fruiting", "Vegetative", 36, 12, 0.92, 74, "thriving"],
  ["Cucumber", "Socrates F1", "fruiting", "Fruiting", 40, 44, 1.32, 96, "stressed", "Powdery mildew on 6 leaves", "Remove affected leaves, apply potassium bicarbonate spray"],
  ["Cucumber", "Marketmore 76", "fruiting", "Flowering", 32, 26, 1.24, 82, "thriving"],
  ["Pepper", "Padrón", "fruiting", "Flowering", 56, 14, 0.46, 112, "thriving"],
  ["Pepper", "Hungarian Hot Wax", "fruiting", "Vegetative", 42, 9, 0.41, 98, "watch", "Interveinal yellowing, likely Mg", "Foliar Epsom salt feed at 2%"],
  ["Basil", "Genovese", "herb", "Vegetative", 180, 4, 0.36, 61, "thriving"],
  ["Basil", "Thai Siam Queen", "herb", "Vegetative", 120, 3, 0.31, 55, "watch", "Fusarium wilt suspected on 4 plants", "Isolate tray B3 and send sample for testing"],
  ["Coriander", "Calypso", "herb", "Vegetative", 150, 2, 0.22, 42, "thriving"],
  ["Parsley", "Gigante d'Italia", "herb", "Vegetative", 96, 6, 0.19, 88, "thriving"],
  ["Thyme", "Common English", "herb", "Hardening off", 84, 5, 0.08, 130, "thriving"],
  ["Lettuce", "Little Gem", "propagation", "Seedling", 288, 0.5, 0.17, 33, "thriving"],
  ["Lettuce", "Lollo Rosso", "propagation", "Seedling", 216, 0.4, 0.15, 29, "stressed", "Damping off in 2 modules", "Reduce misting cycle, improve airflow over bench 2"],
  ["Kale", "Cavolo Nero", "propagation", "Vegetative", 144, 2, 0.28, 52, "thriving"],
  ["Tomato", "Gardener's Delight (sowing 2)", "propagation", "Seedling", 96, 0.6, 0.21, 26, "watch", "Leggy stems under low light", "Lower LED bar to 30 cm above canopy"],
  ["Chilli", "Aji Limo", "propagation", "Seedling", 72, 0.8, 0.12, 38, "thriving"],
  ["Pelargonium", "Attar of Roses", "nursery", "Vegetative", 60, 8, 0.14, 140, "thriving"],
  ["Salvia", "Amistad", "nursery", "Flowering", 54, 22, 0.42, 126, "thriving"],
  ["Dahlia", "Café au Lait", "nursery", "Vegetative", 38, 6, 0.58, 64, "watch", "Aphid colonies on growing tips", "Release Aphidius colemani, check sticky traps"],
  ["Fuchsia", "Hawkshead", "nursery", "Flowering", 44, 18, 0.21, 150, "thriving"],
  ["Lavender", "Hidcote", "nursery", "Hardening off", 110, 12, 0.11, 170, "thriving"],
  ["Sweet Pea", "Matucana", "nursery", "Flowering", 70, 40, 0.86, 120, "stressed", "Botrytis on stems after humid nights", "Open roof vents at dusk, remove infected stems"],
  ["Rosemary", "Miss Jessopp's Upright", "herb", "Hardening off", 66, 18, 0.07, 190, "thriving"],
];

const NOTES = ["Even canopy, good colour", "Fed at EC 2.1", "Trusses tied in", "Spaced pots", "Root check: white, vigorous", "Light pinch to encourage branching", "Irrigation run checked", "Pest scout: clear"];

export const PLANTS: PlantBatch[] = DEFS.map((d, idx) => {
  const [species, variety, zone, stage, count, startCm, rate, sown, health, issue, care] = d;
  const r = rng(idx * 97 + 13);
  const heights: number[] = [];
  const lag = Math.max(0, DAYS - sown);
  let h = startCm;
  for (let i = 0; i < DAYS; i++) {
    if (i < lag) { heights.push(0); continue; }
    const age = i - lag;
    const ramp = Math.min(1, (age + 5) / 30);
    const penalty = health === "stressed" && i > DAYS - 18 ? 0.45 : health === "watch" && i > DAYS - 12 ? 0.7 : 1;
    h += rate * ramp * penalty * (0.75 + r() * 0.5);
    heights.push(Math.round(h * 10) / 10);
  }
  const observations: Observation[] = [];
  for (let i = DAYS - 1; i >= lag; i -= 9 + Math.floor(r() * 5)) {
    observations.push({ date: iso(dateAt(i)), note: i === DAYS - 1 && issue ? issue : NOTES[Math.floor(r() * NOTES.length)] });
  }
  const code = `${zone.slice(0, 2).toUpperCase()}-${String(idx + 101)}`;
  const sownDate = new Date(TODAY); sownDate.setDate(sownDate.getDate() - sown);
  return { id: `b${idx + 1}`, code, species, variety, zone, stage, count, sownOn: iso(sownDate), health, issue, careAction: care, heights, observations };
});

const ENV_BASE: Record<ZoneId, [number, number, number]> = { propagation: [22.1, 78, 14.2], fruiting: [22.6, 68, 22.8], herb: [19.4, 58, 18.1], nursery: [18.2, 64, 16.4] };
export const ENV: EnvReading[] = ZONES.flatMap((z, zi) => {
  const r = rng(zi * 31 + 7);
  const [t, hu, l] = ENV_BASE[z.id];
  return Array.from({ length: DAYS }, (_, i) => {
    const season = (i / DAYS) * 2.4;
    const spike = z.id === "nursery" && i > DAYS - 6 ? 9 : z.id === "fruiting" && i > DAYS - 4 ? 3.2 : 0;
    return {
      date: iso(dateAt(i)), zone: z.id,
      temp: Math.round((t + season + (r() - 0.5) * 2.6 + (z.id === "fruiting" ? spike : 0)) * 10) / 10,
      humidity: Math.round(hu + (r() - 0.5) * 8 + (z.id === "nursery" ? spike : 0)),
      light: Math.round((l + season * 1.4 + (r() - 0.5) * 4) * 10) / 10,
    };
  });
});

export interface Dataset { plants: PlantBatch[]; env: EnvReading[]; zones: Zone[]; }
export async function loadDataset(): Promise<Dataset> {
  await new Promise((res) => setTimeout(res, 380));
  return { plants: PLANTS, env: ENV, zones: ZONES };
}
