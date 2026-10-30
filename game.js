import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const $ = id => document.getElementById(id);
const R = 18; // radius arena
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- Renderer, scene, kamera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07060a);
scene.fog = new THREE.FogExp2(0x07060a, 0.03);
const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
cam.position.set(0, 12, 12);
addEventListener('resize', () => {
  cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Cahaya ----------
scene.add(new THREE.HemisphereLight(0x6070a0, 0x201018, 0.5));
const moon = new THREE.DirectionalLight(0x9db4ff, 1.2);
moon.position.set(8, 20, 6); moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 50 });
scene.add(moon);

// ---------- Arena ----------
function stoneTex(rep) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#4a4750'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4500; i++) {
    const g = 60 + Math.random() * 45 | 0;
    x.fillStyle = `rgba(${g},${g},${g + 8},.35)`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 5, 2 + Math.random() * 5);
  }
  x.strokeStyle = '#15131a'; x.lineWidth = 5;
  for (let i = 0; i <= 512; i += 128) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.moveTo(0, i); x.lineTo(512, i); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 64),
  new THREE.MeshStandardMaterial({ map: stoneTex(8), roughness: 0.85 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

for (const [a, b, c] of [[4.6, 4.8, 0.9], [9.4, 9.55, 0.5]]) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(a, b, 64),
    new THREE.MeshStandardMaterial({ color: 0x220a33, emissive: 0x9a35e0, emissiveIntensity: c, roughness: 1 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
}
const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 1, R + 1, 8, 48, 1, true),
  new THREE.MeshStandardMaterial({ map: stoneTex(10), roughness: 0.9, side: THREE.BackSide }));
wall.position.y = 4; wall.receiveShadow = true; scene.add(wall);

const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a5560, roughness: 0.8 });
for (let i = 0; i < 12; i++) {
  const a = i / 12 * Math.PI * 2;
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 8, 10), stoneMat);
  p.position.set(Math.cos(a) * (R - 0.3), 4, Math.sin(a) * (R - 0.3));
  p.castShadow = p.receiveShadow = true; scene.add(p);
}
const torches = [];
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
for (let i = 0; i < 12; i++) {
  const a = (i + 0.5) / 12 * Math.PI * 2;
  const x = Math.cos(a) * (R - 0.9), z = Math.sin(a) * (R - 0.9);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 1 }));
  stand.position.set(x, 1.1, z); stand.castShadow = true; scene.add(stand);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), flameMat);
  fl.position.set(x, 2.5, z); scene.add(fl);
  const L = new THREE.PointLight(0xff7a2a, 30, 16, 2);
  L.position.set(x, 2.8, z); scene.add(L);
  torches.push({ L, fl, o: Math.random() * 10 });
}

// ---------- Efek ----------
const fx = [];
const sparkGeo = new THREE.SphereGeometry(0.07, 6, 6);
function burst(pos, color, n = 10, speed = 5) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(pos);
    fx.push({ m, v: new THREE.Vector3(rnd(-1, 1), rnd(0.2, 1.4), rnd(-1, 1)).multiplyScalar(speed), life: 0.6 });
    scene.add(m);
  }
}

// ---------- Player ----------
const player = new THREE.Group(); scene.add(player);
const P = { hp: 100, max: 100, atk: 0, dur: 0.45, cross: false, combo: 0, comboT: 0, hand: -1, hit: false, jy: 0, fx2: false, fx3: false, set: null, roll: 0, inv: 0, sh: 0, drawT: 0, runT: 0, heavy: 0.3, drawn: false, face: 0, rv: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(), ph: 0, t: 0 };
let bones = null, vrm = null;

const slashGeo = (() => { // busur ungu: ekor tipis & redup -> kepala tebal & terang (putih keunguan)
  const N = 32, span = 2.4, th0 = -Math.PI / 2 - 1.2, rc = 2.05, W = 0.45, pos = [], col = [], idx = [];
  const c1 = new THREE.Color(0x8a2dff), c2 = new THREE.Color(0xf3e6ff);
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = th0 + span * t, w = W * Math.pow(t, 1.3) + 0.02, br = Math.pow(t, 1.3);
    for (const [o, m] of [[-1, 0], [0, 1], [1, 0]]) {
      const r = rc + o * w; pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
      const c = c1.clone().lerp(c2, m * t).multiplyScalar(br * (m ? 1 : 0.75)); col.push(c.r, c.g, c.b);
    }
    if (i < N) { const k = i * 3; idx.push(k, k + 1, k + 3, k + 1, k + 4, k + 3, k + 1, k + 2, k + 4, k + 2, k + 5, k + 4); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
})();
const slash = new THREE.Mesh(slashGeo,
  new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
slash.rotation.x = -Math.PI / 2; slash.position.y = 1.05; player.add(slash);

// efek tebasan silang (X) di depan pemain
const fxMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
const xMat = fxMat(0xa23cff), xCore = fxMat(0xf3e6ff); // tebasan silang ungu + inti putih
const xSlash = new THREE.Group();
for (const a of [Math.PI / 4, -Math.PI / 4]) {
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.3), xMat), core = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.08), xCore);
  bar.rotation.z = core.rotation.z = a; core.position.z = 0.01; xSlash.add(bar, core);
}
xSlash.position.set(0, 1.15, 1.7); player.add(xSlash);

// bulan sabit besar (tahap 3): ujung runcing, melengkung ke depan
const cresMat = fxMat(0x9a3dff), cresCore = fxMat(0xf3e6ff);
const cresGeo = (() => {
  const R = 3, a = 1.05, d = 1.7, x = R * Math.cos(a), y = R * Math.sin(a), r2 = Math.hypot(x + d, y), b = Math.atan2(y, x + d);
  const sh = new THREE.Shape(); sh.absarc(0, 0, R, -a, a, false); sh.absarc(-d, 0, r2, b, -b, true);
  return new THREE.ShapeGeometry(sh, 32);
})();
const cres = new THREE.Group();
const cresA = new THREE.Mesh(cresGeo, cresMat), cresB = new THREE.Mesh(cresGeo, cresCore);
cresA.rotation.y = cresB.rotation.y = -Math.PI / 2; cresB.scale.set(0.97, 0.88, 1); cresB.position.y = 0;
cres.add(cresA, cresB); cres.position.set(0, 1.2, 0.6); cres.rotation.z = 0.25; player.add(cres);

