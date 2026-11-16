import * as THREE from 'three';

export interface CyberTankRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  turretGroup: THREE.Group;
  tankArmorMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  shieldMesh: THREE.Mesh;
  shieldMat: THREE.MeshBasicMaterial;
  radarDome: THREE.Group;
  opticsGroup: THREE.Group;
  barrelRecoilGroup: THREE.Group;
  muzzleFlashMat: THREE.MeshBasicMaterial;
  headlightsMat: THREE.MeshStandardMaterial;
  roadWheels: THREE.Mesh[];
}

export function buildDetailedCyberTank(
  initialArmorHex: string,
  shadowTex: THREE.Texture
): CyberTankRig {
  const root = new THREE.Group();

  // Ground contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 5.4),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.025, 0);
  root.add(shadow);

  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  // Materials
  const tankArmorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(initialArmorHex).lerp(new THREE.Color(0x162b46), 0.58),
    roughness: 0.44,
    metalness: 0.68,
  });

  const slateArmorMat = new THREE.MeshStandardMaterial({
    color: 0x162033,
    roughness: 0.5,
    metalness: 0.62,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x0b101b,
    roughness: 0.62,
    metalness: 0.72,
  });

  const gunmetalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.34,
    metalness: 0.88,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(initialArmorHex),
    emissive: new THREE.Color(initialArmorHex),
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.5,
  });

  const headlightsMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x7dd3fc,
    emissiveIntensity: 1.5,
    roughness: 0.15,
  });

  const roadWheels: THREE.Mesh[] = [];

  // 1. ARMORED TRACK PODS, ROAD WHEELS, SPROCKETS, CLEATS & REACTIVE SKIRTS
  function buildTrackPod(side: -1 | 1) {
    const pod = new THREE.Group();
    pod.position.set(side * 1.4, 0.36, 0);

    // Beveled track core silhouette
    const trackProfile = new THREE.Shape();
    trackProfile.moveTo(-1.82, -0.26);
    trackProfile.lineTo(1.78, -0.26);
    trackProfile.lineTo(2.05, 0.08);
    trackProfile.lineTo(1.7, 0.34);
    trackProfile.lineTo(-1.72, 0.34);
    trackProfile.lineTo(-2.02, 0.08);
    trackProfile.closePath();

    const trackGeo = new THREE.ExtrudeGeometry(trackProfile, {
      depth: 0.66,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    trackGeo.center();
    trackGeo.rotateY(Math.PI / 2);
    const trackCore = new THREE.Mesh(trackGeo, darkSteelMat);
    trackCore.castShadow = true;
    trackCore.receiveShadow = true;
    pod.add(trackCore);

    // 5 Road wheels + raised front idler & rear sprocket
    for (let w = 0; w < 5; w++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.7, 14), gunmetalMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, -0.12, -1.24 + w * 0.62);
      pod.add(wheel);
      roadWheels.push(wheel);
    }
    for (const endZ of [-1.72, 1.74]) {
      const sprocket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 12), slateArmorMat);
      sprocket.rotation.z = Math.PI / 2;
      sprocket.position.set(0, 0.08, endZ);
      pod.add(sprocket);
      roadWheels.push(sprocket);
    }

    // Segmented track tread cleats along top & front slope
    for (let t = 0; t < 11; t++) {
      const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.14), gunmetalMat);
      cleat.position.set(0, 0.37, -1.55 + t * 0.31);
      pod.add(cleat);
    }

    // Ballistic side skirt + 5 reactive ERA armor panels + illuminated cooling stripe
    const skirtBase = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 3.62), tankArmorMat);
    skirtBase.position.set(side * 0.38, 0.14, 0);
    skirtBase.castShadow = true;
    pod.add(skirtBase);

    for (let p = 0; p < 5; p++) {
      const eraPlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.62), slateArmorMat);
      eraPlate.position.set(side * 0.44, 0.16, -1.36 + p * 0.68);
      pod.add(eraPlate);
    }

    const sideGlow = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 3.32), accentMat);
    sideGlow.position.set(side * 0.48, 0.02, 0);
    pod.add(sideGlow);

    return pod;
  }

  chassisGroup.add(buildTrackPod(-1));
  chassisGroup.add(buildTrackPod(1));

  // 2. BEVELED CHOBHAM HULL + SLOPED GLACIS + BOW ERA + ENGINE POWERPACK
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.85, -0.32);
  hullShape.lineTo(1.55, -0.32);
  hullShape.lineTo(2.1, 0.02);
  hullShape.lineTo(1.45, 0.42);
  hullShape.lineTo(-1.65, 0.42);
  hullShape.lineTo(-1.92, 0.14);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 2.08,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  hullGeo.center();
  hullGeo.rotateY(Math.PI / 2);
  const mainHull = new THREE.Mesh(hullGeo, tankArmorMat);
  mainHull.position.set(0, 0.72, 0);
  mainHull.castShadow = true;
  mainHull.receiveShadow = true;
  chassisGroup.add(mainHull);

  // 6 Angled Bow ERA Bricks across upper front glacis
  for (let i = 0; i < 6; i++) {
    const x = -0.82 + i * 0.328;
    const brick = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.24), slateArmorMat);
    brick.position.set(x, 0.92, 1.72);
    brick.rotation.x = 0.56;
    brick.castShadow = true;
    chassisGroup.add(brick);
  }

  // Twin Armored LED Headlights & Front Tow Shackles
  for (const side of [-1, 1]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.16), darkSteelMat);
    housing.position.set(side * 0.94, 0.94, 1.88);
    chassisGroup.add(housing);

    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.04), headlightsMat);
    lens.position.set(side * 0.94, 0.94, 1.97);
    chassisGroup.add(lens);

    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 12), gunmetalMat);
    shackle.position.set(side * 0.68, 0.64, 2.08);
    chassisGroup.add(shackle);
  }

  // Rear Fusion Powerpack & Radiator Grilles
  const powerDeck = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.12, 0.96), darkSteelMat);
  powerDeck.position.set(0, 1.14, -1.22);
  chassisGroup.add(powerDeck);

  for (const side of [-1, 1]) {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.72, 10), accentMat);
    cell.rotation.x = Math.PI / 2;
    cell.position.set(side * 0.45, 1.18, -1.25);
    chassisGroup.add(cell);

    const exhaustGrille = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.1), gunmetalMat);
    exhaustGrille.position.set(side * 0.58, 0.88, -1.94);
    chassisGroup.add(exhaustGrille);
  }

  // 3. FACETED STEALTH TURRET, OPTICS, SMOKE LAUNCHERS, RADAR & RAILGUN
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, 1.24, 0.14);
  chassisGroup.add(turretGroup);

  const turretShape = new THREE.Shape();
  turretShape.moveTo(-0.82, 1.15);
  turretShape.lineTo(0.82, 1.15);
  turretShape.lineTo(1.26, 0.35);
  turretShape.lineTo(1.16, -0.95);
  turretShape.lineTo(0.72, -1.38);
  turretShape.lineTo(-0.72, -1.38);
  turretShape.lineTo(-1.16, -0.95);
  turretShape.lineTo(-1.26, 0.35);
  turretShape.closePath();

  const turretGeo = new THREE.ExtrudeGeometry(turretShape, {
    depth: 0.46,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  turretGeo.center();
  turretGeo.rotateX(Math.PI / 2);
  const turretBody = new THREE.Mesh(turretGeo, tankArmorMat);
  turretBody.position.y = 0.22;
  turretBody.castShadow = true;
  turretGroup.add(turretBody);

  // Armored turret ring collar & rear bustle ammo rack + blowout panels
  const turretCollar = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.24, 0.12, 16), darkSteelMat);
  turretCollar.position.y = -0.04;
  turretGroup.add(turretCollar);

  const bustleRack = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.36, 0.76), slateArmorMat);
  bustleRack.position.set(0, 0.24, -1.24);
  bustleRack.castShadow = true;
  turretGroup.add(bustleRack);

  for (const side of [-1, 1]) {
    const blowoutPanel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.56), gunmetalMat);
    blowoutPanel.position.set(side * 0.38, 0.44, -1.24);
    turretGroup.add(blowoutPanel);
  }

  // Turret cheek composite blocks & smoke grenade dischargers
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.85), slateArmorMat);
    cheek.position.set(side * 0.88, 0.22, 0.56);
    cheek.rotation.y = side * -0.45;
    turretGroup.add(cheek);

    // 4-Tube Smoke Grenade Discharger Cluster
    const launcherPod = new THREE.Group();
    launcherPod.position.set(side * 1.15, 0.24, -0.15);
    launcherPod.rotation.y = side * 0.45;
    for (let g = 0; g < 4; g++) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8), gunmetalMat);
      tube.rotation.x = Math.PI / 3;
      tube.position.set(0, (g % 2) * 0.1, Math.floor(g / 2) * 0.12 - 0.06);
      launcherPod.add(tube);
    }
    turretGroup.add(launcherPod);
  }

  // Commander's Panoramic Thermal Sight (rotating opticsGroup)
  const opticsGroup = new THREE.Group();
  opticsGroup.position.set(-0.56, 0.62, -0.18);
  const cupolaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.18, 12), slateArmorMat);
  opticsGroup.add(cupolaBase);
  const sightHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.26), darkSteelMat);
  sightHead.position.y = 0.16;
  opticsGroup.add(sightHead);
  const sightLens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), accentMat);
  sightLens.position.set(0, 0.16, 0.14);
  opticsGroup.add(sightLens);
  turretGroup.add(opticsGroup);

  // Gunner's Primary Sight Housing
  const gunnerSight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.34), slateArmorMat);
  gunnerSight.position.set(0.54, 0.56, 0.46);
  const gunnerWindow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.04), accentMat);
  gunnerWindow.position.set(0.54, 0.56, 0.64);
  turretGroup.add(gunnerSight, gunnerWindow);

  // Active Protection Radar Dome (spins continuously)
  const radarDome = new THREE.Group();
  radarDome.position.set(0.28, 0.62, -0.78);
  const radarPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.16, 10), gunmetalMat);
  radarDome.add(radarPedestal);
  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.12), accentMat);
  radarBar.position.y = 0.12;
  radarDome.add(radarBar);
  turretGroup.add(radarDome);

  // Whip Communications Antennas
  for (const side of [-1, 1]) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 1.15, 6), gunmetalMat);
    antenna.position.set(side * 0.62, 0.98, -1.16);
    antenna.rotation.x = -0.14;
    turretGroup.add(antenna);
  }

  // Heavy Gun Mantlet & Recoiling Electromagnetic Railgun Barrel
  const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.44, 0.62), gunmetalMat);
  mantlet.position.set(0, 0.18, 1.05);
  mantlet.castShadow = true;
  turretGroup.add(mantlet);

  const barrelRecoilGroup = new THREE.Group();
  barrelRecoilGroup.position.set(0, 0.18, 1.25);
  turretGroup.add(barrelRecoilGroup);

  // Main fluted railgun barrel
  const mainBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.7, 14), darkSteelMat);
  mainBarrel.rotation.x = Math.PI / 2;
  mainBarrel.position.z = 1.35;
  mainBarrel.castShadow = true;
  barrelRecoilGroup.add(mainBarrel);

  // Upper & lower electromagnetic accelerator rails
  for (const ry of [-0.14, 0.14]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 2.45), gunmetalMat);
    rail.position.set(0, ry, 1.25);
    barrelRecoilGroup.add(rail);
  }

  // Bore evacuator collar
  const boreEvac = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.48, 14), slateArmorMat);
  boreEvac.rotation.x = Math.PI / 2;
  boreEvac.position.z = 1.05;
  barrelRecoilGroup.add(boreEvac);

  // 4 Glowing Induction Coil Rings
  for (let c = 0; c < 4; c++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.026, 8, 16), accentMat);
    ring.position.z = 1.48 + c * 0.3;
    barrelRecoilGroup.add(ring);
  }

  // Slotted Muzzle Brake + Muzzle Flash Cone
  const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.44), gunmetalMat);
  muzzleBrake.position.z = 2.72;
  barrelRecoilGroup.add(muzzleBrake);

  const muzzleFlashMat = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    transparent: true,
    opacity: 0,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.95, 10), muzzleFlashMat);
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.position.z = 3.35;
  barrelRecoilGroup.add(muzzleFlash);

  // Coaxial Rotary Autocannon beside main gun
  const coaxBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.25, 8), gunmetalMat);
  coaxBarrel.rotation.x = Math.PI / 2;
  coaxBarrel.position.set(0.32, 0.16, 1.65);
  turretGroup.add(coaxBarrel);

  // 4. PULSING HEXAGONAL ENERGY SHIELD DOME
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    wireframe: true,
    transparent: true,
    opacity: 0.16,
  });
  const shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2.75, 1), shieldMat);
  shieldMesh.position.y = 1.15;
  chassisGroup.add(shieldMesh);

  return {
    root,
    chassisGroup,
    turretGroup,
    tankArmorMat,
    accentMat,
    shieldMesh,
    shieldMat,
    radarDome,
    opticsGroup,
    barrelRecoilGroup,
    muzzleFlashMat,
    headlightsMat,
    roadWheels,
  };
}
