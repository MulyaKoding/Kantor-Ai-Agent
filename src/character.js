import * as THREE from 'three';
import { SKIN } from '../shared/roster.js';

// ─────────────────────────────────────────────────────────────
//  UTILITAS DASAR
// ─────────────────────────────────────────────────────────────
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

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp  = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
const lerp  = (a, b, t) => a + (b - a) * t;

function shade(hex, amount) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

// ─────────────────────────────────────────────────────────────
//  RAMBUT & HIJAB
// ─────────────────────────────────────────────────────────────
function buildHair(head, look, hairColor) {
  const h = new THREE.Group();
  // Bagian atas kepala
  h.add(box(0.52, 0.16, 0.52, hairColor,  0,    0.46, 0));
  h.add(box(0.52, 0.08, 0.08, hairColor,  0,    0.40, 0.235));
  h.add(box(0.52, 0.32, 0.12, hairColor,  0,    0.30, -0.22));

  if (look.style === 'long') {
    h.add(box(0.52, 0.65, 0.13, hairColor,  0,    0.12, -0.22));
    h.add(box(0.08, 0.34, 0.32, hairColor,  0.248, 0.28, -0.05));
    h.add(box(0.08, 0.34, 0.32, hairColor, -0.248, 0.28, -0.05));
  } else if (look.style === 'bun') {
    h.add(box(0.08, 0.22, 0.32, hairColor,  0.248, 0.32, -0.05));
    h.add(box(0.08, 0.22, 0.32, hairColor, -0.248, 0.32, -0.05));
    h.add(box(0.22, 0.22, 0.22, hairColor,  0,    0.62, -0.14)); // sanggul
  } else {
    h.add(box(0.08, 0.22, 0.32, hairColor,  0.248, 0.32, -0.05));
    h.add(box(0.08, 0.22, 0.32, hairColor, -0.248, 0.32, -0.05));
  }
  head.add(h);
}

function buildHijab(head, color) {
  const dark = shade(color, -0.09);
  const h = new THREE.Group();
  h.add(box(0.58, 0.18, 0.58, color,  0,    0.46, -0.01));  // tudung atas
  h.add(box(0.58, 0.55, 0.17, color,  0,    0.18, -0.22));  // belakang kepala
  h.add(box(0.09, 0.50, 0.42, color,  0.258, 0.24, -0.02));  // sisi kanan
  h.add(box(0.09, 0.50, 0.42, color, -0.258, 0.24, -0.02));  // sisi kiri
  h.add(box(0.22, 0.07, 0.07, dark,   0,    0.42,  0.260));  // pin depan
  h.add(box(0.60, 0.22, 0.52, dark,   0,   -0.05, -0.02));   // draperi bawah
  head.add(h);
}

// ─────────────────────────────────────────────────────────────
//  INDIKATOR STATUS (lingkaran kecil di atas kepala)
// ─────────────────────────────────────────────────────────────
function buildStatusIndicator(divisionColor) {
  const g = new THREE.Group();
  // Lingkaran latar
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.03, 8, 20),
    new THREE.MeshBasicMaterial({ color: divisionColor }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.14;
  g.add(ring);
  // Dot tengah (warna status)
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#00ff88' }),
  );
  dot.position.y = 0.14;
  g.add(dot);
  return { group: g, dot: dot.material };
}