// garis kecepatan ungu di belakang pemain saat menerjang
const speedMat = fxMat(0xc27bff), speedLines = [];
for (let i = 0; i < 16; i++) {
  const L = 2.5 + Math.random() * 3, m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, L), speedMat);
  m.userData = { o: Math.random() * 6, L }; m.position.set((Math.random() - 0.5) * 3, 0.2 + Math.random() * 2, -2);
  player.add(m); speedLines.push(m);
}

function makeSword() {
  const s = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8d4e0, metalness: 1, roughness: 0.25 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.02), steel); blade.position.x = -0.62;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.07), new THREE.MeshStandardMaterial({ color: 0xb8902a, metalness: 1, roughness: 0.35 })); guard.position.x = -0.14;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.045, 0.045), new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.7 })); grip.position.x = -0.065;
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), guard.material); pom.position.x = 0.02;
  blade.castShadow = true; s.add(blade, guard, grip, pom); return s;
}

function buildFallback() { // jika louiss.vrm gagal dimuat
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 6, 12), m); body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf0c8a0 })); head.position.y = 1.75;
  body.castShadow = head.castShadow = true; g.add(body, head); player.add(g);
}

new GLTFLoader().register(p => new VRMLoaderPlugin(p)).load('louiss.vrm', gltf => {
  vrm = gltf.userData.vrm;
  VRMUtils.rotateVRM0(vrm); // model VRM 0.x dihadapkan ke +Z
  vrm.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  player.add(vrm.scene);
  const h = vrm.humanoid, b = n => h.getNormalizedBoneNode(n);
  bones = { hips: b('hips'), spine: b('spine'), chest: b('chest'), head: b('head'),
    lUA: b('leftUpperArm'), rUA: b('rightUpperArm'), lLA: b('leftLowerArm'), rLA: b('rightLowerArm'),
    lUL: b('leftUpperLeg'), rUL: b('rightUpperLeg'), lLL: b('leftLowerLeg'), rLL: b('rightLowerLeg'),
    lH: b('leftHand'), rH: b('rightHand') };
  if (bones.rH && bones.hips) rigs.push(mkRig(bones.rH, bones.hips, 1));
  if (bones.lH && bones.hips) rigs.push(mkRig(bones.lH, bones.hips, -1)); // pedang kedua (cermin) di tangan kiri
  begin();
}, undefined, err => { console.warn('Gagal memuat louiss.vrm, pakai karakter cadangan:', err); buildFallback(); begin(); });

// ---------- Pedang: sarung di pinggang <-> tangan ----------
const DRAW_HOLD = 3;     // detik pedang tetap terhunus setelah serangan terakhir, lalu kembali ke posisi semula
const RUN_SHEATH = 0.35; // detik berlari terus-menerus sebelum pedang otomatis disarungkan
const rigs = [], QI = new THREE.Quaternion();
function mkRig(hand, hips, side) { // side: 1 = kanan, -1 = kiri
  const holder = new THREE.Group(), sw = makeSword(); if (side < 0) sw.scale.x = -1; holder.add(sw);
  const anchor = new THREE.Group(); // titik sarung di pinggang, miring ke belakang-bawah
  anchor.position.set(-side * 0.2, -0.02, -0.1);
  anchor.quaternion.setFromUnitVectors(new THREE.Vector3(-side, 0, 0), new THREE.Vector3(-side * 0.3, -0.65, -0.7).normalize());
  const sh = new THREE.Group(); sh.scale.x = side;
  const dark = new THREE.MeshStandardMaterial({ color: 0x14141c, metalness: 0.3, roughness: 0.55 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb8902a, metalness: 1, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.09, 0.055), dark); body.position.x = -0.65;
  const throat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.105, 0.07), gold); throat.position.x = -0.17;
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.05), gold); tip.position.x = -1.15;
  sh.add(body, throat, tip); anchor.add(sh); hips.add(anchor); anchor.add(holder);
  return { holder, hand, anchor, tr: 1, p0: new THREE.Vector3(), q0: new THREE.Quaternion() };
}
function setDrawn(on) {
  if (P.drawn === on) return; P.drawn = on;
  for (const r of rigs) {
    (on ? r.hand : r.anchor).attach(r.holder); // pindah induk tanpa loncat, lalu meluncur ke posisi tujuan
    r.p0.copy(r.holder.position); r.q0.copy(r.holder.quaternion); r.tr = 0;
    burst(r.holder.getWorldPosition(new THREE.Vector3()), 0xdfe8ff, 5, 3);
  }
}
function updateSwords(dt) {
  for (const r of rigs) if (r.tr < 1) {
    r.tr = Math.min(1, r.tr + dt / 0.13); const e = 1 - Math.pow(1 - r.tr, 2);
    r.holder.position.copy(r.p0).multiplyScalar(1 - e); r.holder.quaternion.copy(r.q0).slerp(QI, e);
  }
}

