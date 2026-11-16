import * as THREE from 'three';
import { AGENTS, DIVISIONS, agentsOf } from '../shared/roster.js';
import { box, mat, createCharacter } from './character.js';

// ── Ekspor kompatibilitas (dipakai stage.js / main.js) ──
export const ROOM_W  = 10;
export const ROOM_D  = 10;
export const PITCH_X = 0;   // tidak dipakai (posisi manual)
export const PITCH_Z = 0;
export const WALL_H  = 0;
export const LEVEL2_BASE = 0;
export const SECOND_FLOOR = new Set();

// ── Palet neon per divisi ──
const NEON = {
  proposal: { edge: '#00ff88', glow: '#00ff44', tile: '#062918' },
  ads:      { edge: '#ff0088', glow: '#ff44aa', tile: '#1a0012' },
  social:   { edge: '#ff6600', glow: '#ff8833', tile: '#1a0a00' },
  qa:       { edge: '#00ffff', glow: '#44ffff', tile: '#001a1a' },
  dev:      { edge: '#8844ff', glow: '#aa66ff', tile: '#0d001a' },
  reporting:{ edge: '#00ccff', glow: '#44ddff', tile: '#00101a' },
  account:  { edge: '#ffee00', glow: '#ffdd33', tile: '#1a1500' },
  finance:  { edge: '#ff4488', glow: '#ff66aa', tile: '#1a0010' },
};

// ── Posisi tiap island (cx, cz) — scattered seperti referensi ──
const ISLAND_POS = {
  proposal:  [-18,  -9],
  ads:       [  6, -16],
  social:    [-22,   5],
  qa:        [  2,  -4],
  dev:       [ 18,   4],
  reporting: [-10,  14],
  account:   [  6,  18],
  finance:   [-32,  18],
};

// ── Ukuran island ──
const ISLE_W = 10;   // lebar platform
const ISLE_D = 10;   // kedalaman platform
const ISLE_T = 0.4;  // ketebalan platform
const FLOOR_Y = 0.0; // Y dasar agents di atas platform

function place(parent, obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  parent.add(obj);
  return obj;
}

// ── Neon edge strip (garis tepi bercahaya) ──
function neonEdge(w, d, color) {
  const g = new THREE.Group();
  const t = 0.14;
  const h = 0.18;
  const y = ISLE_T / 2 + h / 2;
  const em = new THREE.MeshBasicMaterial({ color });
  // Depan
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w + t, h, t), em));
  g.children.at(-1).position.set(0, y, -d / 2);
  // Belakang
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w + t, h, t), em));
  g.children.at(-1).position.set(0, y, d / 2);
  // Kiri
  g.add(new THREE.Mesh(new THREE.BoxGeometry(t, h, d), em));
  g.children.at(-1).position.set(-w / 2, y, 0);
  // Kanan
  g.add(new THREE.Mesh(new THREE.BoxGeometry(t, h, d), em));
  g.children.at(-1).position.set(w / 2, y, 0);
  return g;
}

// ── Tile lantai (grid gelap dengan aksen neon tipis) ──
function buildFloorTiles(w, d, tileColor, edgeColor) {
  const g = new THREE.Group();
  const cols = 5; const rows = 5;
  const tw = w / cols; const td = d / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileMat = new THREE.MeshLambertMaterial({ color: tileColor });
      const tile = new THREE.Mesh(new THREE.BoxGeometry(tw - 0.06, 0.04, td - 0.06), tileMat);
      tile.position.set(-w / 2 + tw * (c + 0.5), ISLE_T / 2 + 0.02, -d / 2 + td * (r + 0.5));
      tile.receiveShadow = true;
      g.add(tile);
    }
  }
  return g;
}

// ── Aura glow di bawah platform (sphere transparan) ──
function buildAura(color) {
  const geo = new THREE.SphereGeometry(7.5, 24, 12);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.07,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -1.5;
  m.scale.y = 0.35;
  return m;
}

// ── Label floating di atas island ──
function makeIsleLabel(divName, agentCount, edgeColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  // background gelap transparan
  ctx.fillStyle = '#050e1aee';
  const r = 16;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(512 - r, 0);
  ctx.quadraticCurveTo(512, 0, 512, r);
  ctx.lineTo(512, 128 - r);
  ctx.quadraticCurveTo(512, 128, 512 - r, 128);
  ctx.lineTo(r, 128);
  ctx.quadraticCurveTo(0, 128, 0, 128 - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  // border neon
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 3;
  ctx.stroke();
  // nama divisi
  ctx.fillStyle = edgeColor;
  ctx.font = '700 46px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(divName, 20, 44);
  // jumlah agen
  ctx.fillStyle = '#aabbcc';
  ctx.font = '400 32px system-ui, sans-serif';
  ctx.fillText(`${agentCount} agents`, 20, 90);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.0, 1.25),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  return mesh;
}

// ── Pedestral agen (blue glowing base) ──
function buildPedestal(neonColor) {
  const g = new THREE.Group();
  g.add(box(0.7, 0.18, 0.7, '#0a1a2a', 0, 0.09, 0));
  // glow top face
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.58),
    new THREE.MeshBasicMaterial({ color: neonColor })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.19;
  g.add(glow);
  return g;
}

