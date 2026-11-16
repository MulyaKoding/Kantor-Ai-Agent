import * as THREE from 'three';
import { AGENTS, DIVISIONS, agentsOf } from '../shared/roster.js';
import { box, mat, createCharacter } from './character.js';
import * as F from './furniture.js';

// ─────────────────────────────────────────────────────────────
//  KONSTANTA LAYOUT
// ─────────────────────────────────────────────────────────────
export const ROOM_W   = 9;    // lebar ruangan (X)
export const ROOM_D   = 8;    // kedalaman ruangan (Z)
export const WALL_H   = 3.6;  // tinggi dinding per lantai
const SLAB_T          = 0.28; // tebal pelat antar lantai
const WALL_T          = 0.26; // tebal dinding
const FLOOR_TOP       = 0.12;
const PITCH           = 10;   // jarak antar center ruangan (X)

export const LEVEL2_BASE = WALL_H + SLAB_T;          // ≈ 3.88
export const SECOND_FLOOR = new Set(['dev', 'reporting', 'account', 'finance']);

// Lantai 1 (depan kamera, z_center=+4) → terlihat dari atas & depan
// Lantai 2 (di belakang & atas, z_center=−4) → terlihat dari atas
// TIDAK ada pelat yang menutupi lantai 1 → semua staf terlihat!

const FRONT_Z =  4;   // z-center lantai 1
const BACK_Z  = -4;   // z-center lantai 2 (elevated)

// Posisi tiap divisi: xi = kolom (0–3), floor = 0 / 1
const LAYOUT = {
  proposal:  { xi: 0, floor: 0 },
  ads:       { xi: 1, floor: 0 },
  social:    { xi: 2, floor: 0 },
  qa:        { xi: 3, floor: 0 },
  dev:       { xi: 0, floor: 1 },
  reporting: { xi: 1, floor: 1 },
  account:   { xi: 2, floor: 1 },
  finance:   { xi: 3, floor: 1 },
};

// Pusat X tiap kolom (4 kolom, simetris)
const colX = (xi) => (xi - 1.5) * PITCH; // −15, −5, +5, +15

// Pantry: kolom ke-4+1, lantai 1
const PANTRY_X = colX(4);     // = 25
const PANTRY_Z = FRONT_Z;
export const PITCH_X = PANTRY_X;  // dipakai main.js untuk fokus pantry
export const PITCH_Z = PANTRY_Z;

// ─────────────────────────────────────────────────────────────
//  PALET WARNA BANGUNAN
// ─────────────────────────────────────────────────────────────
const BC = {
  facade:   '#dfe6ee',  // fasad luar depan
  facadeB:  '#c8d2de',  // fasad sisi gelap
  glass:    '#7ec8e3',  // kaca jendela
  frame:    '#2d3e50',  // rangka baja
  slab:     '#cdd4dc',  // pelat beton
  column:   '#b8c4d0',  // kolom
  trim:     '#8fa0b0',  // trim
  floor:    '#d4c8b4',  // lantai ubin
  intWall:  '#eceff4',  // dinding dalam
  ground:   '#1e2630',  // halaman luar
  asphalt:  '#161e28',  // aspal parkir
  grass:    '#2d5a1e',  // rumput
  dark:     '#1a2535',
};

// ─────────────────────────────────────────────────────────────
//  UTILITAS
// ─────────────────────────────────────────────────────────────
function place(parent, obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  parent.add(obj);
  return obj;
}

function tint(hex, amount) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

// ─────────────────────────────────────────────────────────────
//  PAPAN NAMA DIVISI
// ─────────────────────────────────────────────────────────────
function makeSign(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, 1024, 192);
  ctx.fillStyle = color;     ctx.fillRect(0, 162, 1024, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, 1024, 162);
  ctx.fillStyle = '#fff';
  ctx.font = '800 88px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 512, 80);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 0.86),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
}