const ATK_T = 0.45, ZERO = new THREE.Vector3();
const CX = { t1: 0.40, t2: 0.28, t3: 0.42, t4: 0.20 }; CX.total = CX.t1 + CX.t2 + CX.t3 + CX.t4; // 4 tahap serangan ke-4
const clamp01 = x => Math.min(1, Math.max(0, x));
function pose(b, x, y, z, k) { // geser rotasi tulang pelan-pelan ke target (anti patah)
  if (!b) return;
  const r = b.rotation; r.x += (x - r.x) * k; r.y += (y - r.y) * k; r.z += (z - r.z) * k;
}
function poseAndAnimate(dt, spd) { // spd: 0..1 kecepatan gerak
  P.t += dt;
  const p = P.atk > 0 ? 1 - P.atk / P.dur : 0;
  const q = clamp01((p - 0.2) / 0.4), e = 1 - Math.pow(1 - q, 3); // sapuan: cepat di awal, melambat di akhir
  const ret = clamp01((p - 0.75) / 0.25); // fase 4: kembali ke posisi awal
  const phi = -0.6 + 3.3 * e; // sudut lengan: dari samping kanan karakter -> menyilang ke kiri (kiri ke kanan di layar)
  const h = P.hand; // 1 = tebasan tangan kanan, -1 = tangan kiri (bergantian tiap serangan)
  slash.rotation.z = h * (phi - Math.PI / 2 - 1.2); // ujung terang slash mengikuti ujung pedang
  slash.scale.x = h; // tebasan kiri = cermin dari kanan
  slash.material.opacity = P.atk > 0 && !P.cross ? Math.sin(clamp01((p - 0.16) / 0.52) * Math.PI) * 0.95 : 0;
  // serangan ke-4, 3 tahap: (1) tebasan silang  (2) lompat mundur  (3) lompat menerjang + tebasan silang
  const el = P.atk > 0 && P.cross ? P.dur - P.atk : -1, s1 = CX.t1, s2 = s1 + CX.t2, s3 = s2 + CX.t3;
  let xo = 0, ca = 0; P.jy = 0;
  if (el >= 0) {
    if (el < s1) {
      xo = Math.sin(clamp01((el - 0.1) / 0.26) * Math.PI);
      xSlash.position.z = 1.7; xSlash.scale.setScalar(0.7 + 0.5 * clamp01((el - 0.1) / 0.2));
    } else if (el >= s2) {
      xo = Math.sin(clamp01((el - s2 - 0.1) / 0.32) * Math.PI);
      xSlash.position.z = 2.5; xSlash.scale.setScalar(1.0 + 0.5 * clamp01((el - s2 - 0.1) / 0.25));
      ca = Math.sin(clamp01((el - s2) / (CX.t3 + 0.12)) * Math.PI);
      cres.scale.setScalar(0.7 + 0.6 * clamp01((el - s2) / 0.3));
    }
    if (el >= s1 && el < s2) P.jy = 0.8 * Math.sin(Math.PI * (el - s1) / CX.t2); // lompat mundur
    else if (el >= s2 && el < s3) P.jy = 0.1 + 0.9 * Math.sin(Math.PI * (el - s2) / CX.t3); // lompat menerjang
  }
  xMat.opacity = xo * 0.9; xCore.opacity = xo;
  cresMat.opacity = ca * 0.85; cresCore.opacity = ca; speedMat.opacity = ca * 0.8;
  for (const m of speedLines) m.position.z = -1 - m.userData.L / 2 - ((P.t * 28 + m.userData.o) % 5);
  if (!bones) return;
  const b = bones, k = 1 - Math.exp(-dt * 14), kf = 1 - Math.exp(-dt * 30), kg = 1 - Math.exp(-dt * 26);
  P.ph += dt * (3 + spd * 6.5); // jogging: ~2.5 langkah/detik pada kecepatan penuh
  const sw = Math.sin(P.ph), co = Math.cos(P.ph), br = Math.sin(P.t * 2) * 0.02;
  const bob = P.atk > 0 || P.roll > 0 ? 0 : Math.abs(sw) * 0.07 * spd; // badan naik-turun tiap langkah
  const crouch = P.atk > 0 || P.roll > 0 ? 0 : 0.07 * (1 - spd); // badan turun sedikit saat kuda-kuda lebar
  if (vrm) vrm.scene.position.y += (bob + P.jy - crouch - vrm.scene.position.y) * kg;
  let headT = 0;
  if (P.atk > 0 && P.cross) { // serangan ke-4: 3 tahap
    const kb = 1 - Math.exp(-dt * 24);
    const sweep = q => { const ee = 1 - Math.pow(1 - clamp01(q), 3); return [0.1 + 2.2 * ee, -0.7 + 1.4 * ee, ee]; }; // [px, zx, e]
    const arms = (px, zx) => { pose(b.rUA, 0, px, zx, kf); pose(b.lUA, 0, -px, zx, kf); pose(b.rLA, 0, 0, 0, k); pose(b.lLA, 0, 0, 0, k); };
    if (el < s1) { // 1. tebasan silang: kedua pedang menyapu serentak dan bersilang (X), kuda-kuda rendah
      const [px, zx, ee] = sweep((el - 0.04) / 0.3); arms(px, zx);
      pose(b.spine, 0.25 + 0.2 * ee, 0, 0, kb); pose(b.chest, 0, 0, 0, k); pose(b.hips, 0.1, 0, 0, kb);
      pose(b.lUL, -0.6, 0, 0, kb); pose(b.rUL, 0.6, 0, 0, kb); pose(b.lLL, 0.7, 0, 0, kb); pose(b.rLL, 0.3, 0, 0, kb);
    } else if (el < s2) { // 2. lompat mundur: badan condong ke belakang, pedang terseret ke belakang, kaki ditekuk
      pose(b.rUA, 0.1, -0.9, 0.5, kf); pose(b.lUA, 0.1, 0.9, -0.5, kf); pose(b.rLA, 0, 0, 0, k); pose(b.lLA, 0, 0, 0, k);
      pose(b.spine, -0.25, 0, 0, kb); pose(b.chest, -0.1, 0, 0, kb); pose(b.hips, -0.1, 0, 0, kb);
      pose(b.lUL, -0.7, 0, 0, kb); pose(b.rUL, -0.4, 0, 0, kb); pose(b.lLL, 1.1, 0, 0, kb); pose(b.rLL, 1.3, 0, 0, kb);
    } else if (el < s3) { // 3. lompat menerjang: badan menunduk ke depan, kaki terseret, tebasan silang
      const [px, zx] = sweep((el - s2 - 0.05) / 0.25); arms(px, zx);
      pose(b.hips, 0.85, 0, 0, kb); pose(b.spine, 0.25, 0, 0, kb); pose(b.chest, 0.1, 0, 0, kb); headT = -0.55;
      pose(b.lUL, 0.3, 0, 0, kb); pose(b.rUL, 0.1, 0, 0, kb); pose(b.lLL, 0.9, 0, 0, kb); pose(b.rLL, 1.2, 0, 0, kb);
    } else { // 4. mendarat jongkok
      arms(2.3, 0.7);
      pose(b.hips, 0.2, 0, 0, kb); pose(b.spine, 0.2, 0, 0, kb); pose(b.chest, 0, 0, 0, kb);
      pose(b.lUL, -0.5, 0, 0, kb); pose(b.rUL, 0.4, 0, 0, kb); pose(b.lLL, 0.8, 0, 0, kb); pose(b.rLL, 0.6, 0, 0, kb);
    }
  } else if (P.atk > 0) {
    // 4 fase: (1) siap, pedang di sisi -> (2) ayunan dari belakang ke depan -> (3) follow through -> (4) kembali ke posisi awal
    const wd = 1 - ret, tw = (-0.55 + 1.15 * e) * h * wd; // badan memutar mengikuti tebasan
    const atkA = h > 0 ? b.rUA : b.lUA, offA = h > 0 ? b.lUA : b.rUA;
    pose(atkA, 0, h * phi * wd, h * 1.1 * ret, kf); pose(h > 0 ? b.rLA : b.lLA, 0, h * 0.9 * ret, 0, k);
    pose(offA, 0.3 - 0.15 * ret, 0, -h * (0.9 + 0.2 * ret), k); pose(h > 0 ? b.lLA : b.rLA, 0, h * (0.5 * wd - 0.9 * ret), 0, k);
    pose(b.spine, 0.18 * e * wd, tw * 0.6, 0, k); pose(b.chest, 0, tw * 0.4, 0, k); pose(b.hips, 0.05 * wd, -tw * 0.3, 0, k);
    // kuda-kuda lebar (lunge): kaki depan menekuk, kaki belakang lurus; kembali melebar ringan saat siap
    const fl = h > 0 ? b.lUL : b.rUL, bl = h > 0 ? b.rUL : b.lUL, fk = h > 0 ? b.lLL : b.rLL, bk = h > 0 ? b.rLL : b.lLL;
    pose(fl, -0.45 * wd, 0, h * 0.25 * wd + h * 0.12 * ret, k); pose(bl, 0.45 * wd, 0, -h * 0.25 * wd - h * 0.12 * ret, k);
    pose(fk, 0.7 * wd + 0.12 * ret, 0, 0, k); pose(bk, 0.15 * wd + 0.12 * ret, 0, 0, k);
  } else if (P.roll > 0) {
    pose(b.rUA, 0, 0, 1.0, k); pose(b.lUA, 0, 0, -1.0, k); pose(b.rLA, 0, 0, 0, k); pose(b.lLA, 0, 0, 0, k);
    pose(b.spine, 0.9, 0, 0, k); pose(b.chest, 0, 0, 0, k); pose(b.hips, 0, 0, 0, k);
    pose(b.lUL, 0, 0, 0, k); pose(b.rUL, 0, 0, 0, k); pose(b.lLL, 0.8, 0, 0, k); pose(b.rLL, 0.8, 0, 0, k);
  } else {
    const A = spd, ws = 1 - A, dr = P.drawn ? 1 : 0, hv = P.heavy; // A: amplitudo lari 0..1, ws: bobot diam
    // napas terengah-engah: makin cepat & dalam setelah menyerang, lalu mereda
    const ps = 0.5 + 0.9 * hv, inh = Math.pow(0.5 + 0.5 * Math.sin(P.t * (1.7 + 1.1 * hv) * 6.283), 1.4), pw = ws * ps;
    // kaki: diam = kuda-kuda lebar, lutut menekuk; lari = ayunan seperti biasa
    pose(b.lUL, -sw * 0.85 * A - 0.22 * ws, 0, 0.30 * ws, kg); pose(b.rUL, sw * 0.85 * A - 0.22 * ws, 0, -0.30 * ws, kg);
    pose(b.lLL, (0.15 + Math.max(0, co) * 1.2) * A + 0.5 * ws, 0, 0, kg); pose(b.rLL, (0.15 + Math.max(0, -co) * 1.2) * A + 0.5 * ws, 0, 0, kg);
    // tangan: lari = siku ~90 derajat mengayun; diam = lengan turun di sisi (pedang terhunus: miring ke bawah-luar seperti sheet)
    const zA = 1.1 * A + (1.25 - 0.25 * dr) * ws - 0.06 * pw * inh; // dada mengembang -> lengan sedikit terangkat
    const elb = A * (0.9 + 0.5 * A) + ws * (0.25 + 0.2 * dr), ux = 0.15 * A + (0.1 + 0.08 * dr) * ws;
    pose(b.lUA, sw * 0.7 * A + ux, 0, -zA, kg); pose(b.rUA, -sw * 0.7 * A + ux, 0, zA, kg);
    pose(b.lLA, 0, -elb, 0, kg); pose(b.rLA, 0, elb, 0, kg);
    // badan: condong ke depan, naik-turun karena napas, goyang pelan saat lelah
    pose(b.hips, 0, sw * 0.14 * A + ws * 0.05 * hv * Math.sin(P.t * 1.4), ws * 0.035 * hv * Math.sin(P.t * 0.95 + 1), kg);
    pose(b.spine, 0.04 + A * 0.14 + ws * (0.2 + 0.05 * dr - 0.07 * ps * inh), -sw * 0.08 * A, ws * 0.03 * hv * Math.sin(P.t * 0.95 + 2.2), kg);
    pose(b.chest, ws * (0.05 - 0.08 * ps * inh), -sw * 0.12 * A, 0, kg);
    headT = ws * (-0.05 + 0.1 * ps * (1 - inh)); // kepala sedikit tertunduk saat menghembuskan napas
  }
  pose(b.head, headT, 0, 0, k); // kepala menengadah saat menerjang, kembali normal setelahnya
}

