// Game state and arcade flight physics. One fixed-step update per frame tick:
// bank to turn, pitch to climb and dive, throttle to set speed, lift that
// fails below stall speed, rings to fly through, terrain and sea that crash
// you, and a runway that rewards a gentle landing.
import * as THREE from 'three';
import { heightAt, onRunway, ringCourse, RING_COUNT, RUNWAY } from './world.js';
import { clamp, lerp } from './random.js';

export const GAME_SECONDS = 150;
export const STALL_SPEED = 16; // m/s — below this the plane sinks
export const MAX_SPEED = 72;
export const START = {
  x: RUNWAY.x - 200, y: RUNWAY.height + 2, z: RUNWAY.z,
  heading: Math.PI / 2, // east, down the runway
};

export function createGame() {
  const rings = ringCourse();
  const state = {
    mode: 'title', // title | flying | paused | crashed | landed | over
    time: 0,
    timeLeft: GAME_SECONDS,
    score: 0,
    lives: 3,
    ringsHit: 0,
    lap: 1,
    ringIndex: 0,
    ringFlash: 0,
    fuel: 100,
    pos: new THREE.Vector3(START.x, START.y, START.z),
    heading: START.heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0.6,
    gearDown: true,
    vsi: 0, // vertical speed, m/s
    headingDeg: 90,
    message: '',
    messageUntil: 0,
    crashTimer: 0,
    prevRingDist: Infinity,
    cameraMode: 'chase', // chase | cockpit
    muted: false,
    stats: { rings: 0, landings: 0, crashes: 0 },
  };

  function resetFlight() {
    state.pos.set(START.x, START.y, START.z);
    state.heading = START.heading;
    state.pitch = 0; state.roll = 0;
    state.speed = 0; state.throttle = 0.6;
    state.gearDown = true; state.fuel = 100;
    state.timeLeft = GAME_SECONDS;
    state.ringIndex = 0; state.ringsHit = 0; state.lap = 1;
    state.score = 0; state.lives = 3;
    state.vsi = 0; state.message = '';
    state.stats = { rings: 0, landings: 0, crashes: 0 };
  }

  function start() {
    resetFlight();
    state.mode = 'flying';
    state.time = 0;
    showMessage('FLY THROUGH THE GOLDEN RINGS', 'Arrows steer · W/S throttle · V camera');
  }

  function showMessage(text, sub = '') {
    state.message = text;
    state.messageSub = sub;
    state.messageUntil = state.time + 2.6;
  }

  function activeRing() { return rings[state.ringIndex]; }

  function crash(reason) {
    state.lives -= 1;
    state.stats.crashes += 1;
    state.mode = 'crashed';
    state.crashTimer = 1.6;
    showMessage(reason, state.lives > 0 ? `${state.lives} ${state.lives === 1 ? 'LIFE' : 'LIVES'} LEFT — GETTING YOU AIRBORNE AGAIN` : '');
    if (state.lives <= 0) {
      state.mode = 'over';
      showMessage('OUT OF PLANES', `FINAL SCORE ${state.score} · ${state.ringsHit} RINGS`);
    }
  }

  function land() {
    state.stats.landings += 1;
    state.score += 500;
    state.fuel = 100;
    state.mode = 'landed';
    state.crashTimer = 2.2;
    showMessage('SMOOTH LANDING! +500', 'REFUELLED — THROTTLE UP TO TAKE OFF AGAIN');
  }

  /** One fixed step of flight. `input` is { pitch, roll, throttle } in -1..1. */
  function update(dt, input, audio) {
    state.time += dt;
    if (state.ringFlash > 0) state.ringFlash -= dt;
    if (state.mode === 'crashed' || state.mode === 'landed') {
      state.crashTimer -= dt;
      if (state.crashTimer <= 0) {
        if (state.mode === 'over') return;
        if (state.mode === 'landed') {
          // Roll out on the runway and take off again from where you stopped.
          state.speed = 10; state.throttle = 0.7; state.pitch = 0; state.roll = 0;
          state.mode = 'flying';
          return;
        }
        if (state.lives <= 0) { state.mode = 'over'; return; }
        // Respawn on the runway, rolling.
        state.pos.set(START.x, START.y, START.z);
        state.heading = START.heading; state.pitch = 0; state.roll = 0;
        state.speed = 12; state.throttle = 0.7; state.gearDown = true;
        state.mode = 'flying';
      }
      return;
    }
    if (state.mode !== 'flying') return;

    // Throttle and speed.
    state.throttle = clamp(state.throttle + input.throttle * dt * 0.5, 0, 1);
    const targetSpeed = 10 + state.throttle * (MAX_SPEED - 10);
    state.speed = lerp(state.speed, targetSpeed, 1 - Math.exp(-dt * 0.7));

    // Attitude: pitch and roll chase the stick, with a little smoothing.
    const pitchTarget = clamp(input.pitch * 0.42, -0.5, 0.55);
    const rollTarget = clamp(input.roll * 1.05, -1.15, 1.15);
    state.pitch = lerp(state.pitch, pitchTarget, 1 - Math.exp(-dt * 4));
    state.roll = lerp(state.roll, rollTarget, 1 - Math.exp(-dt * 3.2));

    // Bank turns the plane; pitch trades speed for altitude.
    const turnRate = -Math.sin(state.roll) * (state.speed / 60) * 0.9;
    state.heading += turnRate * dt;
    state.headingDeg = ((state.heading * 180 / Math.PI) % 360 + 360) % 360;

    // Velocity from heading + pitch; sink when slow and airborne.
    const forward = new THREE.Vector3(
      Math.sin(state.heading) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      Math.cos(state.heading) * Math.cos(state.pitch),
    );
    const groundNow = heightAt(state.pos.x, state.pos.z);
    const airborne = state.pos.y > groundNow + 2.2;
    let vy = forward.y * state.speed;
    if (airborne && state.speed < STALL_SPEED) vy -= (STALL_SPEED - state.speed) * 0.55;
    const prevY = state.pos.y;
    state.pos.addScaledVector(forward, state.speed * dt);
    if (airborne) state.pos.y += (vy - forward.y * state.speed) * dt;
    state.vsi = (state.pos.y - prevY) / dt;

    // Rolling on the runway: stay on the ground until fast enough to lift off.
    // A rolling plane is grounded, not landing: the ground check below must skip it.
    let grounded = false;
    if (!airborne && onRunway(state.pos.x, state.pos.z) && state.speed < 26) {
      grounded = true;
      state.pos.y = RUNWAY.height + 1.6;
      state.vsi = 0;
      if (state.speed >= 24 && input.pitch > 0.15) {
        state.pos.y = RUNWAY.height + 3.5; // lift-off, clear of the ground check
        showMessage('AIRBORNE', 'CLIMB OUT OVER THE LAGOON');
      }
    }

    // Gear: automatic — down slow and low, up once climbing away.
    state.gearDown = state.speed < 26 && state.pos.y < 40;

    // Fuel burns slowly; empty tanks mean a glide to the runway or the sea.
    state.fuel = Math.max(0, state.fuel - dt * 0.12);
    if (state.fuel <= 0) state.throttle = Math.max(0, state.throttle - dt * 0.2);

    // Timer.
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.mode = 'over';
      showMessage('TIME UP', `FINAL SCORE ${state.score} · ${state.ringsHit} RINGS`);
      return;
    }

    // Rings: crossing the ring's plane within its radius scores.
    const ring = activeRing();
    const toRing = new THREE.Vector3(ring.x - state.pos.x, ring.y - state.pos.y, ring.z - state.pos.z);
    const ringNormal = new THREE.Vector3(Math.sin(ring.heading), 0, Math.cos(ring.heading));
    const dist = toRing.dot(ringNormal);
    const lateral = toRing.clone().addScaledVector(ringNormal, -dist).length();
    if (state.prevRingDist > 0 && dist <= 0 && lateral < ring.radius && Math.abs(dist) < 30) {
      state.ringsHit += 1;
      state.stats.rings += 1;
      state.score += 100 * state.lap;
      state.ringFlash = 1.2;
      audio.ring();
      showMessage(`RING ${state.ringsHit} — +${100 * state.lap}`, state.ringsHit % RING_COUNT === 0 ? 'LAP COMPLETE — THE COURSE RESETS, FASTER PAYOUTS' : '');
      state.ringIndex += 1;
      if (state.ringIndex >= rings.length) { state.ringIndex = 0; state.lap += 1; }
    }
    state.prevRingDist = dist;

    // Ground and sea — only for a plane that was airborne; a rolling plane
    // on the runway is grounded, not landing or crashing.
    const ground = heightAt(state.pos.x, state.pos.z);
    if (grounded) {
      // Still rolling: nothing to check.
    } else if (ground <= 0.5 && state.pos.y <= 1.0) {
      // Ditching in the lagoon: the sea surface is y = 0.
      audio.crash();
      crash('DITCHED IN THE LAGOON');
      return;
    } else if (ground > 0.5 && state.pos.y <= ground + 1.6) {
      const gentle = Math.abs(state.vsi) < 3.5 && state.speed < 30 && onRunway(state.pos.x, state.pos.z)
        && Math.abs(state.pitch) < 0.2;
      if (gentle) {
        state.pos.y = RUNWAY.height + 1.6;
        if (state.mode === 'flying' && state.speed < 26) land();
      } else {
        audio.crash();
        crash('CRASHED INTO THE HILLSIDE');
      }
      return;
    }
    // Low-altitude warning.
    if (state.pos.y - ground < 12 && state.speed > 20) {
      showMessage('PULL UP', 'TERRAIN AHEAD');
    }
  }

  return { state, rings, start, resetFlight, update, showMessage, activeRing };
}