// ─────────────────────────────────────────────────────────────
//  SHELL RUANGAN (tanpa dinding depan & kanan — terbuka ke kamera)
// ─────────────────────────────────────────────────────────────
function buildShell(inner, color, title) {
  const W = ROOM_W; const D = ROOM_D;

  // Lantai ubin
  inner.add(box(W - 0.1, 0.18, D - 0.1, BC.floor, 0, -FLOOR_TOP, 0));

  // Dinding BELAKANG (z = −D/2, arah menjauhi kamera → solid)
  inner.add(box(W + WALL_T, WALL_H, WALL_T, BC.intWall, 0, WALL_H / 2, -D / 2 - WALL_T / 2));
  // Trim atas belakang
  inner.add(box(W + WALL_T, 0.12, WALL_T + 0.08, BC.slab, 0, WALL_H + 0.06, -D / 2 - WALL_T / 2));
  // Plinth bawah belakang
  inner.add(box(W, 0.14, 0.05, BC.trim, 0, 0.07, -D / 2 + 0.03));

  // Panel aksen divisi di dinding belakang
  inner.add(box(4.8, 1.0, 0.08, color, 0, 3.0, -D / 2 + 0.04));
  place(inner, makeSign(title, '#fff'), 0, 3.0, -D / 2 + 0.1);

  // Garis aksen atas dinding belakang
  inner.add(box(W, 0.08, 0.08, color, 0, WALL_H - 0.1, -D / 2 + 0.04));

  // Jendela di dinding belakang (pemanis, terlihat dari kamera)
  for (const [jx, jz] of [[-2.5, -D / 2 + 0.04], [2.5, -D / 2 + 0.04]]) {
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.3),
      new THREE.MeshBasicMaterial({ color: BC.glass }),
    );
    pane.position.set(jx, 2.1, jz);
    inner.add(pane);
    inner.add(box(1.76, 0.1, 0.06, BC.frame, jx, 2.76, jz - 0.01));
    inner.add(box(1.76, 0.1, 0.06, BC.frame, jx, 1.44, jz - 0.01));
    inner.add(box(0.08, 1.4, 0.06, BC.frame, jx, 2.1, jz - 0.01));
  }

  // Lampu plafon (tipis, tidak tutup pandangan)
  inner.add(box(3.0, 0.06, 0.4, '#d4e4f8', 0, WALL_H - 0.03, 0));
}

// ─────────────────────────────────────────────────────────────
//  POSISI KURSI / MEJA PER RUANGAN
// ─────────────────────────────────────────────────────────────
function addSeat(inner, chars, agent, x, z, opts) {
  const { deskW, deskD, color, index, laptopColor } = opts;
  const chairColor = tint(color, -0.18);
  place(inner, F.chair(chairColor), x, 0, z);
  const deskGroup = place(inner, F.desk(deskW, deskD), x, 0, z + deskD / 2 + 0.35);
  place(deskGroup, F.laptop(laptopColor), 0, 0, -0.2);
  place(deskGroup, F.mug(['#fff', '#ffd68a', '#cde8ff', '#f7c6d9'][index % 4]), deskW / 2 - 0.4, 0, 0.1);
  if (agent.leader) deskGroup.add(box(0.5, 0.1, 0.04, color, -deskW / 2 + 0.55, 0.96, deskD / 2 - 0.12));
  const ch = createCharacter(agent, color, index);
  ch.setHome(x, 0, z);
  inner.add(ch.root);
  chars.push(ch);
  return { ch, deskGroup };
}