// ---------- Musuh ----------
const enemies = [], orbs = [], rings = [];
function mkEnemy(boss) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: boss ? 0x2a1040 : 0x7a1f2b, roughness: 0.55, emissive: 0x000000 });
  const glow = new THREE.MeshBasicMaterial({ color: boss ? 0xff3cf0 : 0xffe14a });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  if (boss) {
    add(new THREE.ConeGeometry(1.0, 2.7, 16), mat, 0, 1.35, 0);
    add(new THREE.SphereGeometry(0.42, 16, 16), new THREE.MeshStandardMaterial({ color: 0xcfc0d8, roughness: 0.4 }), 0, 2.95, 0);
    add(new THREE.SphereGeometry(0.08, 8, 8), glow, -0.15, 3.0, 0.36); add(new THREE.SphereGeometry(0.08, 8, 8), glow, 0.15, 3.0, 0.36);
    add(new THREE.ConeGeometry(0.13, 0.7, 6), mat, -0.3, 3.45, 0); add(new THREE.ConeGeometry(0.13, 0.7, 6), mat, 0.3, 3.45, 0);
    add(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }), 0.9, 1.6, 0.5);
    add(new THREE.IcosahedronGeometry(0.24, 1), glow, 0.9, 3.3, 0.5);
    g.add(Object.assign(new THREE.PointLight(0xc030e0, 15, 10, 2), { position: new THREE.Vector3(0.9, 3.3, 0.5) }));
  } else {
    add(new THREE.IcosahedronGeometry(0.75, 1), mat, 0, 0.95, 0).scale.set(1, 1.2, 1);
    add(new THREE.SphereGeometry(0.09, 8, 8), glow, -0.25, 1.35, 0.62); add(new THREE.SphereGeometry(0.09, 8, 8), glow, 0.25, 1.35, 0.62);
    add(new THREE.ConeGeometry(0.12, 0.5, 6), mat, -0.4, 1.95, 0); add(new THREE.ConeGeometry(0.12, 0.5, 6), mat, 0.4, 1.95, 0);
    add(new THREE.ConeGeometry(0.1, 0.55, 6), mat, -0.8, 0.9, 0.3).rotation.z = 1.2; add(new THREE.ConeGeometry(0.1, 0.55, 6), mat, 0.8, 0.9, 0.3).rotation.z = -1.2;
  }
  const a = camMode === 'depan' ? rnd(-Math.PI * 0.9, -Math.PI * 0.1) : rnd(0, Math.PI * 2); // mode depan: musuh muncul di depan kamera
  g.position.set(Math.cos(a) * (R - 3), 0, Math.sin(a) * (R - 3));
  scene.add(g);
  const e = { g, mat, boss, hp: boss ? 260 : 50, max: boss ? 260 : 50, sp: boss ? 2.4 : 3.2, r: boss ? 1.3 : 0.9, cd: 1, wind: 0, flash: 0, kv: new THREE.Vector3(), stun: 0, orb: 2.5, slam: 6 };
  enemies.push(e); return e;
}

