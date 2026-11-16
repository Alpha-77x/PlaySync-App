import * as THREE from 'three';
import {
  type ArenaModeId,
  F1_BOOST_PADS,
  TANK_BUNKERS,
  ZEROG_GATES,
} from '../engine/arenaLogic';

export interface HoverPodRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  hullMat: THREE.MeshPhysicalMaterial;
  accentMat: THREE.MeshStandardMaterial;
  thrusterCones: THREE.Mesh[];
}

export function buildCryoBumperPod(
  initialHex: string,
  shadowTex: THREE.Texture
): HoverPodRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 24),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(initialHex),
    roughness: 0.24,
    metalness: 0.5,
    clearcoat: 0.9,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
    metalness: 0.6,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const bumper = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.24, 14, 32), darkMat);
  bumper.rotation.x = Math.PI / 2;
  bumper.position.y = 0.36;
  bumper.castShadow = true;
  bodyGroup.add(bumper);

  const shockRing = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.06, 10, 32), accentMat);
  shockRing.rotation.x = Math.PI / 2;
  shockRing.position.y = 0.36;
  bodyGroup.add(shockRing);

  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.18, 0.36, 16), hullMat);
  deck.position.y = 0.44;
  deck.castShadow = true;
  bodyGroup.add(deck);

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.56, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      roughness: 0.1,
      metalness: 0.2,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.85,
    })
  );
  canopy.position.set(0, 0.58, 0.08);
  bodyGroup.add(canopy);

  const thrusterCones: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.72), hullMat);
    fin.position.set(side * 0.76, 0.66, -0.58);
    fin.rotation.z = side * -0.25;
    bodyGroup.add(fin);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.34, 12), darkMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side * 0.46, 0.42, -1.2);
    bodyGroup.add(nozzle);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.95, 10),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(side * 0.46, 0.42, -1.68);
    bodyGroup.add(flame);
    thrusterCones.push(flame);
  }

  return { root, bodyGroup, hullMat, accentMat, thrusterCones };
}

export function buildZeroGStriker(
  initialHex: string,
  shadowTex: THREE.Texture
): HoverPodRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 24),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.45;
  root.add(bodyGroup);

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(initialHex),
    roughness: 0.2,
    metalness: 0.65,
    clearcoat: 1.0,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.6,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x00f5a0,
    emissive: 0x00f5a0,
    emissiveIntensity: 0.95,
    roughness: 0.15,
  });

  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 6), hullMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.scale.set(1.15, 1, 0.48);
  fuselage.castShadow = true;
  bodyGroup.add(fuselage);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), accentMat);
  canopy.scale.set(0.85, 0.6, 1.7);
  canopy.position.set(0, 0.22, 0.22);
  bodyGroup.add(canopy);

  const magRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.06, 10, 32), accentMat);
  magRing.rotation.x = Math.PI / 2;
  bodyGroup.add(magRing);

  const thrusterCones: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.72), carbonMat);
    wing.position.set(side * 0.96, 0.04, -0.18);
    wing.rotation.y = side * 0.42;
    wing.castShadow = true;
    bodyGroup.add(wing);

    const wingTip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.95), hullMat);
    wingTip.position.set(side * 1.48, 0.08, 0.08);
    bodyGroup.add(wingTip);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 1.15, 10),
      new THREE.MeshBasicMaterial({ color: 0x00f5a0, transparent: true, opacity: 0.85 })
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(side * 0.42, 0.05, -1.78);
    bodyGroup.add(flame);
    thrusterCones.push(flame);
  }

  return { root, bodyGroup, hullMat, accentMat, thrusterCones };
}

function createAsphaltMicroReliefMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    let seed = 1337;
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = 90 + ((seed >>> 24) % 120);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

