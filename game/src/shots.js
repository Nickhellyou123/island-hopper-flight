// Screenshot scenes: each one plays the real game forward from a fresh world
// for a fixed number of steps, steered by a simple autopilot, so the frame is
// what a short game really looks like and the same seed always gives the same
// frame. Called from ?shot=<name>&seed=<n>; the game then freezes on that
// frame so a screenshot captures exactly it.
import { ringCourse, RUNWAY } from './world.js';

const DT = 1 / 60;

function stepGame(game, input, steps, audio) {
  for (let i = 0; i < steps; i += 1) game.update(DT, input, audio);
}

/** Set up one named shot on a fresh game. Returns nothing; the game is left frozen. */
export function setupShot(name, game, audio) {
  const s = game.state;
  const rings = game.rings;
  const silent = { ring() {}, crash() {}, land() {}, click() {} };
  const a = audio || silent;

  if (name === 'chase') {
    // Mid-course chase view: the next golden ring and the runway island ahead.
    game.start();
    s.time = 12;
    // 150 m behind ring 1, on its approach line, so the gold torus reads in frame.
    const ring1 = rings[1];
    s.pos.set(
      ring1.x - Math.sin(ring1.heading) * 150,
      ring1.y + 5,
      ring1.z - Math.cos(ring1.heading) * 150,
    );
    s.heading = ring1.heading;
    s.headingDeg = ((s.heading * 180 / Math.PI) % 360 + 360) % 360;
    s.pitch = 0.02; s.roll = 0.08; s.speed = 46; s.throttle = 0.72;
    s.ringsHit = 1; s.ringIndex = 1; s.score = 100; s.timeLeft = 118;
    s.cameraMode = 'chase';
    s.mode = 'flying';
    stepGame(game, { pitch: 0, roll: 0.1, throttle: 0 }, 40, a);
    s.mode = 'flying';
    game.showMessage('RING 2 AHEAD — FLY THROUGH THE GOLD', 'SPEED 89 KT · ALT 312 FT');
  } else if (name === 'cockpit') {
    // Cockpit view high on final approach: the runway dead ahead, instruments lit.
    game.start();
    s.time = 12;
    // 120 m out over the flattened approach, low: the strip fills the windshield.
    s.pos.set(RUNWAY.x - 120, 30, RUNWAY.z - 6);
    s.heading = Math.PI / 2;
    s.headingDeg = 90;
    s.pitch = -0.08; s.roll = 0; s.speed = 38; s.throttle = 0.4;
    s.gearDown = true;
    s.ringsHit = 5; s.ringIndex = 5; s.score = 500; s.timeLeft = 74;
    s.cameraMode = 'cockpit';
    s.mode = 'flying';
    stepGame(game, { pitch: -0.08, roll: 0, throttle: 0 }, 25, a);
    s.mode = 'flying';
    s.gearDown = true; // frozen frame: gear stays down on final
    game.showMessage('FINAL APPROACH — RUNWAY 09', 'GEAR DOWN · FLAPS UP · 78 KT OVER THE THRESHOLD');
  } else if (name === 'ring') {
    // Low over the lagoon, about to thread a ring with the sunset behind it.
    game.start();
    s.time = 12;
    const ring = rings[3];
    const back = 95;
    s.pos.set(
      ring.x - Math.sin(ring.heading) * back,
      ring.y + 6,
      ring.z - Math.cos(ring.heading) * back,
    );
    s.heading = ring.heading;
    s.headingDeg = ((s.heading * 180 / Math.PI) % 360 + 360) % 360;
    s.pitch = 0.03; s.roll = -0.12; s.speed = 52; s.throttle = 0.8;
    s.ringsHit = 3; s.ringIndex = 3; s.score = 300; s.timeLeft = 96;
    s.cameraMode = 'chase';
    s.mode = 'flying';
    stepGame(game, { pitch: 0.03, roll: -0.05, throttle: 0 }, 55, a);
    s.mode = 'flying';
    game.showMessage('THREAD THE RING', 'LOW OVER THE LAGOON AT SUNSET');
  } else if (name === 'takeoff') {
    // Just after lift-off from runway 09: gear coming up, town and hills behind.
    game.start();
    s.time = 12;
    // Takeoff roll on the strip: gear down, full throttle, runway ahead.
    s.pos.set(RUNWAY.x - 100, RUNWAY.height + 1.6, RUNWAY.z);
    s.heading = Math.PI / 2;
    s.headingDeg = 90;
    s.pitch = 0.05; s.roll = 0; s.speed = 28; s.throttle = 0.95;
    s.camBack = 30; s.camUp = 12; // high wide chase: the whole strip reads
    s.gearDown = true;
    s.ringsHit = 0; s.ringIndex = 0; s.score = 0; s.timeLeft = 148;
    s.cameraMode = 'chase';
    s.mode = 'flying';
    stepGame(game, { pitch: 0.05, roll: 0, throttle: 0 }, 30, a);
    s.mode = 'flying';
    s.gearDown = true;
    game.showMessage('TAKEOFF ROLL — RUNWAY 09', 'FULL THROTTLE · 46 KT AND ROLLING');
  } else {
    // Unknown shot: the title screen.
    s.mode = 'title';
    s.cameraMode = 'chase';
    s.pos.set(RUNWAY.x - 200, RUNWAY.height + 2, RUNWAY.z);
    s.heading = Math.PI / 2; s.headingDeg = 90;
    s.speed = 0; s.throttle = 0.6;
  }
  return s;
}

export { ringCourse };