function hurtPlayer(n) {
  if (P.inv > 0 || state !== 'play') return;
  P.hp = Math.max(0, P.hp - n); P.inv = 0.6;
  $('vig').classList.add('on'); setTimeout(() => $('vig').classList.remove('on'), 80);
  shake = 0.4;
  burst(player.position.clone().setY(1.2), 0xff3030, 8);
  if (P.hp <= 0) end(false);
}
function hurtEnemy(e, n, dir, force = 0) { // dir: arah dorong (ternormalisasi), force: kecepatan awal knockback
  e.hp -= n; e.flash = 0.12;
  if (dir && force) { e.kv.set(dir.x, 0, dir.z).multiplyScalar(force * (e.boss ? 0.3 : 1)); e.stun = e.boss ? 0.15 : 0.35; e.wind = 0; e.g.scale.setScalar(1); }
  burst(e.g.position.clone().setY(1.3), e.boss ? 0xff60f0 : 0xffd060, 10);
  if (e.hp <= 0) {
    burst(e.g.position.clone().setY(1), 0xffffff, 24, 7);
    scene.remove(e.g); enemies.splice(enemies.indexOf(e), 1);
  }
}

function updateEnemies(dt) {
  for (const e of [...enemies]) {
    const d = player.position.clone().sub(e.g.position).setY(0), dist = d.length();
    d.normalize(); e.g.rotation.y = Math.atan2(d.x, d.z);
    e.cd -= dt; e.flash = Math.max(0, e.flash - dt);
    // knockback: terdorong lalu melambat (gesekan), musuh pusing sebentar & tidak bisa menyerang
    const wasStun = e.stun > 0; e.stun = Math.max(0, e.stun - dt);
    if (e.kv.lengthSq() > 0.04) {
      e.g.position.x += e.kv.x * dt; e.g.position.z += e.kv.z * dt; e.kv.multiplyScalar(Math.exp(-dt * 7));
      const hl = Math.hypot(e.g.position.x, e.g.position.z); // tetap di dalam arena
      if (hl > R - 1.5) { e.g.position.x *= (R - 1.5) / hl; e.g.position.z *= (R - 1.5) / hl; }
    } else e.kv.set(0, 0, 0);
    if (e.stun > 0) { const s = e.stun / 0.35; e.g.scale.set(1 + s * 0.25, 1 - s * 0.25, 1 + s * 0.25); }
    else if (wasStun) e.g.scale.setScalar(1);
    e.mat.emissive.setHex(e.flash > 0 ? 0xffffff : e.wind > 0 ? 0x802010 : 0x000000);
    if (e.boss) {
      const keep = e.stun > 0 ? 0 : dist > 8 ? 1 : dist < 5 ? -1 : 0;
      e.g.position.addScaledVector(d, keep * e.sp * dt);
      e.g.position.y = Math.sin(P.t * 2) * 0.15;
      if ((e.orb -= dt) <= 0) {
        e.orb = 2.8; const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff3cf0 }));
        m.position.copy(e.g.position).setY(2.2).addScaledVector(d, 1);
        orbs.push({ m, v: d.clone().multiplyScalar(10) }); scene.add(m);
      }
      if ((e.slam -= dt) <= 0) {
        e.slam = 7;
        const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 4.5, 48), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2; m.position.copy(player.position).setY(0.05); scene.add(m);
        rings.push({ m, t: 1.1 });
      }
    } else {
      if (e.wind > 0) {
        e.wind -= dt; e.g.scale.setScalar(1 + Math.sin(e.wind * 30) * 0.06);
        if (e.wind <= 0) { e.g.scale.setScalar(1); if (dist < 2.4) hurtPlayer(10); }
      } else if (e.stun > 0) { /* sedang terpental */ }
      else if (dist > 1.7) e.g.position.addScaledVector(d, e.sp * dt);
      else if (e.cd <= 0) { e.wind = 0.5; e.cd = 1.6; }
    }
    for (const o of enemies) if (o !== e) { // saling menjauh
      const s = e.g.position.clone().sub(o.g.position).setY(0), l = s.length();
      if (l < 1.6 && l > 0.001) e.g.position.addScaledVector(s.normalize(), (1.6 - l) * 0.5);
    }
  }
  for (const o of [...orbs]) {
    o.m.position.addScaledVector(o.v, dt);
    if (o.m.position.distanceTo(player.position.clone().setY(1.1)) < 0.9) { hurtPlayer(12); kill(o); }
    else if (o.m.position.length() > R + 2) kill(o);
  }
  function kill(o) { scene.remove(o.m); orbs.splice(orbs.indexOf(o), 1); }
  for (const r of [...rings]) {
    r.t -= dt; r.m.material.opacity = 0.25 + Math.sin(r.t * 20) * 0.1;
    if (r.t <= 0) {
      if (player.position.distanceTo(r.m.position) < 4.6) hurtPlayer(25);
      burst(r.m.position, 0xff6030, 30, 8); shake = 0.6;
      scene.remove(r.m); rings.splice(rings.indexOf(r), 1);
    }
  }
}