function createF1CircuitTexture(maxAnisotropy = 8): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size / 2; // corresponds to world r = 39.0

    // Base outer run-off tarmac
    ctx.fillStyle = '#141923';
    ctx.fillRect(0, 0, size, size);

    // Realistic dark Grand Prix asphalt ring (r = 12.2..38.5 -> 0.313..0.987 of maxR)
    const innerTrackPx = maxR * (12.2 / 39.0);
    const outerTrackPx = maxR * (38.5 / 39.0);
    const asphaltGrad = ctx.createRadialGradient(cx, cy, innerTrackPx, cx, cy, outerTrackPx);
    asphaltGrad.addColorStop(0, '#1e2430');
    asphaltGrad.addColorStop(0.22, '#272e3b');
    asphaltGrad.addColorStop(0.5, '#1d222c'); // darker rubberized racing groove
    asphaltGrad.addColorStop(0.78, '#262d3a');
    asphaltGrad.addColorStop(1, '#1b202b');
    ctx.fillStyle = asphaltGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, outerTrackPx, 0, Math.PI * 2);
    ctx.fill();

    // Fine mineral asphalt grain speckles along the track
    for (let i = 0; i < 6500; i++) {
      const ang = (i * 2.39996) % (Math.PI * 2);
      const frac = ((i * 7919) % 1000) / 1000;
      const rad = innerTrackPx + frac * (outerTrackPx - innerTrackPx);
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      const shade = i % 3 === 0 ? 'rgba(255,255,255,0.065)' : 'rgba(0,0,0,0.16)';
      ctx.fillStyle = shade;
      ctx.fillRect(px, py, 1.8, 1.8);
    }

    // Center infield FIA paddock turf island (r = 0..12.2)
    ctx.fillStyle = '#0f2922';
    ctx.beginPath();
    ctx.arc(cx, cy, innerTrackPx, 0, Math.PI * 2);
    ctx.fill();

    // Infield paddock concrete apron ring
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, innerTrackPx - 6, 0, Math.PI * 2);
    ctx.stroke();

    // Crisp FIA white track-limit boundary lines (inner r=13.0, outer r=37.5)
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * (13.0 / 39.0), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * (37.5 / 39.0), 0, Math.PI * 2);
    ctx.stroke();

    // Dashed racing center-line divider (r = 25.3)
    ctx.save();
    ctx.setLineDash([18, 18]);
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * (25.3 / 39.0), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Subtle glowing cyan telemetry lane guide & starting grid boxes near angle = 0
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * (21.5 / 39.0), 0, Math.PI * 2);
    ctx.stroke();

    // Starting grid slots behind start line (angle ~ -0.05..-0.28)
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
    ctx.lineWidth = 2.5;
    for (let g = 0; g < 6; g++) {
      const a = -0.07 - g * 0.055;
      const laneR = maxR * ((g % 2 === 0 ? 24.5 : 29.5) / 39.0);
      const gx = cx + Math.cos(a) * laneR;
      const gy = cy + Math.sin(a) * laneR;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-10, 12);
      ctx.lineTo(-10, -10);
      ctx.lineTo(10, -10);
      ctx.lineTo(10, 12);
      ctx.stroke();
      ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function addPerimeterBarrierWall(
  group: THREE.Group,
  radius: number,
  segments: number,
  wallHeight: number,
  primaryHex: number,
  secondaryHex: number,
  railHex: number
): void {
  const arcSpan = (Math.PI * 2 * radius) / segments;
  const blockGeo = new THREE.BoxGeometry(arcSpan * 0.96, wallHeight, 0.72);
  const matA = new THREE.MeshStandardMaterial({ color: primaryHex, roughness: 0.45, metalness: 0.35 });
  const matB = new THREE.MeshStandardMaterial({ color: secondaryHex, roughness: 0.55, metalness: 0.2 });

  const instA = new THREE.InstancedMesh(blockGeo, matA, Math.ceil(segments / 2));
  const instB = new THREE.InstancedMesh(blockGeo, matB, Math.floor(segments / 2));
  const dummy = new THREE.Object3D();
  let idxA = 0;
  let idxB = 0;
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI * 2) / segments;
    dummy.position.set(Math.cos(a) * radius, wallHeight * 0.5, Math.sin(a) * radius);
    dummy.rotation.set(0, -a + Math.PI / 2, 0);
    dummy.updateMatrix();
    if (i % 2 === 0) {
      instA.setMatrixAt(idxA++, dummy.matrix);
    } else {
      instB.setMatrixAt(idxB++, dummy.matrix);
    }
  }
  instA.computeBoundingSphere();
  instB.computeBoundingSphere();
  group.add(instA, instB);

  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.13, 8, 96),
    new THREE.MeshStandardMaterial({
      color: railHex,
      emissive: railHex,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.75,
    })
  );
  rail.rotation.x = Math.PI / 2;
  rail.position.y = wallHeight + 0.1;
  group.add(rail);
}

