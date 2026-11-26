// The cockpit dashboard: a curved panel with lit analogue gauges drawn on a
// canvas texture — airspeed, altimeter, attitude, compass, RPM and fuel —
// plus glowing warning lamps. Redrawn every frame from the flight state.
import * as THREE from 'three';

const W = 1024, H = 300;

/** Create the dashboard mesh (a gently curved panel) and its draw function. */
export function buildDashboard() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Emissive map = the same drawing, so the instruments glow in the dusk light.
  const material = new THREE.MeshBasicMaterial({ map: texture });
  // A gently curved panel wrapping toward the pilot.
  const panelGeo = new THREE.PlaneGeometry(1.9, 0.56, 24, 1);
  const pos = panelGeo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    pos.setZ(i, -0.35 * (x * x)); // gentle wrap toward the pilot
  }
  panelGeo.computeVertexNormals();
  const mesh = new THREE.Mesh(panelGeo, material);
  mesh.name = 'dashboard';
  return { mesh, canvas, ctx, texture, draw };
}

function drawDial(ctx, cx, cy, r, label, valueText, frac, tickLabels) {
  ctx.save();
  ctx.translate(cx, cy);
  // Face
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#10161f'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#3d5a73'; ctx.stroke();
  // Ticks
  ctx.strokeStyle = '#cfe6f5'; ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i += 1) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const inner = r - (i % 5 === 0 ? 12 : 7);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3));
    ctx.stroke();
  }
  // Needle
  const na = Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(na) * (r - 10), Math.sin(na) * (r - 10)); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fillStyle = '#ffd23e'; ctx.fill();
  // Label + digital readout
  ctx.fillStyle = '#9fd8ff'; ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, r * 0.42);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(valueText, 0, r * 0.72);
  if (tickLabels) {
    ctx.fillStyle = '#7fa8c4'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(tickLabels[0], -r * 0.62, r * 0.62);
    ctx.fillText(tickLabels[1], r * 0.62, r * 0.62);
  }
  ctx.restore();
}

/** Redraw the dashboard from the flight state. */
function draw(ctx, s) {
  ctx.clearRect(0, 0, W, H);
  // Panel body: dark leather with a warm top glow from the sunset.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2a2118'); grad.addColorStop(0.25, '#1b2530'); grad.addColorStop(1, '#0d141c');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#4a3423'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(W, 6); ctx.stroke();

  const spdKt = Math.round(s.speed * 1.94);
  const altFt = Math.round(s.pos.y * 3.281);
  const hdg = ((Math.round(s.headingDeg) % 360) + 360) % 360;
  const rpm = Math.round(600 + s.throttle * 1900);

  drawDial(ctx, 130, 140, 78, 'AIRSPEED', String(spdKt), Math.min(1, spdKt / 220), ['0', '220']);
  drawDial(ctx, 300, 140, 78, 'ALTITUDE', String(altFt), Math.min(1, altFt / 6000), ['0', '6000']);

  // Attitude indicator: horizon line tilted by roll, shifted by pitch.
  ctx.save();
  ctx.translate(512, 140);
  ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2); ctx.clip();
  ctx.rotate(-s.roll);
  const pitchPx = Math.max(-50, Math.min(50, s.pitch * 90));
  ctx.fillStyle = '#3f7ec2'; ctx.fillRect(-80, -80 - pitchPx, 160, 80 + pitchPx);
  ctx.fillStyle = '#8a6a3f'; ctx.fillRect(-80, -pitchPx, 160, 80 + pitchPx);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-80, -pitchPx); ctx.lineTo(80, -pitchPx); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(512, 140);
  ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2);
  ctx.lineWidth = 3; ctx.strokeStyle = '#3d5a73'; ctx.stroke();
  ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-10, 0); ctx.moveTo(10, 0); ctx.lineTo(34, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fillStyle = '#ffd23e'; ctx.fill();
  ctx.fillStyle = '#9fd8ff'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', 0, 58);
  ctx.restore();

  drawDial(ctx, 700, 140, 78, 'HEADING', String(hdg).padStart(3, '0'), hdg / 360, ['N', 'S']);
  drawDial(ctx, 880, 140, 78, 'RPM', String(rpm), s.throttle, ['0', '2500']);

  // Warning lamps row: gear, stall, low fuel — lit amber/red when active.
  const lamps = [
    { label: 'GEAR', on: s.gearDown, color: '#37d67a' },
    { label: 'STALL', on: s.speed < 16, color: '#ff4d4d' },
    { label: 'LOW FUEL', on: s.fuel < 25, color: '#ffb02e' },
    { label: 'RING', on: s.ringFlash > 0, color: '#ffd23e' },
  ];
  lamps.forEach((lamp, i) => {
    const x = 60 + i * 90, y = 258;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fillStyle = lamp.on ? lamp.color : '#23303d'; ctx.fill();
    if (lamp.on) { ctx.shadowColor = lamp.color; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0; }
    ctx.lineWidth = 2; ctx.strokeStyle = '#3d5a73'; ctx.stroke();
    ctx.fillStyle = '#cfe6f5'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(lamp.label, x + 18, y + 4);
  });
  // Fuel gauge bar, bottom right.
  ctx.fillStyle = '#9fd8ff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('FUEL', 660, 262);
  ctx.fillStyle = '#23303d'; ctx.fillRect(710, 250, 260, 14);
  ctx.fillStyle = s.fuel < 25 ? '#ff4d4d' : '#37d67a';
  ctx.fillRect(710, 250, 260 * Math.max(0, s.fuel / 100), 14);
}