// ── Koneksi garis putus-putus antar island ──
function buildConnection(scene, fromPos, toPos) {
  const dir = new THREE.Vector3().subVectors(toPos, fromPos);
  const len = dir.length();
  if (len < 1) return;
  const segments = Math.floor(len / 1.6);
  for (let i = 0; i < segments; i++) {
    if (i % 2 === 0) continue;  // setiap selang → putus-putus
    const t0 = i / segments;
    const t1 = (i + 0.6) / segments;
    const p0 = fromPos.clone().lerp(toPos, t0);
    const p1 = fromPos.clone().lerp(toPos, t1);
    const mid = p0.clone().lerp(p1, 0.5);
    const segLen = p0.distanceTo(p1);
    const dash = box(0.08, 0.08, segLen, '#3a6a9a', mid.x, -0.2, mid.z);
    dash.lookAt(new THREE.Vector3(p1.x, -0.2, p1.z));
    dash.castShadow = false;
    scene.add(dash);
  }
  // titik di ujung
  for (const p of [fromPos, toPos]) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#4488cc' })
    );
    dot.position.set(p.x, -0.15, p.z);
    scene.add(dot);
  }
}

// ── Island satu divisi ──
function buildIsland(div, scene, chars) {
  const [cx, cz] = ISLAND_POS[div.id] ?? [0, 0];
  const neon = NEON[div.id] ?? { edge: '#ffffff', glow: '#aaaaff', tile: '#0a0a1a' };

  const group = new THREE.Group();
  group.position.set(cx, 0, cz);

  // Platform datar (body utama)
  const platform = box(ISLE_W, ISLE_T, ISLE_D, '#060e18', 0, 0, 0);
  platform.receiveShadow = true;
  group.add(platform);

  // Floor tiles di atas platform
  group.add(buildFloorTiles(ISLE_W, ISLE_D, neon.tile, neon.edge));

  // Neon edge
  group.add(neonEdge(ISLE_W, ISLE_D, neon.edge));

  // Aura bawah
  group.add(buildAura(neon.glow));

  // Label floating
  const members = agentsOf(div.id);
  const label = makeIsleLabel(div.short || div.name, members.length, neon.edge);
  label.position.set(0, ISLE_T / 2 + 2.4, -ISLE_D / 2 - 0.1);
  group.add(label);

  // Susun agen di platform
  const leader = members.find((m) => m.leader);
  const team = members.filter((m) => !m.leader);
  const all = leader ? [leader, ...team] : members;

  const positions = [
    [0, -2.8],
    [-2.6, 0.5], [0, 0.5], [2.6, 0.5],
    [-2.6, 2.8], [0, 2.8],
  ];

  all.forEach((agent, i) => {
    const [ax, az] = positions[i] ?? [0, 0];
    const inner = new THREE.Group();
    inner.position.set(ax, ISLE_T / 2, az);
    // Pedestal bercahaya
    const ped = buildPedestal(neon.glow);
    inner.add(ped);
    // Karakter
    const ch = createCharacter(agent, div.color, i);
    ch.setHome(0, 0.18, 0);
    inner.add(ch.root);
    chars.push(ch);
    group.add(inner);
  });

  scene.add(group);
  return { id: div.id, center: new THREE.Vector3(cx, 0, cz), group };
}

// ── Lantai luar angkasa (subtle grid) ──
function buildSpaceFloor(scene) {
  // Ground plane sangat gelap
  const floorGeo = new THREE.PlaneGeometry(200, 200, 40, 40);
  const floorMat = new THREE.MeshLambertMaterial({ color: '#050b14' });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.6;
  floor.receiveShadow = true;
  scene.add(floor);

  // Grid lines halus
  const gridHelper = new THREE.GridHelper(180, 36, '#0d2035', '#0d2035');
  gridHelper.position.y = -0.59;
  scene.add(gridHelper);

  // Stars / bintang-bintang di "langit" (partikel kecil)
  const starGeo = new THREE.BufferGeometry();
  const starCount = 300;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 180;
    positions[i * 3 + 1] = Math.random() * 12 + 1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 180;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: '#8ab4d4', size: 0.15, sizeAttenuation: true });
  scene.add(new THREE.Points(starGeo, starMat));
}

// ── Main export ──
export function buildOffice(scene) {
  const chars = [];
  const rooms = new Map();

  buildSpaceFloor(scene);

  // Buat semua island
  DIVISIONS.forEach((d) => {
    const island = buildIsland(d, scene, chars);
    rooms.set(d.id, island);
  });

  // Koneksi antar island (pola bintang/web)
  const connections = [
    ['proposal', 'ads'],
    ['proposal', 'social'],
    ['ads', 'qa'],
    ['social', 'dev'],
    ['qa', 'reporting'],
    ['dev', 'account'],
    ['reporting', 'finance'],
    ['account', 'finance'],
    ['qa', 'dev'],
    ['proposal', 'qa'],
  ];
  for (const [a, b] of connections) {
    const posA = rooms.get(a)?.center;
    const posB = rooms.get(b)?.center;
    if (posA && posB) buildConnection(scene, posA, posB);
  }

  const allPos = [...rooms.values()].map((r) => r.center);
  const bounds = {
    minX: Math.min(...allPos.map((p) => p.x)) - 8,
    maxX: Math.max(...allPos.map((p) => p.x)) + 8,
    minZ: Math.min(...allPos.map((p) => p.z)) - 8,
    maxZ: Math.max(...allPos.map((p) => p.z)) + 8,
  };

  const byId = new Map(chars.map((c) => [c.agent.id, c]));
  const pickables = chars.map((c) => c.hit);

  return {
    chars,
    byId,
    rooms,
    pickables,
    bounds,
    update(dt, t) {
      for (const c of chars) c.update(dt, t);
    },
  };
}

export { AGENTS, mat };