export function buildModeArenaProps(maxAnisotropy = 8): Record<ArenaModeId, THREE.Group> {
  // 1. F1 CYBER GRAND PRIX (Asphalt Circuit with PBR Bump/Roughness + Instanced Kerbs + Solid Barriers)
  const f1Group = new THREE.Group();
  const roadTex = createF1CircuitTexture(maxAnisotropy);
  const asphaltRelief = createAsphaltMicroReliefMap();
  const roadMesh = new THREE.Mesh(
    new THREE.CircleGeometry(39.0, 96),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: roadTex,
      bumpMap: asphaltRelief,
      bumpScale: 0.035,
      roughnessMap: asphaltRelief,
      roughness: 0.85,
      metalness: 0.06,
    })
  );
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.y = 0.032;
  roadMesh.receiveShadow = true;
  f1Group.add(roadMesh);

  const kerbRedMat = new THREE.MeshStandardMaterial({ color: 0xef1a4b, roughness: 0.42, metalness: 0.15 });
  const kerbWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65, metalness: 0.05 });

  // Batch all 48 outer kerbs into 2 InstancedMeshes (1 draw call per color)
  const outerKerbGeo = new THREE.BoxGeometry(2.35, 0.14, 0.92);
  const outerRedInst = new THREE.InstancedMesh(outerKerbGeo, kerbRedMat, 24);
  const outerWhiteInst = new THREE.InstancedMesh(outerKerbGeo, kerbWhiteMat, 24);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    const angle = (i * Math.PI * 2) / 48;
    dummy.position.set(Math.cos(angle) * 37.9, 0.07, Math.sin(angle) * 37.9);
    dummy.rotation.set(0, -angle + Math.PI / 2, 0);
    dummy.updateMatrix();
    if (i % 2 === 0) outerRedInst.setMatrixAt(i >> 1, dummy.matrix);
    else outerWhiteInst.setMatrixAt(i >> 1, dummy.matrix);
  }
  outerRedInst.computeBoundingSphere();
  outerWhiteInst.computeBoundingSphere();
  f1Group.add(outerRedInst, outerWhiteInst);

  // Batch all 32 inner infield apex kerbs into 2 InstancedMeshes
  const innerKerbGeo = new THREE.BoxGeometry(1.35, 0.13, 0.62);
  const innerRedInst = new THREE.InstancedMesh(innerKerbGeo, kerbRedMat, 16);
  const innerWhiteInst = new THREE.InstancedMesh(innerKerbGeo, kerbWhiteMat, 16);
  for (let i = 0; i < 32; i++) {
    const angle = (i * Math.PI * 2) / 32;
    dummy.position.set(Math.cos(angle) * 12.6, 0.065, Math.sin(angle) * 12.6);
    dummy.rotation.set(0, -angle + Math.PI / 2, 0);
    dummy.updateMatrix();
    if (i % 2 === 0) innerWhiteInst.setMatrixAt(i >> 1, dummy.matrix);
    else innerRedInst.setMatrixAt(i >> 1, dummy.matrix);
  }
  innerRedInst.computeBoundingSphere();
  innerWhiteInst.computeBoundingSphere();
  f1Group.add(innerRedInst, innerWhiteInst);

  // Solid Outer & Inner F1 Safety Barriers (Tecpro Blocks + Steel Guardrail)
  addPerimeterBarrierWall(f1Group, 39.05, 48, 1.45, 0xef1a4b, 0xe2e8f0, 0x00f5ff);
  addPerimeterBarrierWall(f1Group, 11.75, 24, 1.25, 0x1e293b, 0xef1a4b, 0xef1a4b);

  // Infield Race Control Timing Tower in center island (composite multi-tier landmark)
  const towerBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.8, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.72 })
  );
  towerBase.position.y = 0.8;
  towerBase.castShadow = true;
  f1Group.add(towerBase);
  const towerSpire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1.35, 7.2, 8),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0xef1a4b,
      emissiveIntensity: 0.32,
      roughness: 0.3,
      metalness: 0.85,
    })
  );
  towerSpire.position.y = 4.6;
  towerSpire.castShadow = true;
  f1Group.add(towerSpire);
  const timingHalo = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.14, 10, 24),
    new THREE.MeshBasicMaterial({ color: 0x00f5ff })
  );
  timingHalo.rotation.x = Math.PI / 2;
  timingHalo.position.y = 7.4;
  f1Group.add(timingHalo);

  // 6 Holographic DRS Speed Boost Pads along racing line (r = 25.5)
  const padMat = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });
  const padCoreMat = new THREE.MeshBasicMaterial({
    color: 0x00f5a0,
    transparent: true,
    opacity: 0.45,
  });
  const padFrameGeo = new THREE.RingGeometry(1.65, 2.05, 4);
  const padCoreGeo = new THREE.CircleGeometry(1.45, 4);
  for (const pad of F1_BOOST_PADS) {
    const padGroup = new THREE.Group();
    padGroup.position.set(pad.x, 0.055, pad.z);
    padGroup.rotation.y = -pad.angle;

    const frame = new THREE.Mesh(padFrameGeo, padMat);
    frame.rotation.x = -Math.PI / 2;
    padGroup.add(frame);

    const core = new THREE.Mesh(padCoreGeo, padCoreMat);
    core.rotation.x = -Math.PI / 2;
    padGroup.add(core);
    f1Group.add(padGroup);
  }

  // Overhead DRS Start/Finish Gantry Arch spanning clear track (pillars behind barriers at 12.1 & 38.6)
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.82 });
  const pillarGeo = new THREE.BoxGeometry(0.82, 6.8, 0.82);
  for (const xOffset of [12.1, 38.6]) {
    const pillar = new THREE.Mesh(pillarGeo, gantryMat);
    pillar.position.set(xOffset, 3.4, 0);
    pillar.castShadow = true;
    f1Group.add(pillar);
  }
  const gantryBeam = new THREE.Mesh(new THREE.BoxGeometry(27.3, 0.9, 1.15), gantryMat);
  gantryBeam.position.set(25.35, 6.7, 0);
  gantryBeam.castShadow = true;
  f1Group.add(gantryBeam);

  // Batch Start/Finish checkered line (17 tiles -> 2 InstancedMeshes)
  const tileGeo = new THREE.BoxGeometry(1.36, 0.025, 1.18);
  const tileWhiteInst = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), 9);
  const tileDarkInst = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0x0f172a }), 8);
  let wIdx = 0;
  let dIdx = 0;
  for (let s = 0; s < 17; s++) {
    dummy.position.set(13.9 + s * 1.4, 0.048, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    if (s % 2 === 0) tileWhiteInst.setMatrixAt(wIdx++, dummy.matrix);
    else tileDarkInst.setMatrixAt(dIdx++, dummy.matrix);
  }
  tileWhiteInst.computeBoundingSphere();
  tileDarkInst.computeBoundingSphere();
  f1Group.add(tileWhiteInst, tileDarkInst);

  // 5 Glowing FIA Starting Lights on Overhead Gantry (shared geo + mat)
  const startPodGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.25, 12);
  const startPodMat = new THREE.MeshBasicMaterial({ color: 0xef1a4b });
  for (let l = -2; l <= 2; l++) {
    const lightPod = new THREE.Mesh(startPodGeo, startPodMat);
    lightPod.rotation.x = Math.PI / 2;
    lightPod.position.set(25.35 + l * 2.4, 6.7, 0);
    f1Group.add(lightPod);
  }

  // 2. CYBER TANK DUEL: 10 Composite 4-Part Armored Cover Bunkers + 6 Sensor Towers + Solid Barrier
  const tankGroup = new THREE.Group();
  addPerimeterBarrierWall(tankGroup, 39.05, 36, 1.55, 0x1e293b, 0x0f172a, 0x00f5ff);
  const bunkerPlinthMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72, metalness: 0.35 });
  const bunkerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.78 });
  const hazardMat = new THREE.MeshStandardMaterial({
    color: 0x00f5ff,
    emissive: 0x00f5ff,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const plinthGeo = new THREE.BoxGeometry(1.75, 0.24, 4.45);
  const bunkerWallGeo = new THREE.BoxGeometry(1.28, 1.55, 4.05);
  const bunkerSlantGeo = new THREE.BoxGeometry(0.55, 1.25, 3.85);
  const bunkerTrimGeo = new THREE.BoxGeometry(1.36, 0.14, 3.6);

  for (let i = 0; i < TANK_BUNKERS.length; i++) {
    const b = TANK_BUNKERS[i];
    const angle = Math.atan2(b.z, b.x);
    const bunker = new THREE.Group();
    bunker.position.set(b.x, 0, b.z);
    bunker.rotation.y = -angle;

    const plinth = new THREE.Mesh(plinthGeo, bunkerPlinthMat);
    plinth.position.y = 0.12;
    plinth.receiveShadow = true;
    bunker.add(plinth);

    const wall = new THREE.Mesh(bunkerWallGeo, bunkerMat);
    wall.position.y = 0.92;
    wall.castShadow = true;
    wall.receiveShadow = true;
    bunker.add(wall);

    const slant = new THREE.Mesh(bunkerSlantGeo, bunkerMat);
    slant.position.set(0.52, 0.72, 0);
    slant.rotation.z = -0.35;
    slant.castShadow = true;
    bunker.add(slant);

    const trim = new THREE.Mesh(bunkerTrimGeo, hazardMat);
    trim.position.y = 1.72;
    bunker.add(trim);
    tankGroup.add(bunker);
  }

  const mastGeo = new THREE.CylinderGeometry(0.4, 0.65, 6.2, 8);
  const mastBaseGeo = new THREE.CylinderGeometry(0.95, 1.15, 0.55, 8);
  const beaconGeo = new THREE.OctahedronGeometry(0.75, 0);
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6 + Math.PI / 6;
    const tower = new THREE.Group();
    tower.position.set(Math.cos(angle) * 36.8, 0, Math.sin(angle) * 36.8);
    const towerFoot = new THREE.Mesh(mastBaseGeo, bunkerPlinthMat);
    towerFoot.position.y = 0.275;
    const mast = new THREE.Mesh(mastGeo, bunkerMat);
    mast.position.y = 3.1;
    mast.castShadow = true;
    const beacon = new THREE.Mesh(beaconGeo, hazardMat);
    beacon.position.y = 6.7;
    tower.add(towerFoot, mast, beacon);
    tankGroup.add(tower);
  }

  // 3. SLIP N BUMP 3D: 10 Composite Cryo-Crystal Clusters & Solid Cryo Perimeter Barrier
  const iceGroup = new THREE.Group();
  addPerimeterBarrierWall(iceGroup, 39.05, 36, 1.4, 0x0f172a, 0x1e293b, 0xffb703);
  const icePlinthMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.62, metalness: 0.45 });
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    emissive: 0x0284c7,
    emissiveIntensity: 0.48,
    roughness: 0.12,
    metalness: 0.2,
    clearcoat: 1.0,
    flatShading: true,
  });
  const crystalMainGeo = new THREE.ConeGeometry(1.15, 5.2, 5);
  const crystalSideGeo = new THREE.ConeGeometry(0.68, 3.1, 5);
  const crystalBaseGeo = new THREE.CylinderGeometry(1.6, 1.9, 0.42, 6);
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI * 2) / 10;
    const cluster = new THREE.Group();
    cluster.position.set(Math.cos(angle) * 34.5, 0, Math.sin(angle) * 34.5);

    const base = new THREE.Mesh(crystalBaseGeo, icePlinthMat);
    base.position.y = 0.21;
    const mainSpire = new THREE.Mesh(crystalMainGeo, crystalMat);
    mainSpire.position.y = 2.6;
    mainSpire.castShadow = true;
    const shardL = new THREE.Mesh(crystalSideGeo, crystalMat);
    shardL.position.set(-0.78, 1.45, 0.35);
    shardL.rotation.z = 0.26;
    const shardR = new THREE.Mesh(crystalSideGeo, crystalMat);
    shardR.position.set(0.75, 1.35, -0.32);
    shardR.rotation.z = -0.28;
    cluster.add(base, mainSpire, shardL, shardR);
    iceGroup.add(cluster);
  }

  // 4. STAR BRAWLER ZERO-G: 8 Composite Orbital Jump Gates + Solid Containment Barrier
  const zerogGroup = new THREE.Group();
  addPerimeterBarrierWall(zerogGroup, 39.05, 36, 1.4, 0x0f172a, 0x1e293b, 0x00f5a0);
  const gatePylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.78 });
  const gateMat = new THREE.MeshStandardMaterial({
    color: 0x00f5a0,
    emissive: 0x00f5a0,
    emissiveIntensity: 0.95,
    roughness: 0.15,
  });
  const gateRingGeo = new THREE.TorusGeometry(2.8, 0.18, 10, 32);
  const gateStanchionGeo = new THREE.BoxGeometry(0.42, 2.8, 0.56);
  for (let i = 0; i < ZEROG_GATES.length; i++) {
    const g = ZEROG_GATES[i];
    const gateGroup = new THREE.Group();
    gateGroup.position.set(g.x, 0, g.z);
    gateGroup.rotation.y = -g.angle;

    const ring = new THREE.Mesh(gateRingGeo, gateMat);
    ring.position.y = 3.0;
    const leftPost = new THREE.Mesh(gateStanchionGeo, gatePylonMat);
    leftPost.position.set(-2.65, 1.4, 0);
    const rightPost = new THREE.Mesh(gateStanchionGeo, gatePylonMat);
    rightPost.position.set(2.65, 1.4, 0);
    gateGroup.add(ring, leftPost, rightPost);
    zerogGroup.add(gateGroup);
  }

  return {
    f1: f1Group,
    tank: tankGroup,
    ice: iceGroup,
    zerog: zerogGroup,
  };
}