// ---------- Input ----------
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); attack(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') roll();
  const sk = { Digit1: 's1', Digit2: 's2', Digit3: 's3' }[e.code]; if (sk) skill(sk);
  if (e.code === 'KeyC') toggleCam();
  if (e.code === 'KeyR' && state !== 'play') restart();
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('mousedown', () => performance.now() - pinchEnd < 400 ? 0 : state === 'play' ? attack() : state !== 'load' && restart());

function attack() {
  if (state !== 'play' || P.atk > 0 || P.roll > 0) return;
  P.hit = false; P.comboT = 1.2;
  if (++P.combo >= 4) { P.combo = 0; P.cross = true; P.dur = P.atk = CX.total; P.fx2 = P.fx3 = false; P.set = new Set(); } // serangan ke-4: silang -> lompat mundur -> terjang + silang
  else { P.cross = false; P.dur = P.atk = ATK_T; P.hand = -P.hand; } // bergantian kanan-kiri
}
function roll() {
  if (state !== 'play' || P.roll > 0 || P.atk > 0) return;
  P.roll = 0.45; P.inv = Math.max(P.inv, 0.5);
  P.rv.set(Math.sin(P.face), 0, Math.cos(P.face));
}

// ---------- Kamera ----------
const CAMS = { // ubah angka off (x, tinggi, jarak) kalau mau angle lain
  depan: { off: new THREE.Vector3(0, 4.2, 9), look: 1.4 },
  atas: { off: new THREE.Vector3(0, 12, 11), look: 1 },
  kursor: { off: new THREE.Vector3(0, 4.2, 9), look: 1.4 } // kamera berputar mengikuti kursor / sentuhan
};
const CAM_NAMES = { depan: 'Depan', atas: 'Atas', kursor: 'Kursor' };
const UP = new THREE.Vector3(0, 1, 0), mouse = { x: 0, y: 0 };
let camYaw = 0;
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; });
// ---------- Zoom: roll mouse (PC) / cubit dua jari (Android) ----------
const ZOOM_MIN = 0.35, ZOOM_MAX = 2.2; // pengali jarak kamera (1 = jarak awal)
let zoom = 1, zoomS = 1, pinchEnd = 0;
const setZoom = z => zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
addEventListener('wheel', e => { e.preventDefault(); setZoom(zoom * Math.exp(e.deltaY * 0.0012)); }, { passive: false });
const tps = new Map(); let pd0 = 0, z0 = 1; // jari yang menyentuh layar (di luar joystick/tombol)
const pdist = () => { const [a, b] = [...tps.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || e.target !== renderer.domElement) return;
  tps.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (tps.size === 2) { pd0 = pdist() || 1; z0 = zoom; }
});
addEventListener('pointermove', e => {
  const t = tps.get(e.pointerId); if (!t) return;
  t.x = e.clientX; t.y = e.clientY;
  if (tps.size === 2) { setZoom(z0 * pd0 / Math.max(10, pdist())); pinchEnd = performance.now(); } // jari merenggang = zoom in
});
const pinchUp = e => { if (tps.delete(e.pointerId) && tps.size < 2) pinchEnd = performance.now(); };
addEventListener('pointerup', pinchUp); addEventListener('pointercancel', pinchUp);

function toggleCam() {
  const ks = Object.keys(CAMS); camMode = ks[(ks.indexOf(camMode) + 1) % ks.length];
  $('tcam').textContent = '🎥 Kamera: ' + CAM_NAMES[camMode];
}

// ---------- 3 Skill ----------
const SK = { s1: { cd: 3.5, t: 0 }, s2: { cd: 7, t: 0 }, s3: { cd: 14, t: 0 } };
const waves = [], pulses = [];
const skBtn = Object.fromEntries(Object.keys(SK).map(k => [k, document.querySelector(`[data-a=${k}]`)]));
const crescent = new THREE.RingGeometry(0.7, 1.5, 24, 1, -Math.PI / 2 - 0.9, 1.8);
const glowMat = (c, o = 0.9) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
const shield = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), glowMat(0xffe27a, 0.25));
shield.position.y = 1; shield.visible = false; player.add(shield);

function pulse(color, max, dur) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), glowMat(color));
  m.rotation.x = -Math.PI / 2; m.position.copy(player.position).setY(0.1); scene.add(m);
  pulses.push({ m, t: dur, dur, max });
}
function skill(k) {
  const s = SK[k];
  if (state !== 'play' || s.t > 0 || P.roll > 0 || (P.atk > 0 && P.cross)) return;
  s.t = s.cd;
  const f = new THREE.Vector3(Math.sin(P.face), 0, Math.cos(P.face));
  if (k === 's1') { // 1. Gelombang Bulan: tebasan jarak jauh menembus musuh
    const g = new THREE.Group(), m = new THREE.Mesh(crescent, glowMat(0x9fd0ff));
    m.rotation.x = -Math.PI / 2; m.scale.setScalar(1.4); g.add(m);
    g.rotation.y = P.face; g.position.copy(player.position).setY(1).addScaledVector(f, 1.2);
    scene.add(g); waves.push({ g, v: f.clone().multiplyScalar(16), life: 1.1, hit: new Set() });
    P.atk = P.dur = ATK_T; P.cross = false; P.hit = true; P.hand = -P.hand;
  } else if (k === 's2') { // 2. Hentakan Bumi: ledakan area + dorong musuh
    pulse(0xff9a40, 4.5, 0.45); burst(player.position.clone().setY(0.3), 0xffa040, 26, 8); shake = 0.5;
    for (const e of [...enemies]) {
      const d = e.g.position.clone().sub(player.position).setY(0), l = d.length();
      if (l < 4.5 + e.r) { hurtEnemy(e, 40, d.normalize(), 18); }
    }
  } else { // 3. Berkat Cahaya: heal + kebal sementara
    P.hp = Math.min(P.max, P.hp + 35); P.inv = 2.5; P.sh = 2.5;
    pulse(0xffe27a, 3, 0.6); burst(player.position.clone().setY(1), 0xffe27a, 20, 4);
  }
}
function tickSkills(dt) {
  for (const k in SK) { const s = SK[k]; s.t = Math.max(0, s.t - dt); skBtn[k].style.setProperty('--cd', s.t / s.cd); }
  P.sh = Math.max(0, P.sh - dt); shield.visible = P.sh > 0; shield.material.opacity = 0.2 + Math.sin(P.t * 10) * 0.08;
  for (const w of [...waves]) {
    w.life -= dt; w.g.position.addScaledVector(w.v, dt);
    for (const e of [...enemies]) {
      if (!w.hit.has(e) && Math.hypot(e.g.position.x - w.g.position.x, e.g.position.z - w.g.position.z) < e.r + 1.3) { w.hit.add(e); hurtEnemy(e, 32, w.v.clone().normalize(), 12); }
    }
    if (w.life <= 0 || w.g.position.length() > R) { scene.remove(w.g); waves.splice(waves.indexOf(w), 1); }
  }
  for (const p of [...pulses]) {
    p.t -= dt; const k = 1 - p.t / p.dur;
    p.m.scale.setScalar(0.2 + p.max * k); p.m.material.opacity = 0.9 * (1 - k);
    if (p.t <= 0) { scene.remove(p.m); pulses.splice(pulses.indexOf(p), 1); }
  }
}

