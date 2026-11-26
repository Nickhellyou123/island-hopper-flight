// Rendering: the golden-hour archipelago in Three.js — gradient sky dome with a
// low sun, a shining lagoon, a heightfield island chain with beaches and
// mountains, a lit runway, pine trees, a harbour town, drifting clouds and
// glowing golden rings. Plus the chase and cockpit cameras and the DOM HUD.
import * as THREE from 'three';
import { heightAt, treeSpots, townSpots, RUNWAY, WORLD_SEED } from './world.js';
import { buildAircraft } from './aircraft.js';
import { buildDashboard } from './cockpit.js';
import { mulberry32, clamp, lerp, makeNoise2D } from './random.js';

const FOG_COLOR = 0xf2a35e;

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1b3768'); // deep indigo zenith
  grad.addColorStop(0.28, '#5a5f9e');
  grad.addColorStop(0.46, '#a86a9d'); // magenta dusk band
  grad.addColorStop(0.58, '#ff8a5e');
  grad.addColorStop(0.72, '#ffc27a');
  grad.addColorStop(0.86, '#ffe0a8');
  grad.addColorStop(1, '#fff0c8');
  g.fillStyle = grad; g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const blob = (x, y, r, a) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255, 235, 220, ${a})`);
    grad.addColorStop(1, 'rgba(255, 235, 220, 0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  blob(70, 80, 55, 0.9); blob(120, 65, 65, 0.9); blob(180, 82, 50, 0.85);
  blob(100, 90, 60, 0.7); blob(150, 92, 55, 0.7);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSunTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 246, 220, 1)');
  grad.addColorStop(0.25, 'rgba(255, 214, 140, 0.9)');
  grad.addColorStop(0.6, 'rgba(255, 150, 70, 0.35)');
  grad.addColorStop(1, 'rgba(255, 150, 70, 0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Terrain colour by height: sand, grass, forest green, rock, pale peak. */
function terrainColor(h, slope) {
  if (h < 3.5) return new THREE.Color(0xe8d29a); // beach sand
  if (h < 10) return new THREE.Color(0x9dbb5e); // low grass
  if (h < 45) return slope > 0.35 ? new THREE.Color(0x6d8a4a) : new THREE.Color(0x5d8a3e);
  if (h < 90) return new THREE.Color(0x7d8a52); // olive hillside, still vegetated
  if (h < 120) return new THREE.Color(0x8a7a5e); // rock
  return new THREE.Color(0xd8cfc0); // pale peak
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 1300, 6500);

  // Sky dome: a huge sphere with the gradient painted on its inside.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(9000, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  // Low sun, west-southwest, as a glowing sprite far away.
  const sunDir = new THREE.Vector3(-0.75, 0.16, -0.35).normalize();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSunTexture(), transparent: true, fog: false, depthWrite: false,
  }));
  sun.scale.set(1900, 1900, 1);
  sun.position.copy(sunDir).multiplyScalar(8200);
  scene.add(sun);

  // Crisp sun disc inside the glow, so the sun reads as a real low sun.
  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSunTexture(), transparent: true, fog: false, depthWrite: false, opacity: 0.95,
  }));
  sunCore.scale.set(520, 520, 1);
  sunCore.position.copy(sunDir).multiplyScalar(8100);
  scene.add(sunCore);

  // Light: warm low sun + cool sky fill.
  const sunLight = new THREE.DirectionalLight(0xffb36b, 2.4);
  sunLight.position.copy(sunDir).multiplyScalar(1000);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x2a4a5a, 0.85));

  // Sea: a wide shining plane at y = 0 — warmer tropical teal so it reads
  // as sunlit water, not a dark void, from the chase view. The low sun
  // barely lights a flat plane, so a small emissive lift keeps the base
  // colour readable instead of near-black.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(14000, 14000),
    new THREE.MeshPhongMaterial({
      color: 0x2e8cae, shininess: 200, specular: 0xffd9a0, emissive: 0x0e3d52,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);

  // Sun glitter on the water: small bright discs scattered over the lagoon,
  // seeded so the pattern is identical every run.
  const glitterGeo = new THREE.CircleGeometry(1, 6);
  const glitterMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glitterRand = mulberry32(0x61a7);
  const glitter = new THREE.InstancedMesh(glitterGeo, glitterMat, 500);
  {
    const m = new THREE.Matrix4();
    const q0 = new THREE.Quaternion();
    const e0 = new THREE.Euler(-Math.PI / 2, 0, 0);
    for (let i = 0; i < 500; i += 1) {
      const gx = (glitterRand() * 2 - 1) * 1600;
      const gz = (glitterRand() * 2 - 1) * 1600;
      const gs = 2 + glitterRand() * 4;
      e0.set(-Math.PI / 2, 0, glitterRand() * Math.PI * 2);
      q0.setFromEuler(e0);
      m.compose(new THREE.Vector3(gx, 0.4, gz), q0, new THREE.Vector3(gs, gs, 1));
      glitter.setMatrixAt(i, m);
    }
  }
  scene.add(glitter);

  // Terrain: 200x200 heightfield with vertex colours.
  const terrainGeo = new THREE.PlaneGeometry(5200, 5200, 200, 200);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  const patchCol = new THREE.Color(0xc9b26a); // dry grass clearing
  const colorNoise = makeNoise2D(WORLD_SEED ^ 0xc010);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const slope = Math.abs(heightAt(x + 8, z) - h) / 8 + Math.abs(heightAt(x, z + 8) - h) / 8;
    col.copy(terrainColor(h, slope));
    // Patchiness: dark forest clumps and dry-grass clearings so the ground
    // does not read as flat colour. Purely visual — heights are untouched.
    if (h > 3.5 && h < 90) {
      const p = colorNoise.fbm(x * 0.004 + 31.7, z * 0.004 + 17.3, 2);
      if (p > 0.22) col.multiplyScalar(0.62); // forest shadow clump
      else if (p < -0.28) col.lerp(patchCol, 0.55); // dry clearing
    }
    // Slight variation so the ground does not read as flat colour.
    const v = 0.94 + 0.06 * Math.sin(x * 0.021 + z * 0.017);
    colors[i * 3] = col.r * v; colors[i * 3 + 1] = col.g * v; colors[i * 3 + 2] = col.b * v;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  scene.add(terrain);

  // Runway: dark strip with white dashes, threshold bars and edge lights.
  const runwayGroup = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.length, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: 0x2b2f36 }),
  );
  strip.rotation.x = -Math.PI / 2; // flat: 600 m east-west, 40 m north-south
  strip.position.set(RUNWAY.x, RUNWAY.height + 0.3, RUNWAY.z);
  runwayGroup.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
  for (let d = -RUNWAY.length / 2 + 40; d < RUNWAY.length / 2 - 20; d += 60) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(30, 2.2), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(RUNWAY.x + d, RUNWAY.height + 0.45, RUNWAY.z);
    runwayGroup.add(dash);
  }
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  for (let d = -RUNWAY.length / 2; d <= RUNWAY.length / 2; d += 50) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 6), edgeMat);
      lamp.position.set(RUNWAY.x + d, RUNWAY.height + 0.6, RUNWAY.z + side * (RUNWAY.width / 2 - 1));
      runwayGroup.add(lamp);
    }
  }
  // Windsock and a small hangar beside the strip.
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  sockPole.position.set(RUNWAY.x + 120, RUNWAY.height + 6, RUNWAY.z + 60);
  runwayGroup.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 10),
    new THREE.MeshLambertMaterial({ color: 0xff7a3c }),
  );
  sock.rotation.z = Math.PI / 2 - 0.5;
  sock.position.set(RUNWAY.x + 123, RUNWAY.height + 11, RUNWAY.z + 60);
  runwayGroup.add(sock);
  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(36, 14, 26),
    new THREE.MeshLambertMaterial({ color: 0x8a97a5 }),
  );
  hangar.position.set(RUNWAY.x - 180, RUNWAY.height + 7, RUNWAY.z + 80);
  runwayGroup.add(hangar);
  const hangarRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 13, 36, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0xe8641c }),
  );
  hangarRoof.rotation.z = Math.PI / 2;
  hangarRoof.rotation.y = Math.PI / 2;
  hangarRoof.position.set(RUNWAY.x - 180, RUNWAY.height + 14, RUNWAY.z + 80);
  runwayGroup.add(hangarRoof);
  scene.add(runwayGroup);

  // Trees: instanced pines scattered on the islands — denser now, with three
  // crown greens so the forest reads as varied, not one flat colour.
  const treeSpotsList = treeSpots(650);
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 6);
  const crownGeo = new THREE.ConeGeometry(3.2, 11, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2f });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpotsList.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeSpotsList.length);
  const crownGreens = [new THREE.Color(0x2f6b2a), new THREE.Color(0x3a7d33), new THREE.Color(0x256024)];
  const crownRand = mulberry32(WORLD_SEED ^ 0x7e55);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  treeSpotsList.forEach((t, i) => {
    eu.set(0, t.rot, 0); q.setFromEuler(eu);
    m4.compose(new THREE.Vector3(t.x, t.y + 2 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(t.x, t.y + (4 + 5.5) * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, crownGreens[Math.floor(crownRand() * crownGreens.length)]);
  });
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  scene.add(trunks, crowns);

  // Palms on the beaches: taller thin trunks with wide flat crowns.
  const palmRand = mulberry32(WORLD_SEED ^ 0x9a1);
  const palmSpots = [];
  {
    let guard = 0;
    while (palmSpots.length < 90 && guard < 4000) {
      guard += 1;
      const x = (palmRand() * 2 - 1) * 2200;
      const z = (palmRand() * 2 - 1) * 2200;
      const h = heightAt(x, z);
      if (h < 3.5 || h > 10) continue;
      if (Math.abs(x - RUNWAY.x) < RUNWAY.length && Math.abs(z - RUNWAY.z) < 140) continue;
      palmSpots.push({ x, z, y: h, s: 0.8 + palmRand() * 0.6, rot: palmRand() * Math.PI * 2 });
    }
  }
  const palmTrunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 9, 6);
  const palmCrownGeo = new THREE.SphereGeometry(4.4, 8, 6);
  const palmTrunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const palmCrownMat = new THREE.MeshLambertMaterial({ color: 0x4f9440 });
  const palmTrunks = new THREE.InstancedMesh(palmTrunkGeo, palmTrunkMat, palmSpots.length);
  const palmCrowns = new THREE.InstancedMesh(palmCrownGeo, palmCrownMat, palmSpots.length);
  palmSpots.forEach((t, i) => {
    eu.set(0, t.rot, 0); q.setFromEuler(eu);
    m4.compose(new THREE.Vector3(t.x, t.y + 4.5 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    palmTrunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(t.x, t.y + 9.5 * t.s, t.z), q, new THREE.Vector3(t.s, 0.45 * t.s, t.s));
    palmCrowns.setMatrixAt(i, m4);
  });
  scene.add(palmTrunks, palmCrowns);

  // Runway-verge trees: pines on the lower slopes flanking the strip, so the
  // hills in the cockpit/takeoff frames are not bare. Visual only — trees
  // have no collision and the strip itself stays clear.
  const vergeRand = mulberry32(WORLD_SEED ^ 0xbe96);
  const vergeSpots = [];
  {
    let guard = 0;
    while (vergeSpots.length < 220 && guard < 6000) {
      guard += 1;
      const x = RUNWAY.x + (vergeRand() * 2 - 1) * (RUNWAY.length / 2 + 60);
      const side = vergeRand() < 0.5 ? -1 : 1;
      const z = RUNWAY.z + side * (48 + vergeRand() * 172);
      const h = heightAt(x, z);
      if (h < 6 || h > 75) continue;
      const slope = Math.abs(heightAt(x + 6, z) - h) + Math.abs(heightAt(x, z + 6) - h);
      if (slope > 2.6) continue;
      vergeSpots.push({ x, z, y: h, s: 0.8 + vergeRand() * 0.9, rot: vergeRand() * Math.PI * 2 });
    }
  }
  const vergeTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, vergeSpots.length);
  const vergeCrowns = new THREE.InstancedMesh(crownGeo, crownMat, vergeSpots.length);
  vergeSpots.forEach((t, i) => {
    eu.set(0, t.rot, 0); q.setFromEuler(eu);
    m4.compose(new THREE.Vector3(t.x, t.y + 2 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    vergeTrunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(t.x, t.y + (4 + 5.5) * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    vergeCrowns.setMatrixAt(i, m4);
    vergeCrowns.setColorAt(i, crownGreens[Math.floor(crownRand() * crownGreens.length)]);
  });
  if (vergeCrowns.instanceColor) vergeCrowns.instanceColor.needsUpdate = true;
  scene.add(vergeTrunks, vergeCrowns);

  // Harbour town: small coloured houses with pyramid roofs.
  const townGroup = new THREE.Group();
  const houseColors = [0xe8e0c8, 0xd96a4a, 0x5a8ab0, 0xe8b13c, 0x9a7ab0];
  for (const h of townSpots()) {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(h.w, h.hgt, h.d),
      new THREE.MeshLambertMaterial({ color: houseColors[Math.floor(h.hue * houseColors.length)] }),
    );
    body.position.set(h.x, h.y + h.hgt / 2, h.z);
    body.rotation.y = h.rot;
    townGroup.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(h.w, h.d) * 0.72, 5, 4),
      new THREE.MeshLambertMaterial({ color: 0x8a4a2f }),
    );
    roof.position.set(h.x, h.y + h.hgt + 2.5, h.z);
    roof.rotation.y = h.rot + Math.PI / 4;
    townGroup.add(roof);
  }
  scene.add(townGroup);

  // Volcano island: a dark cone on the eastern island's peak (1250, -850),
  // dead ahead in the chase shot, with a lava glow and a rising smoke plume.
  // Visual only — the terrain height function is untouched.
  const VOLCANO = { x: 1250, z: -850, apexY: 78 };
  const volcanoGroup = new THREE.Group();
  const volcanoCone = new THREE.Mesh(
    new THREE.ConeGeometry(150, 58, 24, 1),
    new THREE.MeshLambertMaterial({ color: 0x4a382e }),
  );
  volcanoCone.position.set(VOLCANO.x, 20 + 29, VOLCANO.z);
  volcanoGroup.add(volcanoCone);
  const crater = new THREE.Mesh(
    new THREE.CircleGeometry(16, 16),
    new THREE.MeshBasicMaterial({ color: 0x2a1a12 }),
  );
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(VOLCANO.x, VOLCANO.apexY - 0.5, VOLCANO.z);
  volcanoGroup.add(crater);
  const lavaGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSunTexture(), transparent: true, opacity: 0.65,
    color: 0xff6a22, depthWrite: false,
  }));
  lavaGlow.scale.set(70, 70, 1);
  lavaGlow.position.set(VOLCANO.x, VOLCANO.apexY + 2, VOLCANO.z);
  volcanoGroup.add(lavaGlow);
  scene.add(volcanoGroup);
  // Smoke puffs: positions are a pure function of game time, so the frozen
  // screenshot frame is deterministic and the plume still rises in play.
  const smokePuffs = [];
  const smokeTex = makeCloudTexture();
  for (let i = 0; i < 7; i += 1) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, transparent: true, opacity: 0.5, depthWrite: false,
      color: 0x8f8f96,
    }));
    sp.position.set(VOLCANO.x, VOLCANO.apexY + 10 + i * 8, VOLCANO.z);
    sp.scale.set(30, 18, 1);
    smokePuffs.push(sp);
    scene.add(sp);
  }

  // Boats on the lagoon: hull, mast and a triangular sail, moored in the
  // shot sight-lines (chase course, ring lagoon, east of the runway island).
  function buildBoat(x, z, rot) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(9, 2, 3.2),
      new THREE.MeshLambertMaterial({ color: 0xf2ede2 }),
    );
    hull.position.y = 0.8;
    boat.add(hull);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(9.1, 0.5, 3.3),
      new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
    );
    stripe.position.y = 1.6;
    boat.add(stripe);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0x6a4a2f }),
    );
    mast.position.y = 6;
    boat.add(mast);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0); sailShape.lineTo(0, 7.5); sailShape.lineTo(4.6, 0.6); sailShape.lineTo(0, 0);
    const sail = new THREE.Mesh(
      new THREE.ShapeGeometry(sailShape),
      new THREE.MeshLambertMaterial({ color: 0xfff6e0, side: THREE.DoubleSide }),
    );
    sail.position.set(0.2, 2.2, 0);
    boat.add(sail);
    boat.position.set(x, 0, z);
    boat.rotation.y = rot;
    return boat;
  }
  scene.add(buildBoat(800, -700, 0.6));
  scene.add(buildBoat(1000, -1100, 2.4));
  scene.add(buildBoat(0, -900, 1.2));
  scene.add(buildBoat(600, 400, 2.9));

  // Lighthouse on the volcano island's north shore, in the chase frame.
  const LIGHTHOUSE = { x: 1150, z: -580 };
  const lighthouseBaseY = heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z);
  const lighthouse = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 4.4, 24, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }),
  );
  tower.position.y = 12;
  lighthouse.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(3.9, 4.1, 3.6, 12),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  band.position.y = 15;
  lighthouse.add(band);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 3.6, 10),
    new THREE.MeshLambertMaterial({ color: 0x222831 }),
  );
  lampRoom.position.y = 25.5;
  lighthouse.add(lampRoom);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.y = 25.5;
  lighthouse.add(lamp);
  const lampRoof = new THREE.Mesh(
    new THREE.ConeGeometry(3, 2.6, 10),
    new THREE.MeshLambertMaterial({ color: 0x8a2f24 }),
  );
  lampRoof.position.y = 28.5;
  lighthouse.add(lampRoof);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSunTexture(), transparent: true, opacity: 0.55, depthWrite: false,
  }));
  lampGlow.scale.set(46, 46, 1);
  lampGlow.position.y = 25.5;
  lighthouse.add(lampGlow);
  lighthouse.position.set(LIGHTHOUSE.x, lighthouseBaseY, LIGHTHOUSE.z);
  scene.add(lighthouse);

  // Seaplane dock on the volcano island's west shore, in the chase frame:
  // wooden planks on posts, with a small floatplane moored alongside.
  const dock = new THREE.Group();
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  for (let i = 0; i < 5; i += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 1.3), plankMat);
    plank.position.set(0, 1.1, (i - 2) * 1.4);
    dock.add(plank);
  }
  const postMat = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
  for (const px of [-6, 6]) {
    for (const pz of [-2.8, 2.8]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3, 6), postMat);
      post.position.set(px, 0, pz);
      dock.add(post);
    }
  }
  dock.position.set(948, 0, -800);
  scene.add(dock);
  const floatplane = new THREE.Group();
  const fpBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 0.9, 7, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }),
  );
  fpBody.rotation.z = Math.PI / 2;
  fpBody.position.y = 2.2;
  floatplane.add(fpBody);
  const fpWing = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.18, 9.5),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  fpWing.position.y = 3.1;
  floatplane.add(fpWing);
  const fpTail = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.16, 3.4),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  fpTail.position.set(-3.4, 2.6, 0);
  floatplane.add(fpTail);
  for (const fz of [-1.4, 1.4]) {
    const float = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.6, 0.8),
      new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
    );
    float.position.set(0.4, 0.6, fz);
    floatplane.add(float);
  }
  floatplane.position.set(930, 0, -792);
  floatplane.rotation.y = 0.35;
  scene.add(floatplane);

  // Clouds: soft billboards drifting slowly — more of them, in two tints
  // (cool white high up, warm gold near the sun) so the sky has depth.
  const cloudTex = makeCloudTexture();
  const cloudRand = mulberry32(99);
  const clouds = [];
  const cloudTints = [0xffffff, 0xffe0c0, 0xffc9a0];
  for (let i = 0; i < 64; i += 1) {
    const tint = cloudTints[Math.floor(cloudRand() * cloudTints.length)];
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.6 + cloudRand() * 0.35,
      depthWrite: false, color: tint,
    }));
    const a = cloudRand() * Math.PI * 2;
    const r = 400 + cloudRand() * 2200;
    s.position.set(Math.cos(a) * r, 200 + cloudRand() * 160, Math.sin(a) * r);
    const sc = 180 + cloudRand() * 320;
    s.scale.set(sc, sc * 0.45, 1);
    s.userData.drift = 1.5 + cloudRand() * 2;
    clouds.push(s);
    scene.add(s);
  }

  // Rings: golden toruses on the course, each with a faint beacon column.
  const ringGroup = new THREE.Group();
  const ringMeshes = [];
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  const ringMatDim = new THREE.MeshBasicMaterial({ color: 0xb98a2e, transparent: true, opacity: 0.55 });
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd23e, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide,
  });
  scene.add(ringGroup);

  // The aircraft and its dashboard.
  const aircraft = buildAircraft();
  scene.add(aircraft.group);
  const dashboard = buildDashboard();
  const dashHolder = new THREE.Group();
  dashHolder.add(dashboard.mesh);
  scene.add(dashHolder);

  // Cameras.
  const camera = new THREE.PerspectiveCamera(62, 1280 / 480, 0.5, 20000);
  scene.add(camera); // the cockpit dashboard rides on the camera, so it must be in the scene
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const planeForward = new THREE.Vector3();

  // HUD elements.
  const el = (id) => document.getElementById(id);
  const hud = {
    alt: el('hud-alt'), spd: el('hud-spd'), hdg: el('hud-hdg'), vsi: el('hud-vsi'),
    score: el('hud-score'), rings: el('hud-rings'), time: el('hud-time'), lives: el('hud-lives'),
    thrPct: el('hud-thr-pct'), thrFill: el('throttle-fill'), gear: el('hud-gear'),
    banner: el('banner'),
    compass: el('compass-canvas').getContext('2d'),
    attitude: el('attitude-canvas').getContext('2d'),
    overlay: el('overlay'), overlayCard: el('overlay-card'),
  };

  function buildRings(rings) {
    ringGroup.clear();
    ringMeshes.length = 0;
    rings.forEach((r, i) => {
      const torus = new THREE.Mesh(new THREE.TorusGeometry(r.radius, 1.4, 12, 40), i === 0 ? ringMat : ringMatDim);
      torus.position.set(r.x, r.y, r.z);
      torus.rotation.y = r.heading;
      torus.userData.index = i;
      ringGroup.add(torus);
      ringMeshes.push(torus);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 260, 8, 1, true), beaconMat);
      beacon.position.set(r.x, r.y + 120, r.z);
      ringGroup.add(beacon);
    });
  }

  /** Snap the chase camera behind the plane at once (screenshot mode). */
  function snapCamera(s) {
    planeForward.set(Math.sin(s.heading), 0, Math.cos(s.heading));
    const back = (s.camBack ?? 16) + s.speed * 0.08;
    const up = (s.camUp ?? 5.5) + s.speed * 0.02;
    camPos.set(
      s.pos.x - planeForward.x * back,
      s.pos.y + up,
      s.pos.z - planeForward.z * back,
    );
    camLook.set(
      s.pos.x + planeForward.x * 14,
      s.pos.y + Math.sin(s.pitch) * 10 + 1,
      s.pos.z + planeForward.z * 14,
    );
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /** Place the plane mesh from the flight state. */
  function placePlane(s) {
    aircraft.group.visible = s.cameraMode !== 'cockpit';
    aircraft.group.position.copy(s.pos);
    aircraft.group.rotation.set(0, 0, 0);
    aircraft.group.rotateY(s.heading + Math.PI); // mesh nose is -Z; heading 0 = +Z
    aircraft.group.rotateX(-s.pitch);
    aircraft.group.rotateZ(s.roll);
    aircraft.prop.rotation.z += 0.15 + s.speed * 0.06 + s.throttle * 0.35;
    const blink = Math.floor(s.time * 2) % 2 === 0;
    aircraft.navLights.tail.visible = blink;
  }

  /** Chase camera: behind and above the plane, smoothed. */
  function chaseCamera(s, dt) {
    planeForward.set(Math.sin(s.heading), 0, Math.cos(s.heading));
    const back = (s.camBack ?? 16) + s.speed * 0.08;
    const up = (s.camUp ?? 5.5) + s.speed * 0.02;
    const target = new THREE.Vector3(
      s.pos.x - planeForward.x * back,
      s.pos.y + up,
      s.pos.z - planeForward.z * back,
    );
    const k = 1 - Math.exp(-dt * 5);
    camPos.lerp(target, k);
    camera.position.copy(camPos);
    camLook.lerp(new THREE.Vector3(
      s.pos.x + planeForward.x * 14,
      s.pos.y + Math.sin(s.pitch) * 10 + 1,
      s.pos.z + planeForward.z * 14,
    ), 1 - Math.exp(-dt * 8));
    camera.up.set(0, 1, 0);
    camera.lookAt(camLook);
    camera.fov = 62 + s.speed * 0.12;
    camera.updateProjectionMatrix();
  }

  /** Cockpit camera: at the pilot's seat, dashboard low in frame. */
  function cockpitCamera(s) {
    planeForward.set(
      Math.sin(s.heading) * Math.cos(s.pitch),
      Math.sin(s.pitch),
      Math.cos(s.heading) * Math.cos(s.pitch),
    );
    const eye = new THREE.Vector3(s.pos.x, s.pos.y + 0.7, s.pos.z);
    camera.position.copy(eye);
    // Roll the view with the wings: build the up vector from roll.
    const up = new THREE.Vector3(-Math.sin(s.roll) * Math.cos(s.heading), Math.cos(s.roll), Math.sin(s.roll) * Math.sin(s.heading));
    camera.up.copy(up);
    camera.lookAt(eye.clone().add(planeForward));
    camera.fov = 68;
    camera.updateProjectionMatrix();
    // Dashboard panel, fixed to the camera, low in the frame.
    dashboard.mesh.position.set(0, -0.44, -0.92);
    dashboard.mesh.rotation.set(-0.3, 0, 0);
    dashboard.mesh.scale.set(1, 1, 1);
    dashboard.mesh.visible = true;
    // Attach the dashboard to the camera so it rides along.
    if (dashboard.mesh.parent !== camera) {
      camera.add(dashboard.mesh);
      scene.remove(dashHolder);
    }
  }

  function drawCompass(headingDeg) {
    const g = hud.compass;
    g.clearRect(0, 0, 360, 34);
    g.fillStyle = 'rgba(8, 18, 30, 0.55)';
    g.fillRect(0, 0, 360, 34);
    const points = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
    g.font = 'bold 13px system-ui, sans-serif';
    g.textAlign = 'center';
    for (let d = -180; d <= 180; d += 15) {
      let deg = Math.round(headingDeg + d);
      deg = ((deg % 360) + 360) % 360;
      const x = 180 + d * 1.6;
      const major = deg % 45 === 0;
      g.strokeStyle = major ? '#ffd23e' : 'rgba(207, 230, 245, 0.6)';
      g.lineWidth = major ? 2 : 1;
      g.beginPath(); g.moveTo(x, 4); g.lineTo(x, major ? 14 : 10); g.stroke();
      if (major) {
        const p = points.find(([v]) => v === deg);
        g.fillStyle = '#ffffff';
        g.fillText(p ? p[1] : String(deg).padStart(3, '0'), x, 30);
      }
    }
    // Centre caret.
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.moveTo(180, 0); g.lineTo(174, 6); g.lineTo(186, 6); g.closePath(); g.fill();
  }

  function drawAttitude(s) {
    const g = hud.attitude;
    const R = 55;
    g.clearRect(0, 0, 110, 110);
    g.save();
    g.beginPath(); g.arc(55, 55, R, 0, Math.PI * 2); g.clip();
    g.translate(55, 55);
    g.rotate(-s.roll);
    const pitchPx = Math.max(-40, Math.min(40, s.pitch * 70));
    g.fillStyle = '#3f7ec2'; g.fillRect(-60, -60 - pitchPx, 120, 60 + pitchPx);
    g.fillStyle = '#8a6a3f'; g.fillRect(-60, -pitchPx, 120, 60 + pitchPx);
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-60, -pitchPx); g.lineTo(60, -pitchPx); g.stroke();
    g.restore();
    g.strokeStyle = '#ffd23e'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(32, 55); g.lineTo(48, 55); g.moveTo(62, 55); g.lineTo(78, 55); g.stroke();
    g.beginPath(); g.arc(55, 55, 4, 0, Math.PI * 2); g.fillStyle = '#ffd23e'; g.fill();
  }

  function updateHud(s) {
    hud.alt.textContent = Math.round(s.pos.y * 3.281).toLocaleString('en-US');
    hud.spd.textContent = Math.round(s.speed * 1.94);
    hud.hdg.textContent = String(Math.round(s.headingDeg)).padStart(3, '0');
    hud.vsi.textContent = (s.vsi >= 0 ? '+' : '') + Math.round(s.vsi * 196.85).toLocaleString('en-US');
    hud.score.textContent = s.score.toLocaleString('en-US');
    hud.rings.textContent = `${s.ringsHit} / ${8}`;
    const t = Math.max(0, Math.ceil(s.timeLeft));
    hud.time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    hud.lives.textContent = String(Math.max(0, s.lives));
    hud.thrPct.textContent = `${Math.round(s.throttle * 100)}%`;
    hud.thrFill.style.width = `${Math.round(s.throttle * 100)}%`;
    hud.gear.textContent = (s.gearDown ? 'GEAR DOWN' : 'GEAR UP') + ' · FLAPS UP' + (s.fuel < 25 ? ' · LOW FUEL' : '');
    drawCompass(s.headingDeg);
    drawAttitude(s);
    if (s.message && s.time < s.messageUntil) {
      hud.banner.innerHTML = `${s.message}<small>${s.messageSub || ''}</small>`;
      hud.banner.style.opacity = '1';
    } else {
      hud.banner.style.opacity = '0';
    }
  }

  /** One rendered frame for the given state. */
  function render(s, dt, rings, activeIndex) {
    // Clouds drift with the wind.
    for (const c of clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 2600) c.position.x = -2600;
    }
    // Volcano smoke: each puff's place is a pure function of game time, so
    // the frozen screenshot frame is deterministic and the plume still rises.
    for (let i = 0; i < smokePuffs.length; i += 1) {
      const cycle = (s.time * 3 + i * 9) % 55;
      const sp = smokePuffs[i];
      sp.position.set(
        VOLCANO.x + Math.sin(i * 2.1) * 6 + cycle * 0.9,
        VOLCANO.apexY + 6 + cycle,
        VOLCANO.z + Math.cos(i * 1.7) * 6 - cycle * 0.4,
      );
      const sc = 26 + cycle * 0.9;
      sp.scale.set(sc, sc * 0.6, 1);
      sp.material.opacity = 0.55 * (1 - cycle / 70);
    }
    // Rings: the active one pulses gold, passed ones go dim.
    ringMeshes.forEach((mesh, i) => {
      const active = i === activeIndex;
      mesh.material = active ? ringMat : ringMatDim;
      if (active) {
        const pulse = 1 + 0.06 * Math.sin(s.time * 4);
        mesh.scale.set(pulse, pulse, 1);
      } else mesh.scale.set(1, 1, 1);
    });
    placePlane(s);
    if (s.cameraMode === 'cockpit') {
      cockpitCamera(s);
      dashboard.draw(dashboard.ctx, s);
      dashboard.texture.needsUpdate = true;
    } else {
      dashboard.mesh.visible = false;
      if (dashboard.mesh.parent === camera) camera.remove(dashboard.mesh);
      chaseCamera(s, dt);
    }
    updateHud(s);
    renderer.render(scene, camera);
  }

  return {
    renderer, scene, camera, buildRings, resize, render, snapCamera, hud,
    get canvas() { return canvas; },
  };
}
