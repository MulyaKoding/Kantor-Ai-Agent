import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}

const geoCache = new Map();
function geo(w, h, d) {
  const key = `${w}|${h}|${d}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(key);
}

export function box(w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo(w, h, d), typeof color === 'string' ? mat(color, opts) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export function createCharacter(agent, divisionColor, index = 0) {
  const root = new THREE.Group();
  root.name = agent.id;

  const seed  = (index + 1) * 1.7 + agent.name.length * 0.4;
  const neon  = new THREE.Color(divisionColor);
  const white = '#d8eeff';
  const bodyC = '#c8ddf2';
  const dimC  = '#8aaabb';

  // ── Kaki (dua silinder pendek) ──
  const legGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.32, 10);
  const legMat = new THREE.MeshLambertMaterial({ color: bodyC });
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(sx, 0.16, 0);
    leg.castShadow = true;
    root.add(leg);
  }

  // ── Tubuh utama (silinder lebih lebar) ──
  const bodyGeo = new THREE.CylinderGeometry(0.21, 0.24, 0.72, 16);
  const bodyMat = new THREE.MeshLambertMaterial({ color: white });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.68;
  body.castShadow = true;
  root.add(body);

  // ── Bahu / shoulder ring ──
  const shoulderGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16);
  const shoulderMat = new THREE.MeshLambertMaterial({ color: dimC });
  const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
  shoulder.position.y = 1.04;
  root.add(shoulder);

  // ── Leher ──
  const neckGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.14, 12);
  const neck = new THREE.Mesh(neckGeo, new THREE.MeshLambertMaterial({ color: dimC }));
  neck.position.y = 1.14;
  root.add(neck);

  // ── Kepala (sphere dome) ──
  const headGeo = new THREE.SphereGeometry(0.22, 18, 14);
  const headMat = new THREE.MeshLambertMaterial({ color: white });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.42;
  head.castShadow = true;
  root.add(head);

  // ── Visor / mata (strip glow melintang) ──
  const visorGeo = new THREE.BoxGeometry(0.28, 0.07, 0.06);
  const visorMat = new THREE.MeshBasicMaterial({ color: divisionColor });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 1.44, 0.19);
  root.add(visor);

  // ── Garis-garis Ring Neon (ciri utama robot) ──
  // Tiga torus rings di body pada ketinggian berbeda
  const rings = [];
  const ringHeights = [0.42, 0.65, 0.90];
  const ringRadii   = [0.245, 0.235, 0.225];
  for (let i = 0; i < 3; i++) {
    const rGeo = new THREE.TorusGeometry(ringRadii[i], 0.022, 8, 28);
    const rMat = new THREE.MeshBasicMaterial({
      color: divisionColor,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(rGeo, rMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ringHeights[i];
    ring.castShadow = false;
    root.add(ring);
    rings.push(ring);
  }

  // ── Ring kepala (satu torus di leher/kepala) ──
  const headRingGeo = new THREE.TorusGeometry(0.24, 0.018, 8, 24);
  const headRingMat = new THREE.MeshBasicMaterial({ color: divisionColor, transparent: true, opacity: 0.7 });
  const headRing = new THREE.Mesh(headRingGeo, headRingMat);
  headRing.rotation.x = Math.PI / 2;
  headRing.position.y = 1.08;
  root.add(headRing);
  rings.push(headRing);

  // ── Antena (leader saja) ──
  if (agent.leader) {
    const antGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6);
    const ant = new THREE.Mesh(antGeo, new THREE.MeshLambertMaterial({ color: dimC }));
    ant.position.set(0.08, 1.74, 0);
    root.add(ant);
    const tipGeo = new THREE.SphereGeometry(0.04, 8, 6);
    const tip = new THREE.Mesh(tipGeo, new THREE.MeshBasicMaterial({ color: divisionColor }));
    tip.position.set(0.08, 1.86, 0);
    root.add(tip);
  }

  // ── Status indicator (dot di dada) ──
  const dotGeo = new THREE.SphereGeometry(0.055, 8, 6);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#00ff88' });
  const statusDot = new THREE.Mesh(dotGeo, dotMat);
  statusDot.position.set(0, 0.72, 0.22);
  root.add(statusDot);

  // ── Hit area (klik) ──
  const hitGeo = new THREE.BoxGeometry(0.6, 1.9, 0.6);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.position.y = 0.95;
  hit.userData.agentId = agent.id;
  root.add(hit);

  // ── State ──
  const home = new THREE.Vector3();
  const c = {
    agent,
    root,
    hit,
    head,
    status: 'idle',
    selected: false,
    // kompat dengan main.js (tidak dipakai tapi harus ada)
    sit: 0,
    sitTarget: 0,
    walk: 0,
    roams: false,
    roamPath: [],
    action: null,
    actionT: 0,
    phase: Math.random() * Math.PI * 2,
  };

  c.setHome = (x, y, z) => {
    home.set(x, y, z);
    root.position.set(x, y, z);
  };

  c.wave = () => {
    c.action = 'wave';
    c.actionT = 1.5;
  };

  c.headAnchor = (out) => {
    head.getWorldPosition(out);
    out.y += 0.3;
    return out;
  };

  c.update = (dt, t) => {
    const working = c.status === 'working';
    const done    = c.status === 'done';

    // ── Hover / float naik-turun ──
    root.position.y = home.y + Math.sin(t * 1.6 + seed) * 0.07;

    // ── Kepala lihat kanan-kiri pelan ──
    head.rotation.y = Math.sin(t * 0.45 + seed) * 0.28;
    visor.position.set(
      Math.sin(t * 0.45 + seed) * 0.04,
      1.44,
      0.19,
    );

    // ── Ring pulse: glow berkedip neon ──
    const pulseSpeed = working ? 4.5 : 1.8;
    const pulseBase  = working ? 0.55 : 0.75;
    rings.forEach((ring, i) => {
      const p = pulseBase + Math.sin(t * pulseSpeed + seed + i * 0.9) * 0.25;
      ring.material.opacity = Math.max(0.3, Math.min(1, p));
    });

    // ── Status dot warna ──
    if (working) {
      dotMat.color.set('#ffcc00');
    } else if (done) {
      dotMat.color.set('#00ff88');
    } else if (c.selected) {
      dotMat.color.set('#ffffff');
    } else {
      dotMat.color.set('#2266aa');
    }

    // ── Wave action ──
    if (c.action === 'wave') {
      c.actionT -= dt;
      const k = Math.max(0, Math.sin((1.5 - c.actionT) * Math.PI / 1.5));
      head.rotation.z = Math.sin(t * 8) * 0.35 * k;
      if (c.actionT <= 0) {
        c.action = null;
        head.rotation.z = 0;
      }
    }
  };

  return c;
}
