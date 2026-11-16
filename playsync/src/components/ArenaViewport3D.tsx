import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  type ArenaModeId,
  type CameraPreset,
  type ControlInput,
  type MatchPhase,
  type VehicleSimState,
  ARENA_MODES,
  F1_BOOST_PADS,
  TANK_BUNKERS,
  ZEROG_GATES,
  createInitialVehicleSim,
  stepVehicleSimulation,
} from '../engine/arenaLogic';
import type { RemoteActionEvent } from '../hooks/useMultiplayerRoom';
import type { PlayerNetTransform } from '../shared/multiplayerProtocol';
import {
  type HoverPodRig,
  buildCryoBumperPod,
  buildModeArenaProps,
  buildZeroGStriker,
} from '../three/buildArenaPods';
import { type CyberTankRig, buildDetailedCyberTank } from '../three/buildCyberTank';
import { type F1CarRig, buildDetailedF1Car } from '../three/buildF1Car';

export interface LiveTelemetry {
  speed: number;
  boostEnergy: number;
  score: number;
  driftPoints: number;
  hitsLanded: number;
  laps: number;
  isBoosting: boolean;
  isDrifting?: boolean;
}

interface ArenaViewport3DProps {
  activeMode: ArenaModeId;
  cameraPreset: CameraPreset;
  matchPhase: MatchPhase;
  liveryColor: string;
  controlInputRef: React.MutableRefObject<ControlInput>;
  actionPulseCounter: number;
  remoteVehiclesRef?: React.MutableRefObject<Map<string, PlayerNetTransform>>;
  remoteActionsRef?: React.MutableRefObject<RemoteActionEvent[]>;
  onTelemetryUpdate: (telemetry: LiveTelemetry) => void;
  onOrbCollect?: (points: number) => void;
  onBoostPad?: (points: number) => void;
  onLapComplete?: (lap: number, points: number) => void;
  onHitConfirmed?: (points: number, reason: string, targetClientId?: string) => void;
  onLocalStateEmit?: (state: {
    x: number;
    z: number;
    heading: number;
    speed: number;
    score: number;
    hits: number;
    isBoosting: boolean;
    shieldActive: boolean;
    turretAngle: number;
  }) => void;
  onActionEmit?: (
    actionType: 'fire' | 'surge' | 'wave' | 'pulse',
    x: number,
    z: number,
    heading: number
  ) => void;
}

const MAX_RIVALS = 4;

// Pre-allocated scratch math helpers outside the render loop (zero GC)
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 1.4, 0);
const _scratchColor = new THREE.Color();
const _tankArmorBase = new THREE.Color(0x162b46);

function createArenaSurfaceTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    const grad = ctx.createRadialGradient(cx, cy, 24, cx, cy, size * 0.5);
    grad.addColorStop(0, '#0a1429');
    grad.addColorStop(0.55, '#04070e');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(0, 245, 255, 0.14)';
    ctx.lineWidth = 3;
    for (let r = 110; r <= 470; r += 72) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 80, cy + Math.sin(a) * 80);
      ctx.lineTo(cx + Math.cos(a) * 490, cy + Math.sin(a) * 490);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.68)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function angleLerp(current: number, target: number, lambda: number, dt: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

export const ArenaViewport3D: React.FC<ArenaViewport3DProps> = ({
  activeMode,
  cameraPreset,
  matchPhase,
  liveryColor,
  controlInputRef,
  actionPulseCounter,
  remoteVehiclesRef,
  remoteActionsRef,
  onTelemetryUpdate,
  onOrbCollect,
  onBoostPad,
  onLapComplete,
  onHitConfirmed,
  onLocalStateEmit,
  onActionEmit,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const modeRef = useRef<ArenaModeId>(activeMode);
  const cameraPresetRef = useRef<CameraPreset>(cameraPreset);
  const phaseRef = useRef<MatchPhase>(matchPhase);
  const liveryRef = useRef<string>(liveryColor);
  const telemetryCbRef = useRef(onTelemetryUpdate);
  const orbCbRef = useRef(onOrbCollect);
  const boostPadCbRef = useRef(onBoostPad);
  const lapCbRef = useRef(onLapComplete);
  const hitCbRef = useRef(onHitConfirmed);
  const stateEmitCbRef = useRef(onLocalStateEmit);
  const actionEmitCbRef = useRef(onActionEmit);

  const simStateRef = useRef<VehicleSimState>(createInitialVehicleSim(activeMode));
  const snapCamRef = useRef<boolean>(false);
  const pendingActionPulseRef = useRef<number>(0);
  const lastPulseCounterRef = useRef<number>(actionPulseCounter);

  useEffect(() => {
    const prevMode = modeRef.current;
    modeRef.current = activeMode;
    if (prevMode !== activeMode) {
      simStateRef.current = createInitialVehicleSim(activeMode);
      snapCamRef.current = true;
    }
  }, [activeMode]);

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    const prev = phaseRef.current;
    phaseRef.current = matchPhase;
    if (prev !== 'playing' && matchPhase === 'playing') {
      simStateRef.current = createInitialVehicleSim(modeRef.current);
      snapCamRef.current = true;
    }
  }, [matchPhase]);

  useEffect(() => {
    liveryRef.current = liveryColor;
  }, [liveryColor]);

  useEffect(() => {
    telemetryCbRef.current = onTelemetryUpdate;
  }, [onTelemetryUpdate]);

  useEffect(() => {
    orbCbRef.current = onOrbCollect;
  }, [onOrbCollect]);

  useEffect(() => {
    boostPadCbRef.current = onBoostPad;
  }, [onBoostPad]);

  useEffect(() => {
    lapCbRef.current = onLapComplete;
  }, [onLapComplete]);

  useEffect(() => {
    hitCbRef.current = onHitConfirmed;
  }, [onHitConfirmed]);

  useEffect(() => {
    stateEmitCbRef.current = onLocalStateEmit;
  }, [onLocalStateEmit]);

  useEffect(() => {
    actionEmitCbRef.current = onActionEmit;
  }, [onActionEmit]);

  useEffect(() => {
    if (actionPulseCounter > lastPulseCounterRef.current) {
      lastPulseCounterRef.current = actionPulseCounter;
      pendingActionPulseRef.current += 1;
    }
  }, [actionPulseCounter]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 240);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.0062);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 380);
    camera.position.set(0, 26.0, 52.0);
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 1.25);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e6, 2.5);
    keyLight.position.set(34, 52, 28);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 125;
    const d = 42;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const cyanRim = new THREE.DirectionalLight(0x00f5ff, 1.9);
    cyanRim.position.set(-34, 30, -28);
    scene.add(cyanRim);

    const centerPoint = new THREE.PointLight(0xff007f, 2.5, 92);
    centerPoint.position.set(0, 12, 0);
    scene.add(centerPoint);

    const arenaRoot = new THREE.Group();
    scene.add(arenaRoot);

    // Mega-Scale Arena Stage Floor (r = 40.2 -> Playable Boundary = 38.0)
    const surfaceTex = createArenaSurfaceTexture();
    surfaceTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const shadowTex = createContactShadowTexture();

    const stageMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(40.2, 42.4, 1.8, 72),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: surfaceTex,
        roughness: 0.42,
        metalness: 0.35,
      })
    );
    stageMesh.position.y = -0.9;
    stageMesh.receiveShadow = true;
    arenaRoot.add(stageMesh);

    const innerRingMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(39.4, 0.24, 14, 96), innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.04;
    arenaRoot.add(innerRing);

    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      transparent: true,
      opacity: 0.85,
    });
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(43.2, 0.16, 12, 96), outerRingMat);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = -0.22;
    arenaRoot.add(outerRing);

    // Extended Orbital Skyline Ring & Instanced Perimeter Beacon Pylons (Zero Void Edges)
    const horizonRing = new THREE.Mesh(
      new THREE.TorusGeometry(64, 0.42, 10, 96),
      new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.72 })
    );
    horizonRing.rotation.x = Math.PI / 2;
    horizonRing.position.y = -1.4;
    arenaRoot.add(horizonRing);

    const pylonGeo = new THREE.BoxGeometry(0.65, 3.6, 0.65);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x00f5ff,
      emissiveIntensity: 0.28,
      roughness: 0.4,
      metalness: 0.7,
    });
    const pylonInstanced = new THREE.InstancedMesh(pylonGeo, pylonMat, 16);
    const dummyObj = new THREE.Object3D();
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI * 2) / 16;
      dummyObj.position.set(Math.cos(a) * 40.6, 1.5, Math.sin(a) * 40.6);
      dummyObj.rotation.set(0, -a, 0);
      dummyObj.updateMatrix();
      pylonInstanced.setMatrixAt(i, dummyObj.matrix);
    }
    pylonInstanced.computeBoundingSphere();
    arenaRoot.add(pylonInstanced);

    // Mode-Specific Props (Strictly isolated per game)
    const modeProps = buildModeArenaProps();
    arenaRoot.add(modeProps.f1, modeProps.tank, modeProps.ice, modeProps.zerog);

    // Hero Vehicles + Rival Pools (Up to 4 multiplayer / AI rivals per mode)
    const rivalColors = ['#ffb703', '#8b5cf6', '#00f5a0', '#ef1a4b'];

    const f1Hero = buildDetailedF1Car(liveryRef.current, shadowTex);
    arenaRoot.add(f1Hero.root);
    const f1Rivals: F1CarRig[] = Array.from({ length: MAX_RIVALS }, (_, i) => {
      const rig = buildDetailedF1Car(rivalColors[i % rivalColors.length], shadowTex);
      rig.root.visible = false;
      arenaRoot.add(rig.root);
      return rig;
    });

    const tankHero = buildDetailedCyberTank(liveryRef.current, shadowTex);
    arenaRoot.add(tankHero.root);
    const tankRivals: CyberTankRig[] = Array.from({ length: MAX_RIVALS }, (_, i) => {
      const rig = buildDetailedCyberTank(rivalColors[i % rivalColors.length], shadowTex);
      rig.root.visible = false;
      arenaRoot.add(rig.root);
      return rig;
    });

    const iceHero = buildCryoBumperPod(liveryRef.current, shadowTex);
    arenaRoot.add(iceHero.root);
    const iceRivals: HoverPodRig[] = Array.from({ length: MAX_RIVALS }, (_, i) => {
      const rig = buildCryoBumperPod(rivalColors[i % rivalColors.length], shadowTex);
      rig.root.visible = false;
      arenaRoot.add(rig.root);
      return rig;
    });

    const zerogHero = buildZeroGStriker(liveryRef.current, shadowTex);
    arenaRoot.add(zerogHero.root);
    const zerogRivals: HoverPodRig[] = Array.from({ length: MAX_RIVALS }, (_, i) => {
      const rig = buildZeroGStriker(rivalColors[i % rivalColors.length], shadowTex);
      rig.root.visible = false;
      arenaRoot.add(rig.root);
      return rig;
    });

    // Collectible Energy Orbs (12 across inner r=17.5 & outer r=29.0)
    const orbs: Array<{ mesh: THREE.Mesh; angle: number; radius: number; active: boolean; respawn: number }> = [];
    const orbGeo = new THREE.OctahedronGeometry(0.62, 0);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x00f5a0,
      emissive: 0x00f5a0,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.6,
    });
    for (let i = 0; i < 12; i++) {
      const isInner = i < 4;
      const a = isInner ? ((i + 0.5) * Math.PI * 2) / 4 : ((i - 4) * Math.PI * 2) / 8 + Math.PI / 8;
      const r = isInner ? 18.5 : 29.0;
      const m = new THREE.Mesh(orbGeo, orbMat);
      m.position.set(Math.cos(a) * r, 0.92, Math.sin(a) * r);
      arenaRoot.add(m);
      orbs.push({ mesh: m, angle: a, radius: r, active: true, respawn: 0 });
    }

    // Pooled Projectiles & Shockwaves (for both player + remote multiplayer actions)
    const projectilePool: Array<{
      mesh: THREE.Mesh;
      active: boolean;
      fromSelf: boolean;
      life: number;
      maxLife: number;
      vx: number;
      vz: number;
      isRing: boolean;
    }> = [];
    const boltGeo = new THREE.SphereGeometry(0.32, 10, 10);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    const ringGeo = new THREE.RingGeometry(0.8, 1.2, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 20; i++) {
      const isRing = i >= 12;
      const mesh = new THREE.Mesh(isRing ? ringGeo : boltGeo, isRing ? ringMat.clone() : boltMat);
      if (isRing) mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      arenaRoot.add(mesh);
      projectilePool.push({
        mesh,
        active: false,
        fromSelf: false,
        life: 0,
        maxLife: 0.55,
        vx: 0,
        vz: 0,
        isRing,
      });
    }

    // Ambient Star Dust Particles across the expanded horizon
    const pCount = 220;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    const pColors = new Float32Array(pCount * 3);
    const palette = [
      new THREE.Color(0x00f5ff),
      new THREE.Color(0xff007f),
      new THREE.Color(0xffb703),
      new THREE.Color(0x00f5a0),
      new THREE.Color(0x8b5cf6),
    ];
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 110;
      pPos[i * 3 + 1] = Math.random() * 24 - 1.0;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 110;
      const c = palette[i % palette.length];
      pColors[i * 3] = c.r;
      pColors[i * 3 + 1] = c.g;
      pColors[i * 3 + 2] = c.b;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
    const particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, opacity: 0.78 })
    );
    arenaRoot.add(particles);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Keyboard & Pointer Input
    const keysDown = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
      keysDown.add(e.code);
      if (e.code === 'Space' && phaseRef.current === 'playing') {
        pendingActionPulseRef.current += 1;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
    };
    const clearKeys = () => keysDown.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);

    let orbitAzimuth = 0.35;
    let orbitElevation = 0.44;
    let orbitDistance = 46.0;
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      orbitAzimuth -= dx * 0.0065;
      orbitElevation = THREE.MathUtils.clamp(orbitElevation + dy * 0.0055, 0.18, 1.25);
    };
    const onPointerUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (cameraPresetRef.current !== 'orbit') return;
      orbitDistance = THREE.MathUtils.clamp(orbitDistance + e.deltaY * 0.03, 18, 76);
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('wheel', onWheel, { passive: true });

    const handleResize = () => {
      const w = Math.max(container.clientWidth, 300);
      const h = Math.max(container.clientHeight, 240);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsedTotal = 0;
    let lastTelemetryPush = 0;
    let simTrauma = 0;
    let tankRecoil = 0;
    let padCooldown = 0;
    let lapCooldown = 0;
    let driftSparkTimer = 0;
    let wasIceDrifting = false;
    let lapCount = 1;
    let prevZ = simStateRef.current.z;
    let aiFireTimer = 2.6;

    const activeRivalPositions: Array<{ x: number; z: number; clientId?: string }> = [];

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync && gl.deleteSync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function spawnRing(x: number, z: number, colorHex = 0xff007f) {
      const ringSlot = projectilePool.find((p) => !p.active && p.isRing);
      if (ringSlot) {
        ringSlot.active = true;
        ringSlot.fromSelf = false;
        ringSlot.life = 0.55;
        ringSlot.maxLife = 0.55;
        ringSlot.mesh.position.set(x, 0.25, z);
        ringSlot.mesh.scale.setScalar(1);
        const mat = ringSlot.mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(colorHex);
        mat.opacity = 0.9;
        ringSlot.mesh.visible = true;
      }
    }

    function spawnActionEffect(x: number, z: number, heading: number, mode: ArenaModeId, fromSelf: boolean) {
      if (mode === 'tank' || mode === 'zerog') {
        const slot = projectilePool.find((p) => !p.active && !p.isRing);
        if (slot) {
          slot.active = true;
          slot.fromSelf = fromSelf;
          slot.life = 1.15;
          slot.maxLife = 1.15;
          slot.vx = Math.sin(heading) * 34;
          slot.vz = Math.cos(heading) * 34;
          slot.mesh.position.set(x + Math.sin(heading) * 3.2, 1.38, z + Math.cos(heading) * 3.2);
          slot.mesh.visible = true;
        }
        if (mode === 'tank' && fromSelf) {
          tankRecoil = 1.0;
        }
      } else {
        spawnRing(x, z, mode === 'f1' ? 0x00f5ff : 0xffb703);
      }
      if (fromSelf) {
        simTrauma = Math.min(1, simTrauma + 0.35);
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const phase = phaseRef.current;
      const mode = modeRef.current;
      const modeSpec = ARENA_MODES[mode];

      if (phase !== 'paused') {
        elapsedTotal += dt;
        padCooldown = Math.max(0, padCooldown - dt);
        lapCooldown = Math.max(0, lapCooldown - dt);
      }

      // Reset lap count cleanly when back in lobby
      if (phase === 'lobby' && lapCount !== 1) {
        lapCount = 1;
      }

      // STRICT GAME ISOLATION
      f1Hero.root.visible = mode === 'f1';
      modeProps.f1.visible = mode === 'f1';
      tankHero.root.visible = mode === 'tank';
      modeProps.tank.visible = mode === 'tank';
      iceHero.root.visible = mode === 'ice';
      modeProps.ice.visible = mode === 'ice';
      zerogHero.root.visible = mode === 'zerog';
      modeProps.zerog.visible = mode === 'zerog';

      for (let i = 0; i < MAX_RIVALS; i++) {
        f1Rivals[i].root.visible = false;
        tankRivals[i].root.visible = false;
        iceRivals[i].root.visible = false;
        zerogRivals[i].root.visible = false;
      }

      // Dynamic Stage & Hero Livery Colors
      _scratchColor.set(modeSpec.accentColor);
      innerRingMat.color.lerp(_scratchColor, 1 - Math.exp(-6 * dt));
      centerPoint.color.lerp(_scratchColor, 1 - Math.exp(-6 * dt));

      _scratchColor.set(liveryRef.current);
      f1Hero.f1LiveryMat.color.lerp(_scratchColor, 1 - Math.exp(-8 * dt));
      tankHero.accentMat.color.lerp(_scratchColor, 1 - Math.exp(-8 * dt));
      tankHero.accentMat.emissive.lerp(_scratchColor, 1 - Math.exp(-8 * dt));
      iceHero.hullMat.color.lerp(_scratchColor, 1 - Math.exp(-8 * dt));
      zerogHero.hullMat.color.lerp(_scratchColor, 1 - Math.exp(-8 * dt));
      _scratchColor.lerp(_tankArmorBase, 0.58);
      tankHero.tankArmorMat.color.lerp(_scratchColor, 1 - Math.exp(-8 * dt));

      // Merge keyboard + touch gamepad input
      const kbX =
        (keysDown.has('KeyD') || keysDown.has('ArrowRight') ? 1 : 0) -
        (keysDown.has('KeyA') || keysDown.has('ArrowLeft') ? 1 : 0);
      const kbY =
        (keysDown.has('KeyW') || keysDown.has('ArrowUp') ? 1 : 0) -
        (keysDown.has('KeyS') || keysDown.has('ArrowDown') ? 1 : 0);
      const touch = controlInputRef.current;

      const mergedInput: ControlInput = {
        moveX: Math.abs(touch.moveX) > 0.05 ? touch.moveX : kbX,
        moveY: Math.abs(touch.moveY) > 0.05 ? touch.moveY : kbY,
        boost: touch.boost || keysDown.has('ShiftLeft') || keysDown.has('ShiftRight'),
        action: touch.action || keysDown.has('Space'),
        shield: touch.shield || keysDown.has('KeyE'),
      };

      const isPlayable = phase === 'playing';
      activeRivalPositions.length = 0;

      // Consume queued remote multiplayer action effects
      if (remoteActionsRef && remoteActionsRef.current.length > 0) {
        while (remoteActionsRef.current.length > 0) {
          const act = remoteActionsRef.current.shift();
          if (act) {
            spawnActionEffect(act.x, act.z, act.heading, mode, false);
          }
        }
      }

      if (isPlayable) {
        arenaRoot.rotation.y = THREE.MathUtils.damp(arenaRoot.rotation.y, 0, 5, dt);
        prevZ = simStateRef.current.z;
        simStateRef.current = stepVehicleSimulation(simStateRef.current, mergedInput, mode, dt);

        if (pendingActionPulseRef.current > 0) {
          pendingActionPulseRef.current = 0;
          simStateRef.current.score += 25;
          const totalHeading =
            simStateRef.current.heading + (mode === 'tank' ? tankHero.turretGroup.rotation.y : 0);
          spawnActionEffect(simStateRef.current.x, simStateRef.current.z, totalHeading, mode, true);
          const actionType =
            mode === 'tank' ? 'fire' : mode === 'f1' ? 'surge' : mode === 'ice' ? 'wave' : 'pulse';
          actionEmitCbRef.current?.(actionType, simStateRef.current.x, simStateRef.current.z, totalHeading);
          if (mode === 'f1' || mode === 'ice') {
            simStateRef.current.vx += Math.sin(simStateRef.current.heading) * 7.5;
            simStateRef.current.vz += Math.cos(simStateRef.current.heading) * 7.5;
          }
        }

        const sim = simStateRef.current;

        // F1 Holographic Boost Pads & Start/Finish Lap Line
        if (mode === 'f1') {
          if (padCooldown <= 0) {
            for (const pad of F1_BOOST_PADS) {
              const dx = sim.x - pad.x;
              const dz = sim.z - pad.z;
              if (dx * dx + dz * dz < 6.5) {
                padCooldown = 2.0;
                simStateRef.current.score += 75;
                simStateRef.current.boostEnergy = Math.min(100, simStateRef.current.boostEnergy + 38);
                simStateRef.current.vx += Math.sin(sim.heading) * 9.5;
                simStateRef.current.vz += Math.cos(sim.heading) * 9.5;
                spawnRing(pad.x, pad.z, 0x00f5a0);
                boostPadCbRef.current?.(75);
                break;
              }
            }
          }

          if (
            lapCooldown <= 0 &&
            sim.x >= 13.0 &&
            sim.x <= 37.4 &&
            ((prevZ < 0 && sim.z >= 0) || (prevZ > 0 && sim.z <= 0))
          ) {
            lapCooldown = 5.0;
            lapCount += 1;
            simStateRef.current.score += 200;
            simStateRef.current.boostEnergy = 100;
            spawnRing(sim.x, 0, 0xef1a4b);
            lapCbRef.current?.(lapCount, 200);
          }
        }

        // Zero-G Orbital Boost Ring Gates
        if (mode === 'zerog' && padCooldown <= 0) {
          for (const gate of ZEROG_GATES) {
            const dx = sim.x - gate.x;
            const dz = sim.z - gate.z;
            if (dx * dx + dz * dz < 8.0) {
              padCooldown = 2.0;
              simStateRef.current.score += 90;
              simStateRef.current.boostEnergy = Math.min(100, simStateRef.current.boostEnergy + 40);
              simStateRef.current.vx += Math.sin(sim.heading) * 8.0;
              simStateRef.current.vz += Math.cos(sim.heading) * 8.0;
              spawnRing(gate.x, gate.z, 0x00f5a0);
              boostPadCbRef.current?.(90);
              break;
            }
          }
        }

        // Update Local Hero Transform
        if (mode === 'f1') {
          f1Hero.root.position.set(sim.x, 0, sim.z);
          f1Hero.root.rotation.y = sim.heading;
          f1Hero.bodyGroup.rotation.z = THREE.MathUtils.damp(f1Hero.bodyGroup.rotation.z, -mergedInput.moveX * 0.11, 8, dt);
          f1Hero.steeringWheel.rotation.z = THREE.MathUtils.damp(f1Hero.steeringWheel.rotation.z, -mergedInput.moveX * 0.55, 10, dt);
          for (const pivot of f1Hero.frontWheelPivots) {
            pivot.rotation.y = THREE.MathUtils.damp(pivot.rotation.y, -mergedInput.moveX * 0.34, 10, dt);
          }
          f1Hero.drsFlap.rotation.x = THREE.MathUtils.damp(f1Hero.drsFlap.rotation.x, sim.isBoosting ? 0.55 : 0, 12, dt);
          const flameScale = sim.isBoosting ? 1.85 + Math.sin(elapsedTotal * 26) * 0.35 : 0.68 + Math.sin(elapsedTotal * 14) * 0.14;
          for (const flame of f1Hero.nitroFlames) flame.scale.z = flameScale;
        } else if (mode === 'tank') {
          tankHero.root.position.set(sim.x, 0, sim.z);
          tankHero.root.rotation.y = sim.heading;
          tankHero.turretGroup.rotation.y = THREE.MathUtils.damp(tankHero.turretGroup.rotation.y, mergedInput.moveX * 0.52, 7, dt);
          tankHero.shieldMat.opacity = sim.shieldActive ? 0.58 : 0.16;
        } else if (mode === 'ice') {
          iceHero.root.position.set(sim.x, Math.sin(elapsedTotal * 4.5) * 0.06, sim.z);
          iceHero.root.rotation.y = sim.heading;
          const driftYaw = sim.isDrifting
            ? THREE.MathUtils.clamp(-sim.driftAngle * 0.52, -0.38, 0.38)
            : 0;
          iceHero.bodyGroup.rotation.y = THREE.MathUtils.damp(iceHero.bodyGroup.rotation.y, driftYaw, 9, dt);
          iceHero.bodyGroup.rotation.z = THREE.MathUtils.damp(
            iceHero.bodyGroup.rotation.z,
            -mergedInput.moveX * 0.24 - driftYaw * 0.25,
            8,
            dt
          );
          if (sim.isDrifting) {
            driftSparkTimer -= dt;
            if (driftSparkTimer <= 0) {
              driftSparkTimer = 0.22;
              spawnRing(sim.x, sim.z, 0x00f5ff);
            }
          } else if (wasIceDrifting) {
            spawnRing(sim.x, sim.z, 0xffb703);
          }
          wasIceDrifting = sim.isDrifting;
        } else {
          zerogHero.root.position.set(sim.x, 0.25 + Math.sin(elapsedTotal * 3.8) * 0.18, sim.z);
          zerogHero.root.rotation.y = sim.heading;
          zerogHero.bodyGroup.rotation.z = THREE.MathUtils.damp(zerogHero.bodyGroup.rotation.z, -mergedInput.moveX * 0.24, 7, dt);
        }

        // Emit throttled local vehicle state over WebSocket
        stateEmitCbRef.current?.({
          x: sim.x,
          z: sim.z,
          heading: sim.heading,
          speed: sim.speed,
          score: sim.score,
          hits: sim.hitsLanded,
          isBoosting: sim.isBoosting,
          shieldActive: sim.shieldActive,
          turretAngle: mode === 'tank' ? tankHero.turretGroup.rotation.y : 0,
        });

        // Collectible Energy Orbs
        for (let i = 0; i < orbs.length; i++) {
          const orb = orbs[i];
          if (!orb.active) {
            orb.respawn -= dt;
            if (orb.respawn <= 0) {
              orb.active = true;
              orb.mesh.visible = true;
            }
          } else {
            orb.mesh.rotation.y += 2.2 * dt;
            orb.mesh.position.y = 0.8 + Math.sin(elapsedTotal * 3 + i) * 0.16;
            const distSq =
              (sim.x - orb.mesh.position.x) * (sim.x - orb.mesh.position.x) +
              (sim.z - orb.mesh.position.z) * (sim.z - orb.mesh.position.z);
            if (distSq < 4.4) {
              orb.active = false;
              orb.respawn = 4.5;
              orb.mesh.visible = false;
              simStateRef.current.score += 150;
              simStateRef.current.boostEnergy = Math.min(100, simStateRef.current.boostEnergy + 28);
              orbCbRef.current?.(150);
            }
          }
        }
      } else {
        // Lobby Showcase Choreography (Isolated per mode)
        if (phase === 'lobby') {
          arenaRoot.rotation.y = elapsedTotal * 0.14;
        }
        if (mode === 'f1') {
          f1Hero.root.position.set(24.5, 0, -3.2);
          f1Hero.root.rotation.y = 0.0;
          f1Hero.bodyGroup.rotation.z = 0;
          f1Hero.drsFlap.rotation.x = Math.max(0, Math.sin(elapsedTotal * 1.6)) * 0.45;
          f1Hero.steeringWheel.rotation.z = Math.sin(elapsedTotal * 1.4) * 0.25;
          for (const pivot of f1Hero.frontWheelPivots) pivot.rotation.y = Math.sin(elapsedTotal * 1.4) * 0.18;
          for (const flame of f1Hero.nitroFlames) flame.scale.z = 0.7 + Math.sin(elapsedTotal * 16) * 0.25;
        } else if (mode === 'tank') {
          tankHero.root.position.set(0, 0, 2.0);
          tankHero.root.rotation.y = 0.58;
          tankHero.turretGroup.rotation.y = Math.sin(elapsedTotal * 0.9) * 0.55;
          tankHero.shieldMat.opacity = 0.18 + Math.sin(elapsedTotal * 2.5) * 0.05;
        } else if (mode === 'ice') {
          iceHero.root.position.set(0, Math.sin(elapsedTotal * 3.0) * 0.08, 1.8);
          iceHero.root.rotation.y = 0.55 + Math.sin(elapsedTotal * 0.7) * 0.2;
        } else {
          zerogHero.root.position.set(0, 0.3 + Math.sin(elapsedTotal * 2.8) * 0.18, 1.8);
          zerogHero.root.rotation.y = 0.55;
        }

        for (let i = 0; i < orbs.length; i++) {
          const orb = orbs[i];
          orb.mesh.visible = true;
          orb.mesh.rotation.y += 1.6 * dt;
          orb.mesh.position.y = 0.8 + Math.sin(elapsedTotal * 2.4 + i) * 0.14;
        }
      }

      // RENDER REMOTE MULTIPLAYER RIVALS & BOTS (or default sparring rival if solo)
      const remoteList = remoteVehiclesRef ? Array.from(remoteVehiclesRef.current.values()) : [];
      if (remoteList.length > 0) {
        const count = Math.min(MAX_RIVALS, remoteList.length);
        for (let i = 0; i < count; i++) {
          const rp = remoteList[i];
          const botAngle = elapsedTotal * (mode === 'f1' ? 0.56 : 0.34) + rp.slotNumber * 1.4;
          const botRadius = mode === 'f1' ? 25.5 : 21.0;
          const targetX = rp.isBot ? Math.cos(botAngle) * botRadius : rp.x;
          const targetZ = rp.isBot ? Math.sin(botAngle) * botRadius : rp.z;
          const targetH = rp.isBot ? -botAngle : rp.heading;

          if (mode === 'f1') {
            const rig = f1Rivals[i];
            rig.root.visible = true;
            _scratchColor.set(rp.liveryColor);
            rig.f1LiveryMat.color.lerp(_scratchColor, 1 - Math.exp(-8 * dt));
            rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, targetX, 10, dt);
            rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, targetZ, 10, dt);
            rig.root.rotation.y = angleLerp(rig.root.rotation.y, targetH, 10, dt);
            activeRivalPositions.push({ x: rig.root.position.x, z: rig.root.position.z, clientId: rp.clientId });
          } else if (mode === 'tank') {
            const rig = tankRivals[i];
            rig.root.visible = true;
            _scratchColor.set(rp.liveryColor);
            rig.accentMat.color.lerp(_scratchColor, 1 - Math.exp(-8 * dt));
            _scratchColor.lerp(_tankArmorBase, 0.58);
            rig.tankArmorMat.color.lerp(_scratchColor, 1 - Math.exp(-8 * dt));
            rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, targetX, 10, dt);
            rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, targetZ, 10, dt);
            rig.root.rotation.y = angleLerp(rig.root.rotation.y, targetH, 10, dt);
            rig.turretGroup.rotation.y = angleLerp(rig.turretGroup.rotation.y, rp.turretAngle, 10, dt);
            rig.shieldMat.opacity = rp.shieldActive ? 0.58 : 0.16;
            activeRivalPositions.push({ x: rig.root.position.x, z: rig.root.position.z, clientId: rp.clientId });
          } else if (mode === 'ice') {
            const rig = iceRivals[i];
            rig.root.visible = true;
            _scratchColor.set(rp.liveryColor);
            rig.hullMat.color.lerp(_scratchColor, 1 - Math.exp(-8 * dt));
            rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, targetX, 10, dt);
            rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, targetZ, 10, dt);
            rig.root.rotation.y = angleLerp(rig.root.rotation.y, targetH, 10, dt);
            activeRivalPositions.push({ x: rig.root.position.x, z: rig.root.position.z, clientId: rp.clientId });
          } else {
            const rig = zerogRivals[i];
            rig.root.visible = true;
            _scratchColor.set(rp.liveryColor);
            rig.hullMat.color.lerp(_scratchColor, 1 - Math.exp(-8 * dt));
            rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, targetX, 10, dt);
            rig.root.position.y = 0.35 + Math.sin(elapsedTotal * 3.5 + i) * 0.16;
            rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, targetZ, 10, dt);
            rig.root.rotation.y = angleLerp(rig.root.rotation.y, targetH, 10, dt);
            activeRivalPositions.push({ x: rig.root.position.x, z: rig.root.position.z, clientId: rp.clientId });
          }
        }
      } else {
        // Default AI sparring partner patrolling cleanly in its own lane ahead/across the stage
        const phaseOffset = mode === 'f1' ? 0.42 : Math.PI * 1.15;
        const ang = elapsedTotal * (mode === 'f1' ? 0.48 : 0.32) + phaseOffset;
        const rad = mode === 'f1' ? 21.5 : 22.0;
        const rx = Math.cos(ang) * rad;
        const rz = Math.sin(ang) * rad;
        if (mode === 'f1') {
          f1Rivals[0].root.visible = true;
          f1Rivals[0].root.position.set(rx, 0, rz);
          f1Rivals[0].root.rotation.y = -ang;
          f1Rivals[0].bodyGroup.rotation.z = 0.08;
        } else if (mode === 'tank') {
          tankRivals[0].root.visible = true;
          tankRivals[0].root.position.set(rx, 0, rz);
          tankRivals[0].root.rotation.y = -ang;
          tankRivals[0].turretGroup.rotation.y = Math.sin(elapsedTotal * 1.1) * 0.6;
        } else if (mode === 'ice') {
          iceRivals[0].root.visible = true;
          iceRivals[0].root.position.set(rx, Math.sin(elapsedTotal * 3.2) * 0.08, rz);
          iceRivals[0].root.rotation.y = -ang;
        } else {
          zerogRivals[0].root.visible = true;
          zerogRivals[0].root.position.set(rx, 0.35 + Math.cos(elapsedTotal * 3.0) * 0.16, rz);
          zerogRivals[0].root.rotation.y = -ang;
        }
        activeRivalPositions.push({ x: rx, z: rz });
      }

      // Sparring AI fires occasional dodgeable plasma bolts in Tank / Zero-G play
      if (isPlayable && (mode === 'tank' || mode === 'zerog') && activeRivalPositions.length > 0) {
        aiFireTimer -= dt;
        if (aiFireTimer <= 0) {
          aiFireTimer = 2.8;
          const shooter = activeRivalPositions[0];
          const aimHeading = Math.atan2(
            simStateRef.current.x - shooter.x,
            simStateRef.current.z - shooter.z
          );
          spawnActionEffect(shooter.x, shooter.z, aimHeading, mode, false);
        }
      }

      // Spin wheels & animate Tank radar/optics/recoil
      const wheelRate = isPlayable ? Math.max(0.15, simStateRef.current.speed * 0.6) : 5.2;
      if (mode === 'f1') {
        for (const w of f1Hero.wheelMeshes) w.rotation.x += wheelRate * dt;
        for (const rig of f1Rivals) {
          if (rig.root.visible) for (const w of rig.wheelMeshes) w.rotation.x += 7.5 * dt;
        }
        f1Hero.rainLightMat.emissiveIntensity = 0.8 + Math.max(0, Math.sin(elapsedTotal * 10)) * 1.4;
      } else if (mode === 'tank') {
        for (const w of tankHero.roadWheels) w.rotation.x += wheelRate * 0.7 * dt;
        tankHero.radarDome.rotation.y += 2.6 * dt;
        tankHero.opticsGroup.rotation.y = Math.sin(elapsedTotal * 1.5) * 0.75;
        tankHero.shieldMesh.rotation.y = elapsedTotal * 0.5;

        for (const rig of tankRivals) {
          if (rig.root.visible) {
            rig.radarDome.rotation.y -= 2.4 * dt;
            rig.shieldMesh.rotation.y = -elapsedTotal * 0.5;
          }
        }

        if (tankRecoil > 0) {
          tankRecoil = Math.max(0, tankRecoil - dt * 3.8);
          tankHero.barrelRecoilGroup.position.z = 1.25 - Math.sin(tankRecoil * Math.PI) * 0.42;
          tankHero.muzzleFlashMat.opacity = tankRecoil > 0.65 ? (tankRecoil - 0.65) * 2.8 : 0;
        } else {
          tankHero.barrelRecoilGroup.position.z = 1.25;
          tankHero.muzzleFlashMat.opacity = 0;
        }
      }

      // Update pooled projectiles + check direct hits on rivals
      for (let i = 0; i < projectilePool.length; i++) {
        const p = projectilePool[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          p.mesh.visible = false;
          continue;
        }
        if (p.isRing) {
          const progress = 1 - p.life / p.maxLife;
          p.mesh.scale.setScalar(1 + progress * 5.8);
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.88 * (1 - progress));
        } else {
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.z += p.vz * dt;

          // Tactical cover bunkers absorb railgun projectiles
          if (mode === 'tank') {
            let blockedByBunker = false;
            for (let b = 0; b < TANK_BUNKERS.length; b++) {
              const ob = TANK_BUNKERS[b];
              const bdx = p.mesh.position.x - ob.x;
              const bdz = p.mesh.position.z - ob.z;
              if (bdx * bdx + bdz * bdz < 3.6) {
                p.active = false;
                p.mesh.visible = false;
                spawnRing(p.mesh.position.x, p.mesh.position.z, 0x00f5ff);
                blockedByBunker = true;
                break;
              }
            }
            if (blockedByBunker) continue;
          }

          if (p.fromSelf && isPlayable) {
            for (let r = 0; r < activeRivalPositions.length; r++) {
              const rival = activeRivalPositions[r];
              const dx = p.mesh.position.x - rival.x;
              const dz = p.mesh.position.z - rival.z;
              if (dx * dx + dz * dz < 6.8) {
                p.active = false;
                p.mesh.visible = false;
                spawnRing(rival.x, rival.z, 0xef1a4b);
                simStateRef.current.score += 120;
                simStateRef.current.hitsLanded += 1;
                hitCbRef.current?.(120, 'Direct Railgun Hit', rival.clientId);
                break;
              }
            }
          }
        }
      }

      outerRing.rotation.z = -elapsedTotal * 0.16;

      // Active Hero Lookup for Camera Presets
      const activeHero =
        mode === 'f1'
          ? f1Hero.root
          : mode === 'tank'
          ? tankHero.root
          : mode === 'ice'
          ? iceHero.root
          : zerogHero.root;

      const camMode = cameraPresetRef.current;
      if (camMode === 'orbit') {
        const cosE = Math.cos(orbitElevation);
        _targetCamPos.set(
          Math.sin(orbitAzimuth) * cosE * orbitDistance,
          Math.sin(orbitElevation) * orbitDistance + 1.8,
          Math.cos(orbitAzimuth) * cosE * orbitDistance
        );
        _targetLookAt.set(0, 0.9, 0);
      } else if (camMode === 'chase') {
        const totalHeading = activeHero.rotation.y + arenaRoot.rotation.y;
        const hx = Math.sin(totalHeading);
        const hz = Math.cos(totalHeading);
        const worldX =
          activeHero.position.x * Math.cos(arenaRoot.rotation.y) +
          activeHero.position.z * Math.sin(arenaRoot.rotation.y);
        const worldZ =
          -activeHero.position.x * Math.sin(arenaRoot.rotation.y) +
          activeHero.position.z * Math.cos(arenaRoot.rotation.y);
        const chaseDist = mode === 'tank' ? 11.2 : 9.4;
        const chaseHeight = mode === 'tank' ? 4.4 : 2.9;
        const lookAhead = mode === 'tank' ? 7.5 : 10.5;
        _targetCamPos.set(worldX - hx * chaseDist, chaseHeight, worldZ - hz * chaseDist);
        _targetLookAt.set(worldX + hx * lookAhead, 1.15, worldZ + hz * lookAhead);
      } else {
        const totalHeading = activeHero.rotation.y + arenaRoot.rotation.y;
        const hx = Math.sin(totalHeading);
        const hz = Math.cos(totalHeading);
        const worldX =
          activeHero.position.x * Math.cos(arenaRoot.rotation.y) +
          activeHero.position.z * Math.sin(arenaRoot.rotation.y);
        const worldZ =
          -activeHero.position.x * Math.sin(arenaRoot.rotation.y) +
          activeHero.position.z * Math.cos(arenaRoot.rotation.y);

        if (mode === 'f1') {
          _targetCamPos.set(worldX - hx * 2.6, 2.35, worldZ - hz * 2.6);
          _targetLookAt.set(worldX + hx * 11.5, 0.85, worldZ + hz * 11.5);
        } else {
          _targetCamPos.set(worldX - 6.0, 22.0, worldZ + 14.0);
          _targetLookAt.set(worldX, 0.8, worldZ);
        }
      }

      // Dynamic speed-reactive FOV kick for exciting long-distance racing & combat
      const targetFov =
        isPlayable && simStateRef.current.isBoosting
          ? 55
          : isPlayable && simStateRef.current.speed > 15
          ? 50
          : 46;
      const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 5.5, dt);
      if (Math.abs(nextFov - camera.fov) > 0.04) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }

      simTrauma = Math.max(0, simTrauma - 2.4 * dt);
      const shake = simTrauma * simTrauma * 0.25;
      if (snapCamRef.current) {
        snapCamRef.current = false;
        camera.position.copy(_targetCamPos);
        _currentLookAt.copy(_targetLookAt);
      } else {
        camera.position.x =
          THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 6.5, dt) +
          (Math.random() - 0.5) * shake;
        camera.position.y =
          THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 6.5, dt) +
          (Math.random() - 0.5) * shake;
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 6.5, dt);

        _currentLookAt.x = THREE.MathUtils.damp(_currentLookAt.x, _targetLookAt.x, 7.5, dt);
        _currentLookAt.y = THREE.MathUtils.damp(_currentLookAt.y, _targetLookAt.y, 7.5, dt);
        _currentLookAt.z = THREE.MathUtils.damp(_currentLookAt.z, _targetLookAt.z, 7.5, dt);
      }
      camera.lookAt(_currentLookAt);

      if (isPlayable && now - lastTelemetryPush > 125) {
        lastTelemetryPush = now;
        const s = simStateRef.current;
        telemetryCbRef.current({
          speed: s.speed,
          boostEnergy: s.boostEnergy,
          score: s.score,
          driftPoints: s.driftPoints,
          hitsLanded: s.hitsLanded,
          laps: lapCount,
          isBoosting: s.isBoosting,
          isDrifting: s.isDrifting,
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      tick();
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('wheel', onWheel);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              (m as THREE.MeshStandardMaterial).map?.dispose();
              m.dispose();
            });
          } else {
            (mesh.material as THREE.MeshStandardMaterial).map?.dispose();
            mesh.material.dispose();
          }
        }
      });
      surfaceTex.dispose();
      shadowTex.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="arena-3d-canvas"
      data-active-mode={activeMode}
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      aria-label={`PlaySync 3D ${ARENA_MODES[activeMode].title} Viewport`}
    />
  );
};
