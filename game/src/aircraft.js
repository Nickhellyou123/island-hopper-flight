// The aircraft: "Kite", a cream-and-orange island-hopper prop plane built from
// Three.js primitives. Nothing here copies a commercial aircraft design; the
// livery, name and shape are original.
import * as THREE from 'three';

const CREAM = 0xf7ead2;
const ORANGE = 0xe8641c;
const DARK = 0x2b3440;
const GLASS = 0x16324a;

function lambert(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}

/** Build the plane. Returns { group, prop, navLights } — prop spins, nav lights blink. */
export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'kite-plane';

  // Fuselage: a capsule along Z, nose toward -Z is forward in our flight math,
  // so the mesh is built nose-forward on -Z and the group is rotated in render.
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 4.6, 6, 14), lambert(CREAM));
  fuselage.rotation.x = Math.PI / 2;
  fuselage.scale.set(1, 1, 1);
  group.add(fuselage);

  // Orange cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.CapsuleGeometry(1.08, 4.2, 6, 14), lambert(ORANGE));
  stripe.rotation.x = Math.PI / 2;
  stripe.scale.set(1, 0.28, 1);
  stripe.position.y = -0.12;
  group.add(stripe);

  // Nose cone and spinner.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.4, 14), lambert(ORANGE));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  group.add(nose);

  // Canopy: glossy dark glass bubble over the cockpit.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: GLASS, shininess: 120, specular: 0x99ccff }),
  );
  canopy.scale.set(1, 0.75, 1.7);
  canopy.position.set(0, 0.55, -1.1);
  group.add(canopy);

  // Main wing: a wide flat box with a slight taper faked by a second panel.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.22, 2.1), lambert(CREAM));
  wing.position.set(0, 0.05, -0.4);
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 2.0), lambert(ORANGE));
  wingTipL.position.set(-5.55, 0.05, -0.4);
  group.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 5.55;
  group.add(wingTipR);

  // Tail: horizontal stabiliser + vertical fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.1), lambert(CREAM));
  stab.position.set(0, 0.15, 2.9);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.5), lambert(ORANGE));
  fin.position.set(0, 0.85, 2.85);
  group.add(fin);

  // Propeller: hub + two blades, spins with speed.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -4.05);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 10), lambert(DARK));
  hub.rotation.x = -Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.34, 3.4, 0.08);
  const bladeMat = lambert(0x1c222c);
  const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
  prop.add(blade1);
  const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade2);
  group.add(prop);

  // Landing gear: two fixed legs with wheels + a tail wheel.
  const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, lambert(DARK));
    leg.position.set(side * 0.85, -1.35, -0.9);
    group.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, lambert(0x14181f));
    wheel.position.set(side * 0.85, -1.85, -0.9);
    group.add(wheel);
  }

  // Navigation lights: red port, green starboard, white tail — emissive so they glow.
  const navLights = {};
  const lightGeo = new THREE.SphereGeometry(0.14, 8, 8);
  navLights.port = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  navLights.port.position.set(-5.85, 0.05, -0.4);
  navLights.starboard = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x2aff5a }));
  navLights.starboard.position.set(5.85, 0.05, -0.4);
  navLights.tail = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  navLights.tail.position.set(0, 0.1, 3.5);
  group.add(navLights.port, navLights.starboard, navLights.tail);

  // Registration on the fin, drawn as a tiny canvas texture so the plane reads
  // as one specific aircraft, not a generic model.
  const reg = makeLabelTexture('PK-KTE');
  const regMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.42),
    new THREE.MeshBasicMaterial({ map: reg, transparent: true }),
  );
  regMesh.position.set(0.1, 0.95, 2.84);
  regMesh.rotation.y = Math.PI / 2;
  group.add(regMesh);
  const regMesh2 = regMesh.clone();
  regMesh2.position.x = -0.1;
  regMesh2.rotation.y = -Math.PI / 2;
  group.add(regMesh2);

  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group, prop, navLights };
}

function makeLabelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = '#ffffff';
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