// ---------- Mode Android (kontrol layar sentuh) ----------
const stick = { x: 0, y: 0 }, st = $('stick'), kn = $('knob');
let sid = null;
function stickMove(e) {
  const r = st.getBoundingClientRect(), m = r.width / 2;
  let dx = e.clientX - (r.left + m), dy = e.clientY - (r.top + m); const l = Math.hypot(dx, dy);
  if (l > m) { dx *= m / l; dy *= m / l; }
  stick.x = dx / m; stick.y = dy / m; kn.style.transform = `translate(${dx}px,${dy}px)`;
}
st.addEventListener('pointerdown', e => { e.preventDefault(); sid = e.pointerId; st.setPointerCapture(sid); stickMove(e); });
st.addEventListener('pointermove', e => { if (e.pointerId === sid) stickMove(e); });
const stickEnd = e => { if (e.pointerId !== sid) return; sid = null; stick.x = stick.y = 0; kn.style.transform = ''; };
st.addEventListener('pointerup', stickEnd); st.addEventListener('pointercancel', stickEnd);

const ACT = { atk: () => attack(), roll: () => roll(), s1: () => skill('s1'), s2: () => skill('s2'), s3: () => skill('s3') };
document.querySelectorAll('#btns button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); ACT[b.dataset.a](); }));
['top', 'btns', 'stick'].forEach(i => $(i).addEventListener('mousedown', e => e.stopPropagation()));
function setTouch(on) { document.body.classList.toggle('touch', on); $('tmode').textContent = on ? '🖥️ Mode PC' : '📱 Mode Android'; }
$('tmode').onclick = () => setTouch(!document.body.classList.contains('touch'));
$('tcam').onclick = toggleCam;
setTouch(matchMedia('(pointer:coarse)').matches); // otomatis aktif di HP/tablet

// ---------- Alur permainan ----------
const WAVES = [2, 4, 'boss'];
let state = 'load', wave = 0, shake = 0, next = 0, camMode = 'depan';
function spawnWave() {
  const w = WAVES[wave];
  if (w === 'boss') { mkEnemy(true); $('boss').hidden = false; $('wave').textContent = 'Pertarungan Terakhir'; }
  else { for (let i = 0; i < w; i++) mkEnemy(false); $('wave').textContent = `Gelombang ${wave + 1} / ${WAVES.length}`; }
}
function banner(t, ms = 1800) { $('msg').textContent = t; setTimeout(() => { if (state === 'play') $('msg').textContent = ''; }, ms); }
function begin() { state = 'play'; banner('Arena Terbuka!\nKalahkan semua musuh'); spawnWave(); }
function end(win) {
  state = win ? 'win' : 'lose';
  $('msg').textContent = (win ? 'KEMENANGAN!\nVillain telah dikalahkan' : 'KAMU KALAH') + '\n\nKlik atau tekan R untuk main lagi';
}
function restart() {
  [...enemies].forEach(e => scene.remove(e.g)); enemies.length = 0;
  [...orbs, ...rings].forEach(o => scene.remove(o.m)); orbs.length = 0; rings.length = 0;
  Object.assign(P, { hp: P.max, atk: 0, combo: 0, cross: false, jy: 0, roll: 0, inv: 0, sh: 0, drawT: 0, runT: 0, heavy: 0.3 });
  Object.values(SK).forEach(s => s.t = 0); waves.forEach(w => scene.remove(w.g)); waves.length = 0; player.position.set(0, 0, 0); P.v.set(0, 0, 0);
  wave = 0; next = 0; $('boss').hidden = true; state = 'play'; $('msg').textContent = ''; spawnWave();
}

// ---------- Serangan ke-4 (3 tahap) ----------
function crossTick() {
  const el = P.dur - Math.max(0, P.atk), s1 = CX.t1, s2 = s1 + CX.t2, s3 = s2 + CX.t3;
  const f = new THREE.Vector3(Math.sin(P.face), 0, Math.cos(P.face)), PUR = 0xb45cff;
  if (!P.hit && el >= 0.2) { // tahap 1: tebasan silang
    P.hit = true; shake = 0.3; burst(player.position.clone().addScaledVector(f, 1.7).setY(1.2), PUR, 22, 7);
    for (const e of [...enemies]) {
      const d = e.g.position.clone().sub(player.position).setY(0), l = d.length();
      if (l < 3.6 + e.r && d.normalize().dot(f) > -0.2) hurtEnemy(e, 40 + (Math.random() * 6 | 0), d, 22);
    }
  }
  if (!P.fx2 && el >= s1) { P.fx2 = true; burst(player.position.clone().setY(0.2), 0xb8b8c8, 12, 3); } // debu saat melompat mundur
  if (el >= s2 && el < s3) { // tahap 3: menerjang, menebas semua musuh yang dilewati
    burst(player.position.clone().setY(1.0).addScaledVector(f, -0.5), PUR, 2, 3);
    for (const e of [...enemies]) {
      if (P.set.has(e)) continue;
      const d = e.g.position.clone().sub(player.position).setY(0), l = d.length();
      if (l < 2.0 + e.r && d.normalize().dot(f) > -0.3) {
        P.set.add(e); shake = 0.4;
        hurtEnemy(e, 45 + (Math.random() * 8 | 0), d.add(f).normalize(), 26);
        burst(e.g.position.clone().setY(1.2), PUR, 18, 7);
      }
    }
  }
  if (!P.fx3 && el >= s3) { P.fx3 = true; shake = 0.5; burst(player.position.clone().addScaledVector(f, 1.8).setY(1.1), PUR, 30, 8); }
}

// ---------- Loop utama ----------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state === 'play') {
    const mv = new THREE.Vector3((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), 0, (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0));
    if (Math.hypot(stick.x, stick.y) > 0.2) { mv.x += stick.x; mv.z += stick.y; } // joystick layar
    mv.applyAxisAngle(UP, camYaw); // gerak mengikuti arah kamera
    const moving = mv.lengthSq() > 0;
    if (P.roll > 0) { player.position.addScaledVector(P.rv, 11 * dt); P.roll -= dt; P.v.copy(P.rv).multiplyScalar(5); }
    else if (P.atk > 0 && P.cross) { // gerak otomatis: maju sedikit -> mundur -> terjang jauh ke depan
      const el = P.dur - P.atk, f = new THREE.Vector3(Math.sin(P.face), 0, Math.cos(P.face));
      const sp = el < CX.t1 ? 1.5 : el < CX.t1 + CX.t2 ? -8 : el < CX.t1 + CX.t2 + CX.t3 ? 17 : 0;
      player.position.addScaledVector(f, sp * dt); P.v.set(0, 0, 0);
      if (el >= CX.t1 && el < CX.t1 + CX.t2 + CX.t3) P.inv = Math.max(P.inv, 0.1); // kebal saat melompat
    } else {
      if (P.atk > 0 && !P.cross) { const pp = 1 - P.atk / P.dur; if (pp > 0.15 && pp < 0.55) player.position.addScaledVector(new THREE.Vector3(Math.sin(P.face), 0, Math.cos(P.face)), 2.6 * dt); } // langkah maju kecil saat mengayun
      if (moving) { mv.normalize(); if (P.atk <= 0) P.face = Math.atan2(mv.x, mv.z); }
      P.v.lerp(moving ? mv.multiplyScalar(P.atk > 0 ? 1.5 : 5.5) : ZERO, 1 - Math.exp(-dt * 10));
      player.position.addScaledVector(P.v, dt);
    }
    if (player.position.length() > R - 1.5) player.position.setLength(R - 1.5);
    P.inv = Math.max(0, P.inv - dt);
    let fd = P.face - player.rotation.y;
    fd = Math.atan2(Math.sin(fd), Math.cos(fd)); player.rotation.y += fd * (1 - Math.exp(-dt * 14));

    if (P.atk > 0) {
      P.atk -= dt;
      if (P.cross) crossTick();
      else if (!P.hit && P.atk < P.dur * 0.62) {
        P.hit = true;
        const f = new THREE.Vector3(Math.sin(P.face), 0, Math.cos(P.face));
        for (const e of [...enemies]) {
          const d = e.g.position.clone().sub(player.position).setY(0), l = d.length();
          if (l < 2.8 + e.r && d.normalize().dot(f) > 0.1) hurtEnemy(e, 22 + (Math.random() * 6 | 0), d, 16);
        }
      }
    } else if (P.comboT > 0 && (P.comboT -= dt) <= 0) P.combo = 0; // jeda terlalu lama: hitungan combo reset
    // pedang: terhunus saat menyerang & DRAW_HOLD detik sesudahnya; disarungkan saat berlari / sudah lewat waktunya
    if (P.atk > 0) { P.drawT = DRAW_HOLD; P.runT = 0; }
    else { if (P.drawT > 0) P.drawT -= dt; P.runT = moving && P.roll <= 0 ? P.runT + dt : 0; if (P.runT > RUN_SHEATH) P.drawT = 0; }
    setDrawn(P.atk > 0 || P.drawT > 0);
    P.heavy += ((P.drawT > 0 ? 1 : 0.3) - P.heavy) * (1 - Math.exp(-dt * (P.drawT > 0 ? 8 : 1.5))); // napas berat -> ringan
    updateEnemies(dt);
    poseAndAnimate(dt, P.roll > 0 ? 0 : Math.min(1, P.v.length() / 5.5));
    if (state === 'play' && !enemies.length) {
      if (wave === WAVES.length - 1) end(true);
      else if ((next += dt) > 1.5) { next = 0; wave++; P.hp = Math.min(P.max, P.hp + 30); banner(`Gelombang ${wave + 1}`); spawnWave(); }
    }
  }
  updateSwords(dt);
  tickSkills(dt);
  vrm && vrm.update(dt);
  for (const f of [...fx]) {
    f.life -= dt; f.v.y -= 12 * dt; f.m.position.addScaledVector(f.v, dt); f.m.material.opacity = Math.max(0, f.life / 0.6);
    if (f.life <= 0) { scene.remove(f.m); fx.splice(fx.indexOf(f), 1); }
  }
  const tt = clock.elapsedTime;
  torches.forEach(t => { t.L.intensity = 26 + Math.sin(tt * 9 + t.o) * 5 + Math.random() * 3; t.fl.scale.y = 1 + Math.sin(tt * 12 + t.o) * 0.2; });
  const boss = enemies.find(e => e.boss);
  $('hpbar').style.width = P.hp / P.max * 100 + '%';
  if (boss) $('bossbar').style.width = Math.max(0, boss.hp / boss.max * 100) + '%';
  shake = Math.max(0, shake - dt);
  const target = player.position.clone();
  const C = CAMS[camMode];
  camYaw += ((camMode === 'kursor' ? -mouse.x : 0) - camYaw) * Math.min(1, dt * 5);
  zoomS += (zoom - zoomS) * Math.min(1, dt * 10);
  const off = C.off.clone().multiplyScalar(zoomS).applyAxisAngle(UP, camYaw); if (camMode === 'kursor') off.y += mouse.y * 2;
  cam.position.lerp(target.clone().add(off), Math.min(1, dt * 4));
  cam.position.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), 0).multiplyScalar(shake * 0.4));
  cam.lookAt(target.x, C.look, target.z);
  renderer.render(scene, cam);
}
frame();
