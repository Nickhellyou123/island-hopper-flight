// The world: a golden-hour tropical archipelago with a runway island, a ring
// course, beaches, mountains, a harbour town and a lagoon. All heights come
// from one seeded function so the terrain, the physics and the screenshots
// always agree.
import { makeNoise2D, mulberry32, smoothstep, clamp } from './random.js';

export const WORLD_SEED = 20261126;
export const SEA_LEVEL = 0;
export const RUNWAY = {
  // Flat strip on the main island, east-west, 600 m long, 40 m wide.
  x: -350, z: 150, heading: Math.PI / 2, length: 600, width: 40, height: 6,
};
export const RING_COUNT = 8;
export const RING_RADIUS = 18;

// Islands: centre, radius, peak height. The main island holds the runway.
export const ISLANDS = [
  { x: -400, z: -200, r: 950, peak: 150 },
  { x: 850, z: 650, r: 520, peak: 85 },
  { x: 1250, z: -850, r: 320, peak: 55 },
  { x: -1250, z: 950, r: 380, peak: 48 },
  { x: 250, z: -1250, r: 260, peak: 38 },
];

const noise = makeNoise2D(WORLD_SEED);

/** Island profile: 1 at the centre, 0 past the shore, with a beach shelf. */
function islandProfile(island, x, z) {
  const dx = x - island.x, dz = z - island.z;
  const d = Math.sqrt(dx * dx + dz * dz) / island.r;
  if (d >= 1) return 0;
  // Ridged noise makes the mountain crests; the falloff keeps a flat beach.
  const n = noise.fbm(x * 0.0016 + 7.3, z * 0.0016 + 2.9, 3);
  const ridge = 0.55 + 0.45 * Math.abs(n);
  const shape = Math.pow(1 - d * d, 1.35);
  const beach = smoothstep(0.86, 0.97, d);
  return shape * ridge * (1 - beach * 0.92);
}

/** Terrain height in metres at world (x, z). */
export function heightAt(x, z) {
  let h = -8; // sea floor, so the sea plane never z-fights the terrain
  for (const island of ISLANDS) {
    const p = islandProfile(island, x, z);
    if (p > 0) h = Math.max(h, p * island.peak + 2.5);
  }
  // Flatten the runway strip and its apron so takeoffs and landings are fair.
  const rx = x - RUNWAY.x, rz = z - RUNWAY.z;
  const along = Math.abs(rx); // runway runs east-west
  const across = Math.abs(rz);
  const runwayMask = smoothstep(RUNWAY.length / 2 + 90, RUNWAY.length / 2 - 20, along)
    * smoothstep(RUNWAY.width / 2 + 60, RUNWAY.width / 2 + 5, across);
  return h * (1 - runwayMask) + RUNWAY.height * runwayMask;
}

/** True when (x, z) is dry land above the waterline. */
export function isLand(x, z) { return heightAt(x, z) > 0.5; }

/** True when the point is on the runway strip (for landing checks). */
export function onRunway(x, z) {
  const rx = Math.abs(x - RUNWAY.x), rz = Math.abs(z - RUNWAY.z);
  return rx < RUNWAY.length / 2 && rz < RUNWAY.width / 2;
}

/** The ring course: a loop around the islands, each ring high enough to fly. */
export function ringCourse() {
  const spots = [
    { x: 150, z: 150, y: 95 },
    { x: 700, z: -250, y: 110 },
    { x: 1050, z: -750, y: 85 },
    { x: 350, z: -1100, y: 120 },
    { x: -550, z: -950, y: 130 },
    { x: -1150, z: -350, y: 100 },
    { x: -1250, z: 700, y: 80 },
    { x: -700, z: 850, y: 90 },
  ];
  // Aim each ring at the next one so the course reads as a flown line.
  return spots.map((s, i) => {
    const next = spots[(i + 1) % spots.length];
    const dx = next.x - s.x, dz = next.z - s.z;
    return { ...s, heading: Math.atan2(dx, dz), radius: RING_RADIUS };
  });
}

/** Seeded scatter points for trees: land, gentle slope, away from the runway. */
export function treeSpots(count) {
  const rand = mulberry32(WORLD_SEED ^ 0x5eed);
  const spots = [];
  let guard = 0;
  while (spots.length < count && guard < count * 40) {
    guard += 1;
    const x = (rand() * 2 - 1) * 2200;
    const z = (rand() * 2 - 1) * 2200;
    const h = heightAt(x, z);
    if (h < 7 || h > 70) continue;
    if (onRunway(x, z)) continue;
    if (Math.abs(x - RUNWAY.x) < RUNWAY.length && Math.abs(z - RUNWAY.z) < 120) continue;
    const slope = Math.abs(heightAt(x + 6, z) - h) + Math.abs(heightAt(x, z + 6) - h);
    if (slope > 2.2) continue;
    spots.push({ x, z, y: h, s: 0.7 + rand() * 0.9, rot: rand() * Math.PI * 2 });
  }
  return spots;
}

/** Harbour town houses near the runway, on the flat ground by the shore. */
export function townSpots() {
  const rand = mulberry32(WORLD_SEED ^ 0x70aa);
  const spots = [];
  for (let i = 0; i < 14; i += 1) {
    const x = RUNWAY.x - 260 + rand() * 420;
    const z = RUNWAY.z + 130 + rand() * 180;
    const h = heightAt(x, z);
    if (h < 5 || h > 14) continue;
    spots.push({ x, z, y: h, w: 14 + rand() * 12, d: 12 + rand() * 10, hgt: 8 + rand() * 7, rot: rand() * Math.PI, hue: rand() });
  }
  return spots;
}

export { clamp };
