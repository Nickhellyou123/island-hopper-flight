// Boot and game loop for Island Hopper. Modes:
//  - normal play: title screen, then the flight loop at fixed 60 Hz steps;
//  - ?shot=<name>: a deterministic frozen frame for screenshots (see shots.js).
import { createRenderer } from './render.js';
import { createGame } from './game.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '7');

const renderer = createRenderer(canvas);
const game = createGame();
const input = createInput();
const audio = createAudio();
renderer.buildRings(game.rings);

function fit() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.resize(w, h);
}
window.addEventListener('resize', fit);
fit();

const overlay = document.getElementById('overlay');
const overlayCard = document.getElementById('overlay-card');

function titleCard() {
  return `
    <h1>ISLAND HOPPER</h1>
    <h2>GOLDEN HOUR FLIGHT</h2>
    <p>Fly the island-hopper <b>Kite</b> through all eight golden rings before
    the fuel runs low — then bring her home to runway 09 for a smooth landing.</p>
    <p class="keys">
      <b>&uarr; / &darr;</b> pitch &nbsp;·&nbsp; <b>&larr; / &rarr;</b> bank &amp; turn<br>
      <b>W / S</b> throttle &nbsp;·&nbsp; <b>V</b> cockpit / chase camera<br>
      <b>P</b> pause &nbsp;·&nbsp; <b>M</b> mute &nbsp;·&nbsp; <b>R</b> restart &nbsp;·&nbsp; drag with the mouse to steer
    </p>
    <span class="go">PRESS ENTER OR CLICK TO FLY</span>`;
}

function overCard() {
  const s = game.state;
  return `
    <h1>FLIGHT OVER</h1>
    <h2>ISLAND HOPPER</h2>
    <p>Score <b>${s.score.toLocaleString('en-US')}</b> &nbsp;·&nbsp; rings <b>${s.ringsHit}</b>
    &nbsp;·&nbsp; landings <b>${s.stats.landings}</b> &nbsp;·&nbsp; crashes <b>${s.stats.crashes}</b></p>
    <p>${s.score >= 800 ? 'A golden-hour legend. The islanders will tell this one for years.'
      : s.score >= 300 ? 'A solid hop. The rings are still out there — fly them again.'
      : 'The lagoon keeps its secrets. Throttle up and try again.'}</p>
    <span class="go">PRESS ENTER TO FLY AGAIN</span>`;
}

function showOverlay(html) {
  overlayCard.innerHTML = html;
  overlay.classList.remove('hidden');
}
function hideOverlay() { overlay.classList.add('hidden'); }

function startGame() {
  audio.ensure(); audio.resume(); audio.click();
  if (game.state.mode === 'title' || game.state.mode === 'over') {
    game.start();
    hideOverlay();
  } else if (game.state.mode === 'paused') {
    game.state.mode = 'flying';
    hideOverlay();
  }
}

input.on('start', startGame);
input.on('camera', () => {
  const s = game.state;
  s.cameraMode = s.cameraMode === 'chase' ? 'cockpit' : 'chase';
});
input.on('pause', () => {
  const s = game.state;
  if (s.mode === 'flying') { s.mode = 'paused'; showOverlay(titleCard()); }
  else if (s.mode === 'paused') { s.mode = 'flying'; hideOverlay(); }
});
input.on('mute', () => { game.state.muted = audio.toggleMute(); });
input.on('reset', () => {
  if (game.state.mode !== 'title') { game.start(); hideOverlay(); }
});
overlay.addEventListener('click', startGame);

// ---- Shot mode: build one frozen frame and stop the loop there. ----
let shotFrames = 0;
if (shotName) {
  setupShot(shotName, game, audio);
  hideOverlay();
  document.title = `Island Hopper — shot ${shotName}`;
  // Snap the chase camera behind the plane, then render a few frames and stop.
  renderer.snapCamera(game.state);
  const stepShot = () => {
    renderer.render(game.state, 1 / 60, game.rings, game.state.ringIndex);
    shotFrames += 1;
    if (shotFrames < 12) requestAnimationFrame(stepShot);
    else document.title = `Island Hopper — shot ${shotName} READY`;
  };
  requestAnimationFrame(stepShot);
} else {
  // ---- Normal play loop. ----
  showOverlay(titleCard());
  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    const s = game.state;
    if (s.mode === 'flying') {
      acc += dt;
      while (acc >= STEP) {
        game.update(STEP, input.read(), audio);
        acc -= STEP;
        if (s.mode !== 'flying') break;
      }
      audio.update(s);
    } else if (s.mode === 'crashed' || s.mode === 'landed') {
      game.update(dt, { pitch: 0, roll: 0, throttle: 0 }, audio);
      audio.update(s);
    }
    if (s.mode === 'over') showOverlay(overCard());
    renderer.render(s, dt, game.rings, s.ringIndex);
  }
  requestAnimationFrame(loop);
}
