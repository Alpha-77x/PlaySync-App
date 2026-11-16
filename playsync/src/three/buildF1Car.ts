import * as THREE from 'three';

export interface F1CarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  f1LiveryMat: THREE.MeshPhysicalMaterial;
  accentMat: THREE.MeshStandardMaterial;
  drsFlap: THREE.Group;
  rainLightMat: THREE.MeshStandardMaterial;
  wheelMeshes: THREE.Group[];
  frontWheelPivots: THREE.Group[];
  steeringWheel: THREE.Group;
  nitroFlames: THREE.Mesh[];
}

export function buildDetailedF1Car(
  initialLiveryHex: string,
  shadowTex: THREE.Texture
): F1CarRig {
  const root = new THREE.Group();

  // Soft radial ground shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 6.2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.025, 0.25);
  root.add(shadow);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Materials
  const f1LiveryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(initialLiveryHex),
    roughness: 0.18,
    metalness: 0.55,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x121826,
    roughness: 0.48,
    metalness: 0.42,
  });

  const darkCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.62,
    metalness: 0.3,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.28,
    metalness: 0.88,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x00f5ff,
    emissive: 0x00f5ff,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.5,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x0b0e14,
    roughness: 0.86,
    metalness: 0.05,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.92,
  });

  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xef1a4b,
    roughness: 0.35,
    metalness: 0.5,
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.08,
    metalness: 0.9,
    clearcoat: 1.0,
  });

  const rainLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1e42,
    emissive: 0xff1e42,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  // 1. VENTURI FLOOR PLANK & REAR DIFFUSER
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-0.46, 1.35);
  floorShape.lineTo(0.46, 1.35);
  floorShape.lineTo(0.98, 0.85);
  floorShape.lineTo(1.02, -1.55);
  floorShape.lineTo(0.68, -2.05);
  floorShape.lineTo(-0.68, -2.05);
  floorShape.lineTo(-1.02, -1.55);
  floorShape.lineTo(-0.98, 0.85);
  floorShape.closePath();

  const floorGeo = new THREE.ExtrudeGeometry(floorShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  floorGeo.rotateX(Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, darkCarbonMat);
  floorMesh.position.set(0, 0.14, 0);
  floorMesh.castShadow = true;
  floorMesh.receiveShadow = true;
  bodyGroup.add(floorMesh);

  // Floor edge glowing aero trim strips
  for (const side of [-1, 1]) {
    const edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 2.35), accentMat);
    edgeStrip.position.set(side * 1.01, 0.14, -0.35);
    bodyGroup.add(edgeStrip);

    // Bargeboard aero turning vanes ahead of sidepods
    const bargeVane = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.48), carbonMat);
    bargeVane.position.set(side * 0.72, 0.27, 1.02);
    bargeVane.rotation.y = side * 0.22;
    bodyGroup.add(bargeVane);
  }

  // Rear Venturi Diffuser Strakes (5 vertical fins under rear wing)
  for (let i = -2; i <= 2; i++) {
    const strake = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.56), darkCarbonMat);
    strake.position.set(i * 0.22, 0.2, -1.96);
    strake.rotation.x = -0.22;
    bodyGroup.add(strake);
  }

  // 2. SCULPTED MONOCOQUE CHASSIS & STEPPED NOSE CONE
  const monocoque = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.42, 2.15), f1LiveryMat);
  monocoque.position.set(0, 0.38, 0.22);
  monocoque.castShadow = true;
  bodyGroup.add(monocoque);

  // Tapered sculpted nose (two-stage sleek F1 nose)
  const noseBase = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.28, 1.1), f1LiveryMat);
  noseBase.position.set(0, 0.34, 1.72);
  noseBase.rotation.x = 0.08;
  noseBase.castShadow = true;
  bodyGroup.add(noseBase);

  const noseTip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.88), f1LiveryMat);
  noseTip.position.set(0, 0.24, 2.58);
  noseTip.rotation.x = 0.1;
  noseTip.castShadow = true;
  bodyGroup.add(noseTip);

  // Nose tip vanity cap + pitot sensor mast
  const noseCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), f1LiveryMat);
  noseCap.scale.set(1.15, 0.52, 1.6);
  noseCap.position.set(0, 0.2, 3.02);
  bodyGroup.add(noseCap);

  const pitotTube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.24, 6), titaniumMat);
  pitotTube.position.set(0, 0.45, 2.08);
  pitotTube.rotation.x = 0.22;
  bodyGroup.add(pitotTube);

  // Nose telemetry stripe
  const noseStripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 1.7), accentMat);
  noseStripe.position.set(0, 0.37, 1.98);
  noseStripe.rotation.x = 0.1;
  bodyGroup.add(noseStripe);

  // 3. UNDERCUT SIDEPODS, RADIATOR INTAKES & COOLING LOUVERS
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 1.85), f1LiveryMat);
    pod.position.set(side * 0.65, 0.35, -0.18);
    pod.castShadow = true;
    bodyGroup.add(pod);

    // Tapered rear engine cover sweep
    const podTail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.86), f1LiveryMat);
    podTail.position.set(side * 0.46, 0.33, -1.25);
    podTail.rotation.y = side * -0.22;
    bodyGroup.add(podTail);

    // Recessed dark radiator intake scoop
    const intakeFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.14), carbonMat);
    intakeFrame.position.set(side * 0.65, 0.38, 0.74);
    bodyGroup.add(intakeFrame);

    const intakeCore = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.06), darkCarbonMat);
    intakeCore.position.set(side * 0.65, 0.38, 0.79);
    bodyGroup.add(intakeCore);

    // Sidepod cooling gill louvers
    for (let g = 0; g < 4; g++) {
      const gill = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.08), darkCarbonMat);
      gill.position.set(side * 0.64, 0.54, 0.18 - g * 0.18);
      bodyGroup.add(gill);
    }

    // Wing mirrors on sleek stalks
    const mirrorStalk = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.04), carbonMat);
    mirrorStalk.position.set(side * 0.56, 0.59, 0.62);
    bodyGroup.add(mirrorStalk);

    const mirrorPod = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.075, 0.12), f1LiveryMat);
    mirrorPod.position.set(side * 0.68, 0.62, 0.62);
    bodyGroup.add(mirrorPod);
  }

  // 4. RECESSED COCKPIT, DRIVER HELMET, F1 STEERING WHEEL & 3-POINT TITANIUM HALO
  const cockpitTrim = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.92), darkCarbonMat);
  cockpitTrim.position.set(0, 0.59, 0.18);
  bodyGroup.add(cockpitTrim);

  // Recessed cockpit headrest pad
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.24), darkCarbonMat);
  headrest.position.set(0, 0.64, -0.18);
  bodyGroup.add(headrest);

  // Driver Helmet + Tinted Visor
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), f1LiveryMat);
  helmet.position.set(0, 0.68, 0.08);
  bodyGroup.add(helmet);

  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.196, 0.196, 0.09, 16, 1, false, -0.9, 1.8),
    visorMat
  );
  visor.position.set(0, 0.7, 0.09);
  bodyGroup.add(visor);

  // F1 Carbon Steering Wheel (rotates dynamically with steering!)
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(0, 0.62, 0.44);
  steeringWheel.rotation.x = -0.35;

  const wheelPlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.03), carbonMat);
  steeringWheel.add(wheelPlate);
  const wheelScreen = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.036), accentMat);
  wheelScreen.position.y = 0.015;
  steeringWheel.add(wheelScreen);
  bodyGroup.add(steeringWheel);

  // 3-Point Titanium Halo via TubeGeometry
  const haloCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.27, 0.62, -0.18),
    new THREE.Vector3(-0.29, 0.76, 0.14),
    new THREE.Vector3(0, 0.78, 0.46),
    new THREE.Vector3(0.29, 0.76, 0.14),
    new THREE.Vector3(0.27, 0.62, -0.18),
  ]);
  const haloRing = new THREE.Mesh(new THREE.TubeGeometry(haloCurve, 24, 0.034, 10, false), carbonMat);
  haloRing.castShadow = true;
  bodyGroup.add(haloRing);

  const haloPillarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.56, 0.62),
    new THREE.Vector3(0, 0.68, 0.54),
    new THREE.Vector3(0, 0.78, 0.46),
  ]);
  const haloPillar = new THREE.Mesh(new THREE.TubeGeometry(haloPillarCurve, 8, 0.03, 8, false), carbonMat);
  bodyGroup.add(haloPillar);

  // 5. ROLL-HOOP AIRBOX, T-CAM POD & DORSAL SHARK FIN
  const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.96), f1LiveryMat);
  airbox.position.set(0, 0.78, -0.45);
  airbox.castShadow = true;
  bodyGroup.add(airbox);

  const airboxMouth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.06), darkCarbonMat);
  airboxMouth.position.set(0, 0.84, 0.04);
  bodyGroup.add(airboxMouth);

  // Dorsal Shark Fin spine
  const sharkFinShape = new THREE.Shape();
  sharkFinShape.moveTo(0, 0);
  sharkFinShape.lineTo(-1.05, -0.12);
  sharkFinShape.lineTo(-1.05, -0.42);
  sharkFinShape.lineTo(0, -0.38);
  sharkFinShape.closePath();
  const sharkFinGeo = new THREE.ExtrudeGeometry(sharkFinShape, {
    depth: 0.036,
    bevelEnabled: false,
  });
  sharkFinGeo.rotateY(Math.PI / 2);
  const sharkFin = new THREE.Mesh(sharkFinGeo, f1LiveryMat);
  sharkFin.position.set(-0.018, 0.94, -0.58);
  bodyGroup.add(sharkFin);

  // Overhead T-Cam Broadcast Pod
  const tCamStalk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.08), carbonMat);
  tCamStalk.position.set(0, 0.99, -0.22);
  const tCamBar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.045, 0.09), accentMat);
  tCamBar.position.set(0, 1.06, -0.22);
  bodyGroup.add(tCamStalk, tCamBar);

  // 6. MULTI-ELEMENT FRONT WING + VORTEX ENDPLATES & DIVEPLANES
  const frontWingGroup = new THREE.Group();
  frontWingGroup.position.set(0, 0.16, 2.86);

  const fwMain = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.045, 0.34), carbonMat);
  fwMain.position.set(0, 0, 0.14);
  fwMain.castShadow = true;
  frontWingGroup.add(fwMain);

  const fwFlap1 = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.038, 0.24), f1LiveryMat);
  fwFlap1.position.set(0, 0.055, -0.02);
  fwFlap1.rotation.x = -0.24;
  frontWingGroup.add(fwFlap1);

  const fwFlap2 = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.034, 0.18), accentMat);
  fwFlap2.position.set(0, 0.11, -0.15);
  fwFlap2.rotation.x = -0.38;
  frontWingGroup.add(fwFlap2);

  for (const side of [-1, 1]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.72), f1LiveryMat);
    ep.position.set(side * 1.28, 0.09, -0.02);
    ep.castShadow = true;
    frontWingGroup.add(ep);

    const diveplane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.32), accentMat);
    diveplane.position.set(side * 1.33, 0.14, -0.08);
    diveplane.rotation.x = -0.2;
    frontWingGroup.add(diveplane);

    const footplate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.7), carbonMat);
    footplate.position.set(side * 1.32, -0.03, -0.02);
    frontWingGroup.add(footplate);
  }
  bodyGroup.add(frontWingGroup);

  // 7. SWAN-NECK REAR DRS WING + ENDPLATES + ACTUATOR POD
  const rearWingGroup = new THREE.Group();
  rearWingGroup.position.set(0, 0.96, -1.94);

  const rwMain = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.05, 0.36), carbonMat);
  rwMain.castShadow = true;
  rearWingGroup.add(rwMain);

  // Articulated DRS Flap
  const drsFlap = new THREE.Group();
  drsFlap.position.set(0, 0.1, -0.1);
  const drsMesh = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.04, 0.22), f1LiveryMat);
  drsMesh.rotation.x = -0.32;
  drsFlap.add(drsMesh);
  const drsLip = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.02, 0.04), accentMat);
  drsLip.position.set(0, 0.035, -0.1);
  drsFlap.add(drsLip);
  rearWingGroup.add(drsFlap);

  // Central DRS actuator pod & twin swan-neck pylons
  const drsPod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.28), carbonMat);
  drsPod.position.set(0, 0.08, 0.06);
  rearWingGroup.add(drsPod);

  for (const side of [-1, 1]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.22), carbonMat);
    pylon.position.set(side * 0.22, -0.32, 0.16);
    pylon.rotation.x = -0.18;
    rearWingGroup.add(pylon);

    const rwEndplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.62), f1LiveryMat);
    rwEndplate.position.set(side * 1.0, -0.22, -0.04);
    rwEndplate.castShadow = true;
    rearWingGroup.add(rwEndplate);

    const rwLouvers = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.22), accentMat);
    rwLouvers.position.set(side * 1.0, 0.04, -0.12);
    rearWingGroup.add(rwLouvers);
  }
  bodyGroup.add(rearWingGroup);

  // 8. CENTRAL TITANIUM EXHAUST, FIA RAIN LIGHT & TWIN NITRO FLAMES
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 14), titaniumMat);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0, 0.42, -1.96);
  bodyGroup.add(exhaust);

  const rainLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.06), rainLightMat);
  rainLight.position.set(0, 0.26, -2.06);
  bodyGroup.add(rainLight);

  const nitroFlames: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 1.35, 12),
      new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        transparent: true,
        opacity: 0.85,
      })
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(side * 0.16, 0.42, -2.55);
    bodyGroup.add(flame);
    nitroFlames.push(flame);
  }

  // 9. OPEN WHEELS, BRAKE DISCS, CALIPERS & DOUBLE-WISHBONE SUSPENSION
  const wheelMeshes: THREE.Group[] = [];
  const frontWheelPivots: THREE.Group[] = [];

  function addWheelCorner(x: number, y: number, z: number, width: number, radius: number, isFront: boolean) {
    const side = x < 0 ? -1 : 1;

    // Suspension wishbones (fixed to chassis)
    const span = Math.abs(x) - 0.34;
    for (const dy of [-0.07, 0.08]) {
      for (const dz of [-0.14, 0.14]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, span, 6), carbonMat);
        arm.rotation.z = Math.PI / 2;
        arm.rotation.y = side * dz * 0.9;
        arm.position.set(side * (0.34 + span * 0.5), y + dy, z + dz * 0.5);
        bodyGroup.add(arm);
      }
    }

    // Brake Cooling Duct Scoop
    const brakeDuct = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.28), carbonMat);
    brakeDuct.position.set(x - side * (width * 0.5 + 0.05), y, z);
    bodyGroup.add(brakeDuct);

    // Steering pivot for front wheels
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    bodyGroup.add(pivot);
    if (isFront) {
      frontWheelPivots.push(pivot);
    }

    // Non-rotating Brake Caliper & Vented Brake Disc
    const brakeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, 0.05, 16),
      titaniumMat
    );
    brakeDisc.rotation.z = Math.PI / 2;
    brakeDisc.position.set(-side * (width * 0.22), 0, 0);
    pivot.add(brakeDisc);

    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.12), caliperMat);
    caliper.position.set(-side * (width * 0.22), 0.06, -0.12);
    pivot.add(caliper);

    // Spinning wheel & rim assembly
    const spinGroup = new THREE.Group();
    pivot.add(spinGroup);
    wheelMeshes.push(spinGroup);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 24), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    spinGroup.add(tire);

    // Tire sidewall compound stripe
    const sidewallStripe = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.78, 0.018, 8, 24),
      accentMat
    );
    sidewallStripe.rotation.y = Math.PI / 2;
    sidewallStripe.position.set(side * (width * 0.505), 0, 0);
    spinGroup.add(sidewallStripe);

    // Deep-dish multi-spoke rim + center lock nut
    const rimBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.015, 18),
      darkCarbonMat
    );
    rimBarrel.rotation.z = Math.PI / 2;
    spinGroup.add(rimBarrel);

    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, radius * 1.05, 0.045), rimMat);
      spoke.position.set(side * (width * 0.49), 0, 0);
      spoke.rotation.x = (s * Math.PI) / 5;
      spinGroup.add(spoke);
    }

    const centerLock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, width + 0.05, 10),
      caliperMat
    );
    centerLock.rotation.z = Math.PI / 2;
    spinGroup.add(centerLock);
  }

  // Front wheels (narrower)
  addWheelCorner(-1.18, 0.36, 1.88, 0.38, 0.36, true);
  addWheelCorner(1.18, 0.36, 1.88, 0.38, 0.36, true);
  // Rear wheels (wider traction slicks)
  addWheelCorner(-1.26, 0.42, -1.36, 0.54, 0.42, false);
  addWheelCorner(1.26, 0.42, -1.36, 0.54, 0.42, false);

  return {
    root,
    bodyGroup,
    f1LiveryMat,
    accentMat,
    drsFlap,
    rainLightMat,
    wheelMeshes,
    frontWheelPivots,
    steeringWheel,
    nitroFlames,
  };
}