// ─────────────────────────────────────────────────────────────
//  SATU RUANGAN DIVISI
// ─────────────────────────────────────────────────────────────
function buildDivisionRoom(div, scene, chars) {
  const lay = LAYOUT[div.id] ?? { xi: 0, floor: 0 };
  const cx  = colX(lay.xi);
  const cz  = lay.floor === 0 ? FRONT_Z : BACK_Z;
  const cy  = lay.floor === 1 ? LEVEL2_BASE : 0;

  const room  = new THREE.Group();
  room.position.set(cx, 0, cz);
  const inner = new THREE.Group();
  inner.position.y = cy + FLOOR_TOP;
  room.add(inner);

  buildShell(inner, div.color, div.name);
  { const rug = F.rug(5.2, 3.2, tint(div.color, 0.5)); rug.position.set(0, 0, 0.8); inner.add(rug); }

  const members    = agentsOf(div.id);
  const leader     = members.find((m) => m.leader);
  const team       = members.filter((m) => !m.leader);
  const glowColors = {
    proposal: '#cfe0ff', ads: '#ffd9bd', social: '#ffd0e6', qa: '#c9f2dc',
    dev: '#1f2a44', reporting: '#c8f3ee', account: '#fff0c4', finance: '#d9e2f2',
  };
  const lc = glowColors[div.id] || '#8ec5ff';

  if (leader) {
    const L = addSeat(inner, chars, leader, 0, -2.8, { deskW: 2.6, deskD: 1.3, color: div.color, index: 0, laptopColor: lc });
    L.ch.roams = true; L.ch.roamPath = [[1.6, -2.8], [1.6, 2.8]];
    team.forEach((m, i) => addSeat(inner, chars, m, [-3.2, 0, 3.2][i], 0.4,
      { deskW: 2.2, deskD: 1.2, color: div.color, index: i + 1, laptopColor: lc }));
    place(inner, F.clock(), 0, 2.4, -ROOM_D / 2 + 0.06);
    place(inner, F.plant(1), -4.1, 0, 3.2);
    place(inner, F.plant(1.1), 4.1, 0, 3.2);
    place(inner, F.plant(0.9), 4.2, 0, -3.4);
  } else {
    const m = members[0];
    const S = addSeat(inner, chars, m, 0, -2.2, { deskW: 2.6, deskD: 1.3, color: div.color, index: 0, laptopColor: lc });
    S.ch.roams = true; S.ch.roamPath = [[2.0, -2.2], [2.0, 2.6]];
    place(inner, F.clock(), 0, 2.4, -ROOM_D / 2 + 0.06);
    place(inner, F.plant(1), -4.1, 0, 3.2);
    place(inner, F.plant(1.1), 4.1, 0, 3.2);
  }

  // Properti khas divisi
  const wallZ = -ROOM_D / 2 + 0.2;
  switch (div.id) {
    case 'proposal': case 'ads':
      place(inner, F.whiteboard(2.6, 1.3), -3.2, 1.75, wallZ + 0.06);
      place(inner, F.bookshelf(2.2, 2.1), 3.2, 0, wallZ + 0.1); break;
    case 'social':
      place(inner, F.whiteboard(2.6, 1.3), -3.2, 1.75, wallZ + 0.06);
      place(inner, F.ringLight(), -4.0, 0, 2.5, 0.5);
      place(inner, F.bookshelf(2.2, 2.1), 3.2, 0, wallZ + 0.1); break;
    case 'qa':
      place(inner, F.whiteboard(2.6, 1.3), -3.2, 1.75, wallZ + 0.06);
      place(inner, F.deviceShelf(), 3.2, 0, wallZ + 0.2); break;
    case 'dev':
      place(inner, F.whiteboard(2.6, 1.3), -3.2, 1.75, wallZ + 0.06);
      place(inner, F.serverRack(), 3.8, 0, -3.1); break;
    case 'reporting':
      place(inner, F.chartWall(3.6, 1.9), -2.8, 1.75, wallZ + 0.06);
      place(inner, F.bookshelf(2.2, 2.1), 3.4, 0, wallZ + 0.1); break;
    case 'account':
      place(inner, F.sofa(2.6), -3.2, 0, -3.2);
      place(inner, F.table(1.4, 0.9), -3.2, 0, -1.8);
      place(inner, F.whiteboard(2.4, 1.2), 3.2, 1.75, wallZ + 0.06); break;
    case 'finance':
      place(inner, F.safe(), 3.7, 0, -3.2);
      place(inner, F.filingCabinet(), -3.7, 0, -3.4);
      place(inner, F.filingCabinet(), -2.9, 0, -3.4);
      place(inner, F.calculator(), 0.8, 0, -0.5); break;
  }

  scene.add(room);
  return { id: div.id, center: new THREE.Vector3(cx, cy, cz), group: room };
}

// ─────────────────────────────────────────────────────────────
//  PANTRY / LOUNGE
// ─────────────────────────────────────────────────────────────
function buildLounge(scene) {
  const room  = new THREE.Group();
  room.position.set(PANTRY_X, 0, PANTRY_Z);
  const inner = new THREE.Group();
  inner.position.y = FLOOR_TOP;
  room.add(inner);

  buildShell(inner, '#e08e5a', 'Pantry');
  { const rug = F.rug(5.5, 3.6, '#efe0cf'); rug.position.set(0, 0, 0.5); inner.add(rug); }
  place(inner, F.sofa(3.0, '#6b7a99'), 0, 0, -1.5);
  place(inner, F.table(1.5, 0.9, '#d9b98c'), 0, 0, 0.3);
  place(inner, F.mug('#fff'), -0.3, 0.0, 0.3);
  place(inner, F.coffeeMachine(), 3.5, 0, -3.3);
  place(inner, F.waterCooler(), 4.3, 0, -2.2);
  place(inner, F.bookshelf(2.2, 2.1), -3.2, 0, -ROOM_D / 2 + 0.3);
  place(inner, F.plant(1.2), -4.2, 0, 3.2);
  place(inner, F.plant(1.0), 4.2, 0, 3.2);
  scene.add(room);
  return room;
}