// ─────────────────────────────────────────────────────────────
//  CREATE CHARACTER — wujud manusia nyata (voxel human)
// ─────────────────────────────────────────────────────────────
export function createCharacter(agent, divisionColor, index = 0) {
  const look      = agent.look;
  const skin      = SKIN[look.skin ?? 1];
  const hairColor = look.hair || '#1c1c1c';
  const leader    = agent.leader;

  // Warna pakaian
  const shirt  = leader
    ? '#1b2a44'
    : shade(divisionColor, [-0.04, 0.06, 0.14, -0.08][index % 4]);
  const pants  = leader
    ? '#1a2333'
    : shade(divisionColor, [-0.14, -0.04, 0.0, -0.20][index % 4]);
  const shirtL = shade(shirt, -0.06); // lengan sedikit lebih gelap

  const root = new THREE.Group();
  root.name  = agent.id;

  // ── PINGGUL (pivot utama animasi) ──
  const hips = new THREE.Group();
  root.add(hips);

  // ── TORSO ──
  const torso = new THREE.Group();
  torso.position.y = 0.6;
  hips.add(torso);

  // Badan utama
  torso.add(box(0.46, 0.64, 0.28, shirt,  0,  0.32, 0));
  // Leher
  torso.add(box(0.18, 0.14, 0.18, skin,   0,  0.68, 0));

  if (leader) {
    // Jas: lapel putih + dasi warna divisi
    torso.add(box(0.14, 0.32, 0.03, '#eef2ff',  0.00, 0.40, 0.155));
    torso.add(box(0.07, 0.28, 0.03, divisionColor, 0.00, 0.37, 0.165));
    torso.add(box(0.08, 0.60, 0.03, shade(shirt, 0.08),  0.17, 0.32, 0.148));
    torso.add(box(0.08, 0.60, 0.03, shade(shirt, 0.08), -0.17, 0.32, 0.148));
  } else {
    // Hoodie / sweater: kerah & detail
    torso.add(box(0.48, 0.15, 0.28, shirtL, 0, 0.635, -0.02)); // bahu
    torso.add(box(0.18, 0.13, 0.22, shirtL, 0.14, 0.670, 0.06));
    torso.add(box(0.18, 0.13, 0.22, shirtL,-0.14, 0.670, 0.06));
    // Kantong depan
    torso.add(box(0.16, 0.14, 0.03, shirtL, 0, 0.21, 0.153));
  }

  // ── KEPALA ──
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.75, 0);
  torso.add(headPivot);

  const head = new THREE.Group();
  headPivot.add(head);

  head.add(box(0.42, 0.42, 0.42, skin,   0,  0.21, 0));  // muka
  head.add(box(0.09, 0.09, 0.09, skin,   0,  0.03, 0));  // dagu
  // Mata kiri-kanan
  head.add(box(0.07, 0.08, 0.025, '#1b1b1b',  0.10, 0.25, 0.218));
  head.add(box(0.07, 0.08, 0.025, '#1b1b1b', -0.10, 0.25, 0.218));
  // Pupil
  head.add(box(0.04, 0.04, 0.012, '#ffffff',  0.10, 0.26, 0.228));
  head.add(box(0.04, 0.04, 0.012, '#ffffff', -0.10, 0.26, 0.228));
  // Mulut
  head.add(box(0.10, 0.025, 0.02, '#8a4545', 0, 0.12, 0.218));
  // Telinga
  head.add(box(0.04, 0.10, 0.08, skin,  0.225, 0.22,  0));
  head.add(box(0.04, 0.10, 0.08, skin, -0.225, 0.22,  0));
  // Alis
  head.add(box(0.08, 0.025, 0.02, shade(hairColor, 0.1),  0.10, 0.33, 0.218));
  head.add(box(0.08, 0.025, 0.02, shade(hairColor, 0.1), -0.10, 0.33, 0.218));

  if (look.glasses) {
    const lens = mat('#9ec5ff', { transparent: true, opacity: 0.38 });
    head.add(box(0.15, 0.12, 0.022, lens,      0.10,  0.25, 0.228));
    head.add(box(0.15, 0.12, 0.022, lens,     -0.10,  0.25, 0.228));
    head.add(box(0.38, 0.025, 0.02, '#282828', 0,     0.30, 0.238));
  }

  if (look.hijab) buildHijab(head, look.hijab);
  else            buildHair(head, look, hairColor);

  // ── STATUS INDICATOR di atas kepala ──
  const { group: indicator, dot: dotMat } = buildStatusIndicator(divisionColor);
  indicator.position.set(0, 0.72, 0);
  head.add(indicator);

  // ── LENGAN ──
  const arms = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.32, 0.56, 0);
    // Bahu
    pivot.add(box(0.15, 0.09, 0.26, shirtL, 0, 0, 0));
    // Lengan atas
    pivot.add(box(0.15, 0.32, 0.15, shirtL, 0, -0.165, 0));
    // Siku
    pivot.add(box(0.14, 0.09, 0.14, shade(shirt, -0.04), 0, -0.345, 0));
    // Lengan bawah
    pivot.add(box(0.13, 0.28, 0.13, shirtL, 0, -0.50, 0));
    // Tangan
    pivot.add(box(0.14, 0.14, 0.14, skin, 0, -0.70, 0));
    torso.add(pivot);
    arms.push(pivot);
  }

  // ── KAKI ──
  const legs = [];
  for (const side of [1, -1]) {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.12, 0, 0);

    // Paha
    thigh.add(box(0.19, 0.42, 0.19, pants, 0, -0.21, 0));
    // Lipatan lutut
    thigh.add(box(0.20, 0.08, 0.20, shade(pants, -0.06), 0, -0.44, 0));

    const knee = new THREE.Group();
    knee.position.set(0, -0.44, 0);
    // Betis
    knee.add(box(0.17, 0.38, 0.17, pants,     0, -0.19, 0));
    // Sepatu
    knee.add(box(0.20, 0.08, 0.28, '#1f1f24', 0, -0.42, 0.04));

    thigh.add(knee);
    hips.add(thigh);
    legs.push({ thigh, knee });
  }

  // ── HIT AREA (klik deteksi) ──
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 2.0, 0.9),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.set(0, 1.0, 0.1);
  hit.userData.agentId = agent.id;
  root.add(hit);

  // ─────────────────────────────────────────────────────────
  //  STATE
  // ─────────────────────────────────────────────────────────
  const seed = (index + 1) * 1.7 + agent.name.length;
  const c = {
    agent,
    root,
    hit,
    head: headPivot,
    status: 'idle',   // idle | working | done
    selected: false,
    sit: 1,
    sitTarget: 1,
    walk: 0,
    heading: 0,
    home: new THREE.Vector3(),
    path: [],
    routine: 'seated',
    routineT: 3 + Math.random() * 10,
    roams: false,
    roamPath: [],
    actionT: 0,
    action: null,
    phase: Math.random() * 6,
    seed,
  };

  // ── API ──
  c.setHome = (x, y, z) => {
    c.home.set(x, y, z);
    root.position.set(x, y, z);
  };

  c.wave = () => { c.action = 'wave'; c.actionT = 1.5; };

  c.headAnchor = (out) => {
    headPivot.getWorldPosition(out);
    out.y += 0.56;
    return out;
  };

  function startWalk(points) {
    c.path = points.map((p) => new THREE.Vector3(p[0], c.home.y, p[1]));
    c.sitTarget = 0;
  }

  // ─────────────────────────────────────────────────────────
  //  UPDATE (animasi per frame)
  // ─────────────────────────────────────────────────────────
  c.update = (dt, t) => {
    c.sit = damp(c.sit, c.sitTarget, 7, dt);
    const sitting = c.sit;
    const busy    = c.status === 'working' || c.selected;

    // ── Status indicator dot ──
    if (c.status === 'working')       dotMat.color.set('#ffcc00');
    else if (c.status === 'done')     dotMat.color.set('#00ff88');
    else if (c.selected)              dotMat.color.set('#ffffff');
    else                              dotMat.color.set(divisionColor);

    // ── Rutinitas (leader jalan-jalan, anggota stretching) ──
    if (c.routine === 'seated') {
      c.routineT -= dt;
      if (c.routineT <= 0 && !busy && !c.action) {
        if (c.roams && c.roamPath.length) {
          c.routine = 'rising';
          startWalk(c.roamPath);
        } else {
          c.action    = 'stretch';
          c.actionT   = 1.8;
          c.routineT  = 12 + Math.random() * 18;
        }
      }
    } else if (c.routine === 'rising') {
      if (c.sit < 0.08) c.routine = 'out';
    } else if (c.routine === 'out' || c.routine === 'back') {
      const target = c.path[0];
      if (target) {
        const dx   = target.x - root.position.x;
        const dz   = target.z - root.position.z;
        const dist = Math.hypot(dx, dz);
        const step = 1.5 * dt;
        if (dist <= step) {
          root.position.set(target.x, c.home.y, target.z);
          c.path.shift();
        } else {
          root.position.x += (dx / dist) * step;
          root.position.z += (dz / dist) * step;
          const want = Math.atan2(dx, dz);
          let   diff = want - c.heading;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          c.heading += diff * Math.min(1, dt * 9);
        }
        c.walk = damp(c.walk, 1, 10, dt);
      } else {
        c.walk = damp(c.walk, 0, 12, dt);
        if (c.routine === 'out') {
          c.routine  = 'pause';
          c.routineT = 3 + Math.random() * 4;
        } else {
          c.routine   = 'sitting';
          c.sitTarget = 1;
        }
      }
      if (c.routine === 'out' && busy) {
        c.routine = 'back';
        c.path    = roamBack();
      }
    } else if (c.routine === 'pause') {
      c.walk = damp(c.walk, 0, 12, dt);
      c.routineT -= dt;
      if (c.routineT <= 0 || busy) { c.routine = 'back'; c.path = roamBack(); }
    } else if (c.routine === 'sitting') {
      c.walk = damp(c.walk, 0, 12, dt);
      c.heading = damp(c.heading, 0, 8, dt);
      if (c.sit > 0.97) {
        c.sit      = 1;
        c.routine  = 'seated';
        c.routineT = 15 + Math.random() * 25;
        root.position.set(c.home.x, c.home.y, c.home.z);
      }
    }

    function roamBack() {
      const pts = c.roamPath.slice(0, -1).reverse()
        .map((p) => new THREE.Vector3(p[0], c.home.y, p[1]));
      pts.push(new THREE.Vector3(c.home.x, c.home.y, c.home.z));
      return pts;
    }

    // ── Rotasi & posisi pinggul ──
    root.rotation.y = (c.routine === 'seated' || c.routine === 'sitting')
      ? damp(root.rotation.y, 0, 8, dt)
      : c.heading;

    const breathe = Math.sin(t * 2.2 + seed) * 0.009;
    hips.position.y = lerp(0.86, 0.56, sitting) + breathe;

    // ── Animasi kaki ──
    const swing = Math.sin(t * 8 + c.phase) * 0.72 * c.walk;
    legs[0].thigh.rotation.x = -Math.PI / 2 * sitting + swing        * (1 - sitting);
    legs[1].thigh.rotation.x = -Math.PI / 2 * sitting - swing        * (1 - sitting);
    legs[0].knee.rotation.x  =  Math.PI / 2 * sitting + Math.max(0, -swing) * 0.65;
    legs[1].knee.rotation.x  =  Math.PI / 2 * sitting + Math.max(0,  swing) * 0.65;

    // ── Animasi lengan ──
    const working   = c.status === 'working';
    const typeSpeed = working ? 15 : 7;
    const typeAmp   = working ? 0.14 : 0.04;
    const armSeat   = -1.12;
    let aL = lerp(0, armSeat + Math.sin(t * typeSpeed + 1.0) * typeAmp, sitting);
    let aR = lerp(0, armSeat + Math.sin(t * typeSpeed + 3.0) * typeAmp, sitting);
    aL += -swing * 0.95 * (1 - sitting);
    aR +=  swing * 0.95 * (1 - sitting);
    let zL = 0; let zR = 0;

    // ── Action khusus ──
    if (c.action) {
      c.actionT -= dt;
      const k = clamp(Math.min(c.actionT, 1.5 - c.actionT + 0.2) * 3, 0, 1);
      if (c.action === 'wave') {
        zR = (2.5 + Math.sin(t * 11) * 0.35) * k;
        aR = lerp(aR, 0, k);
      } else if (c.action === 'stretch') {
        aL = lerp(aL, -3.1, k);
        aR = lerp(aR, -3.1, k);
      }
      if (c.actionT <= 0) c.action = null;
    }

    arms[0].rotation.set(aR, 0,  zR);
    arms[1].rotation.set(aL, 0, -zL);

    // ── Kepala: lirik kanan-kiri & menunduk saat kerja ──
    const look = Math.sin(t * 0.55 + seed) * (working ? 0.1 : 0.3);
    headPivot.rotation.y = damp(headPivot.rotation.y, c.selected ? 0 : look, 5, dt);
    headPivot.rotation.x = damp(headPivot.rotation.x, working ? 0.20 : 0.03, 5, dt);

    // Napas: torso naik-turun halus
    torso.position.y = 0.6 + Math.sin(t * 1.4 + seed) * 0.005;
  };

  return c;
}