// ─────────────────────────────────────────────────────────────
//  BANGUNAN EKSTERIOR (hanya dinding tidak-terlihat & frame)
//  Kamera dari arah +X +Y +Z → lihat face +Z dan +X
//  → Dinding yang terlihat kamera: z=+max (front), x=+max (right)
//  → Jangan tutup dengan dinding solid di arah kamera!
// ─────────────────────────────────────────────────────────────
function buildExterior(scene) {
  const g = new THREE.Group();

  // Dimensi total bangunan
  const X0 = colX(0) - ROOM_W / 2 - WALL_T;    // = −15 − 4.5 − 0.26 ≈ −19.76
  const X1 = PANTRY_X + ROOM_W / 2 + WALL_T;    // = 25 + 4.5 + 0.26 ≈ 29.76
  const BW  = X1 - X0;                            // total lebar
  const ZF  = FRONT_Z + ROOM_D / 2;              // z depan lantai 1 = +8
  const ZB  = BACK_Z  - ROOM_D / 2;              // z belakang lantai 2 = −8
  const CX  = (X0 + X1) / 2;                     // ≈ +5

  // ── PLATFORM / FOUNDATION ──
  g.add(box(BW + 2, 0.4, ZF - ZB + 2, '#1c2530', CX, -0.2, (ZF + ZB) / 2));
  // Plinth bangunan
  g.add(box(BW + 0.6, 0.55, ZF - ZB + 0.6, '#252f3d', CX, -0.5, (ZF + ZB) / 2));

  // ── DINDING BELAKANG (z = ZB, menghadap −Z, tidak terlihat kamera) ──
  const BH2 = LEVEL2_BASE + WALL_H; // tinggi total 2 lantai ≈ 7.48
  g.add(box(BW, BH2, WALL_T, BC.facadeB, CX, BH2 / 2, ZB - WALL_T / 2));

  // ── DINDING KIRI (x = X0, menghadap −X, tidak terlihat kamera) ──
  // Lantai 1 bagian depan
  g.add(box(WALL_T, WALL_H, ZF - 0, '#cdd5de', X0 - WALL_T / 2, WALL_H / 2, (ZF + 0) / 2));
  // Lantai 2 bagian belakang
  g.add(box(WALL_T, BH2, BACK_Z - ZB + ROOM_D / 2, '#cdd5de', X0 - WALL_T / 2, BH2 / 2, (BACK_Z + ZB) / 2));

  // ── DINDING KANAN LUAR (x = X1, menghadap +X, terlihat kamera) ──
  // Ini TERLIHAT → pakai kolom + jendela, bukan dinding solid
  const colH2 = WALL_H + 0.1;
  for (let f = 0; f < 2; f++) {
    const fy = f === 0 ? 0 : LEVEL2_BASE;
    // Kolom
    g.add(box(WALL_T + 0.1, colH2, WALL_T + 0.1, BC.column, X1, fy + colH2 / 2, ZF / 2));
    g.add(box(WALL_T + 0.1, colH2, WALL_T + 0.1, BC.column, X1, fy + colH2 / 2, ZB / 2));
    // Jendela kaca di sisi kanan (decorative)
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.5), new THREE.MeshBasicMaterial({ color: BC.glass }));
    pane.rotation.y = Math.PI / 2;
    pane.position.set(X1 + 0.01, fy + 2.0, 0);
    g.add(pane);
    // Bingkai jendela
    g.add(box(0.08, 1.56, 4.08, BC.frame, X1 + 0.01, fy + 2.0, 0));
  }

  // ── PELAT LANTAI 2 (hanya di atas area belakang) ──
  const slabX0 = X0; const slabX1 = X1;
  const slabZ0 = ZB; const slabZ1 = -1; // stop sebelum lantai 1
  const slabW  = slabX1 - slabX0;
  const slabD  = slabZ1 - slabZ0;
  const slabCX = (slabX0 + slabX1) / 2;
  const slabCZ = (slabZ0 + slabZ1) / 2;
  g.add(box(slabW, SLAB_T, slabD, BC.slab, slabCX, WALL_H + SLAB_T / 2, slabCZ));
  // Edge pelat (strip beton terlihat dari depan)
  g.add(box(slabW, SLAB_T + 0.1, 0.18, BC.facade, slabCX, WALL_H + SLAB_T / 2, slabZ1 - 0.09));
  g.add(box(0.18, SLAB_T + 0.1, slabD, BC.facade, slabX1 + 0.09, WALL_H + SLAB_T / 2, slabCZ));

  // ── KOLOM DEPAN (di garis z = ZF = +8, terlihat dari kamera) ──
  // Kolom pada setiap batas antar-ruangan + kolom ujung kiri
  const colXs = [X0, colX(0.5), colX(1.5), colX(2.5), colX(3.5)];
  for (const cx2 of colXs) {
    // Kolom lantai 1
    g.add(box(0.3, WALL_H, 0.3, BC.column, cx2, WALL_H / 2, ZF));
  }
  // Balok horizontal atas lantai 1 (garis lantai terlihat dari depan)
  g.add(box(X1 - X0 + 0.3, 0.22, 0.28, BC.slab, CX, WALL_H + 0.11, ZF));
  g.add(box(X1 - X0 + 0.3, 0.14, 0.2, BC.trim, CX, 0.07, ZF));

  // ── PARAPET ATAP LANTAI 2 (hanya tepi, tidak tutup ruangan) ──
  const parapetH = 0.7;
  const pY       = LEVEL2_BASE + WALL_H;
  // Tepi belakang (z = ZB, tidak terlihat)
  g.add(box(BW, parapetH, 0.2, BC.facade, CX, pY + parapetH / 2, ZB - 0.1));
  // Tepi kiri (tidak terlihat)
  g.add(box(0.2, parapetH, ZB - slabZ1, BC.facade, X0 - 0.1, pY + parapetH / 2, (ZB + slabZ1) / 2));
  // Tepi kanan (terlihat, tapi kolom saja)
  g.add(box(0.2, parapetH, ZB - slabZ1, BC.facade, X1 + 0.1, pY + parapetH / 2, (ZB + slabZ1) / 2));
  // Cornice (tutup tepi atas)
  g.add(box(BW + 0.3, 0.1, 0.3, BC.slab, CX, pY + parapetH + 0.05, ZB - 0.2));

  // ── BALUSTRADE LANTAI 2 (di tepi depan, z ≈ ZF dari lantai 2) ──
  // Railing kaca transparan di tepi pelat lantai 2 (z = slabZ1)
  const railGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(slabW, 0.9),
    new THREE.MeshBasicMaterial({ color: BC.glass, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  railGlass.position.set(slabCX, WALL_H + SLAB_T + 0.45, slabZ1 - 0.06);
  g.add(railGlass);
  g.add(box(slabW + 0.2, 0.06, 0.08, BC.frame, slabCX, WALL_H + SLAB_T + 0.92, slabZ1 - 0.06));

  // ── TANGGA (dari halaman ke lantai 2 via ramp/staircase sederhana) ──
  const steps = 9; const rise = LEVEL2_BASE / steps; const run = 0.55;
  const stairX = X1 - 1.2; const stairZ1 = slabZ1 - 0.1;
  for (let i = 0; i < steps; i++) {
    const sy = FLOOR_TOP + rise * (i + 0.5);
    const sz = stairZ1 - run * (steps - 1 - i) - run / 2;
    g.add(box(1.5, rise + 0.01, run, BC.slab, stairX, sy, sz));
    g.add(box(1.5, 0.03, 0.05, BC.trim, stairX, sy + rise / 2, sz + run / 2 - 0.02));
  }
  // Railing tangga
  for (const sx of [-0.78, 0.78]) {
    const railLen = Math.sqrt(Math.pow(run * steps, 2) + Math.pow(LEVEL2_BASE, 2));
    const angle   = Math.atan2(LEVEL2_BASE, run * steps);
    const r       = box(0.05, 0.05, railLen, BC.frame, stairX + sx, LEVEL2_BASE / 2 + FLOOR_TOP, stairZ1 - run * steps / 2);
    r.rotation.x  = -angle;
    g.add(r);
    g.add(box(0.05, LEVEL2_BASE, 0.05, BC.frame, stairX + sx, LEVEL2_BASE / 2, stairZ1 - run * steps + 0.03));
  }

  // ── HALAMAN & LANSKAP ──
  // Trotoar depan
  g.add(box(BW + 10, 0.1, 3.0, '#252f3a', CX, -0.55, ZF + 1.5));
  // Rumput
  for (const [gx, gz] of [[X0 - 3, ZF + 2.5], [X1 + 3, ZF + 2.5], [CX, ZF + 4]]) {
    g.add(box(2.5, 0.08, 2.5, BC.grass, gx, -0.56, gz));
  }
  // Tanaman hias di depan gedung
  for (const [px, pz] of [[X0 + 1, ZF + 1.2], [X0 + 4, ZF + 1.2], [X1 - 1, ZF + 1.2], [X1 - 4, ZF + 1.2]]) {
    g.add(box(0.9, 0.5, 0.9, '#2b3e25', px, -0.3, pz));
    g.add(box(0.1, 0.9, 0.1, '#3d6625', px, 0.2, pz));
    g.add(box(0.7, 0.4, 0.7, '#2d7a3f', px, 0.75, pz));
    g.add(box(0.5, 0.3, 0.5, '#38a04e', px, 1.1, pz));
  }
  // Lampu tiang
  for (const [px, pz] of [[X0 + 8, ZF + 2.5], [X1 - 6, ZF + 2.5]]) {
    g.add(box(0.1, 3.5, 0.1, '#3a4555', px, 1.75, pz));
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 7),
      new THREE.MeshBasicMaterial({ color: '#fff8d0' }),
    );
    lamp.position.set(px, 3.6, pz);
    g.add(lamp);
  }

  // Koridor dalam bangunan (lantai koridor di antara baris)
  const corridorZ = (FRONT_Z + BACK_Z) / 2;  // = 0
  g.add(box(BW, 0.18, 2.0, '#c2c8d0', CX, -0.09, corridorZ));

  // Partisi antar ruangan (dinding pembagi vertical, tidak-terlihat ke kamera)
  for (let xi = 0; xi < 4; xi++) {
    const wx = colX(xi) + ROOM_W / 2 + WALL_T / 2;
    // Partisi lantai 1
    if (xi < 3) g.add(box(WALL_T, WALL_H, ROOM_D, '#d8dfe8', wx, WALL_H / 2, FRONT_Z));
    // Partisi lantai 2
    if (xi < 3) g.add(box(WALL_T, WALL_H, ROOM_D, '#d8dfe8', wx, LEVEL2_BASE + WALL_H / 2, BACK_Z));
  }

  scene.add(g);
}

// ─────────────────────────────────────────────────────────────
//  MAIN: BUILD OFFICE
// ─────────────────────────────────────────────────────────────
export function buildOffice(scene) {
  const chars = [];
  const rooms = new Map();

  // Bangunan eksterior dulu (di bawah ruangan)
  buildExterior(scene);

  // Semua ruangan divisi
  DIVISIONS.forEach((d) => rooms.set(d.id, buildDivisionRoom(d, scene, chars)));
  buildLounge(scene);

  const allCenters = [...rooms.values()].map((r) => r.center);
  const bounds = {
    minX: Math.min(...allCenters.map((p) => p.x)) - ROOM_W / 2 - 4,
    maxX: Math.max(...allCenters.map((p) => p.x)) + ROOM_W / 2 + 4,
    minZ: Math.min(...allCenters.map((p) => p.z)) - ROOM_D / 2 - 4,
    maxZ: Math.max(...allCenters.map((p) => p.z)) + ROOM_D / 2 + 4,
  };

  const byId      = new Map(chars.map((c) => [c.agent.id, c]));
  const pickables = chars.map((c) => c.hit);

  return {
    chars, byId, rooms, pickables, bounds,
    update(dt, t) { for (const c of chars) c.update(dt, t); },
  };
}

export { AGENTS, mat };
