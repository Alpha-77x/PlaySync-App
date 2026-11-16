export type ArenaModeId = 'f1' | 'tank' | 'ice' | 'zerog';
export type CameraPreset = 'orbit' | 'chase' | 'tactical';
export type MatchPhase = 'lobby' | 'playing' | 'paused' | 'results';
export type InputType = 'Touch & Gyro' | 'Gamepad' | 'Keyboard' | 'AI Bot';

export interface CameraPresetOption {
  id: CameraPreset;
  label: string;
  shortLabel: string;
}

export interface ArenaPhysicsProfile {
  topSpeed: number;
  acceleration: number;
  handling: number;
  friction: number;
  boostMultiplier: number;
  armorRating: number;
  gravityScale: number;
}

export interface ArenaModeSpec {
  id: ArenaModeId;
  title: string;
  lobbyTitle: string;
  category: string;
  tagline: string;
  description: string;
  playerRange: string;
  accentColor: string;
  secondaryColor: string;
  badgeText: string;
  defaultCamera: CameraPreset;
  cameraOptions: [CameraPresetOption, CameraPresetOption, CameraPresetOption];
  actionLabel: string;
  secondaryActionLabel: string;
  features: [string, string, string];
  physics: ArenaPhysicsProfile;
}

export interface PlayerSlot {
  id: string;
  slotNumber: number;
  name: string;
  status: 'host' | 'connected' | 'empty';
  inputType: InputType;
  ready: boolean;
  pingMs: number;
  liveryColor: string;
  score: number;
  accuracy: number;
  driftPoints: number;
  eliminations: number;
}

export interface GameLobbyState {
  modeId: ArenaModeId;
  roomPin: string;
  slots: PlayerSlot[];
  roundNumber: number;
  roundSeconds: number;
  cameraPreset: CameraPreset;
}

export interface VehicleSimState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  speed: number;
  boostEnergy: number;
  isBoosting: boolean;
  shieldActive: boolean;
  cooldownTimer: number;
  score: number;
  driftPoints: number;
  comboMultiplier: number;
  comboTimer: number;
  lastWallImpact: number;
  hitsLanded: number;
  shotsFired: number;
}

export interface ControlInput {
  moveX: number; // -1..1
  moveY: number; // -1..1
  boost: boolean;
  action: boolean;
  shield: boolean;
}

export const LIVERY_PALETTE = [
  { name: 'Cyber Cyan', hex: '#00f5ff' },
  { name: 'Crimson Rosso', hex: '#ef1a4b' },
  { name: 'Solar Amber', hex: '#ffb703' },
  { name: 'Emerald Pulse', hex: '#00f5a0' },
  { name: 'Ultraviolet', hex: '#8b5cf6' },
] as const;

export const ARENA_MODES: Record<ArenaModeId, ArenaModeSpec> = {
  f1: {
    id: 'f1',
    title: 'F1 Cyber Grand Prix',
    lobbyTitle: 'F1 Cyber Grand Prix Lobby',
    category: 'Open-Wheel Formula Circuit',
    tagline: 'Aerodynamic F1 racing with DRS slipstreams & apex downforce',
    description:
      'Dedicated open-wheel Formula circuit featuring DRS wings, Venturi underbody aero, carbon-ceramic brakes, and high-speed energy drafting.',
    playerRange: '1–8 Drivers',
    accentColor: '#ef1a4b',
    secondaryColor: '#00f5ff',
    badgeText: 'Formula Circuit',
    defaultCamera: 'orbit',
    cameraOptions: [
      { id: 'orbit', label: 'Pit Orbit', shortLabel: 'Orbit' },
      { id: 'chase', label: 'F1 Chase', shortLabel: 'Chase' },
      { id: 'tactical', label: 'T-Cam Pod', shortLabel: 'T-Cam' },
    ],
    actionLabel: 'Apex Surge',
    secondaryActionLabel: 'Trail Brake',
    features: ['DRS Aero Wing', 'Venturi Floor', 'Apex Slipstream'],
    physics: {
      topSpeed: 28,
      acceleration: 36,
      handling: 3.4,
      friction: 1.9,
      boostMultiplier: 1.56,
      armorRating: 62,
      gravityScale: 1.0,
    },
  },
  tank: {
    id: 'tank',
    title: 'Cyber Tank Duel',
    lobbyTitle: 'Cyber Tank Duel Lobby',
    category: 'Armored Railgun Combat Arena',
    tagline: 'Independent turret aiming, reactive armor & kinetic railguns',
    description:
      'Dedicated tactical tank arena with Chobham reactive armor, 360° turret tracking, electromagnetic railgun shells, and hex shield domes.',
    playerRange: '1–8 Commanders',
    accentColor: '#00f5ff',
    secondaryColor: '#38bdf8',
    badgeText: 'Armored Duel',
    defaultCamera: 'orbit',
    cameraOptions: [
      { id: 'orbit', label: 'Arena Orbit', shortLabel: 'Orbit' },
      { id: 'chase', label: 'Turret Cam', shortLabel: 'Turret' },
      { id: 'tactical', label: 'Top-Down', shortLabel: 'Top' },
    ],
    actionLabel: 'Fire Railgun',
    secondaryActionLabel: 'Hex Shield',
    features: ['ERA Armor Hull', 'Coaxial Railgun', 'Hex Shield Dome'],
    physics: {
      topSpeed: 17.5,
      acceleration: 28,
      handling: 2.8,
      friction: 4.2,
      boostMultiplier: 1.48,
      armorRating: 96,
      gravityScale: 1.0,
    },
  },
  ice: {
    id: 'ice',
    title: 'Slip N Bump 3D',
    lobbyTitle: 'Slip N Bump Ice Lobby',
    category: 'Cryo-Glass Bumper Rink',
    tagline: 'Ultra-low friction hover-pod knockouts & momentum waves',
    description:
      'Dedicated cryo-ice rink where hover-bumper pods weaponize inertia. Carve wide drift arcs and launch rivals out with momentum shockwaves.',
    playerRange: '1–8 Pods',
    accentColor: '#ffb703',
    secondaryColor: '#38bdf8',
    badgeText: 'Cryo Rink',
    defaultCamera: 'orbit',
    cameraOptions: [
      { id: 'orbit', label: 'Rink Orbit', shortLabel: 'Orbit' },
      { id: 'chase', label: 'Pod Chase', shortLabel: 'Chase' },
      { id: 'tactical', label: 'Overhead', shortLabel: 'Top' },
    ],
    actionLabel: 'Momentum Wave',
    secondaryActionLabel: 'Ice Anchor',
    features: ['Cryo Hover-Pods', 'Ring-Out Physics', 'Momentum Waves'],
    physics: {
      topSpeed: 24,
      acceleration: 22,
      handling: 2.5,
      friction: 0.45,
      boostMultiplier: 1.62,
      armorRating: 78,
      gravityScale: 1.0,
    },
  },
  zerog: {
    id: 'zerog',
    title: 'Star Brawler Zero-G',
    lobbyTitle: 'Star Brawler Zero-G Lobby',
    category: 'Orbital Micro-Gravity Deck',
    tagline: 'Pulse strikers, orbital shockwaves & energy deflectors',
    description:
      'Dedicated micro-gravity orbital platform with twin-wing Pulse Strikers, shockwave blasts, and magnetic energy deflectors.',
    playerRange: '1–8 Strikers',
    accentColor: '#00f5a0',
    secondaryColor: '#8b5cf6',
    badgeText: 'Zero-G Deck',
    defaultCamera: 'orbit',
    cameraOptions: [
      { id: 'orbit', label: 'Deck Orbit', shortLabel: 'Orbit' },
      { id: 'chase', label: 'Striker Cam', shortLabel: 'Chase' },
      { id: 'tactical', label: 'Orbital Map', shortLabel: 'Top' },
    ],
    actionLabel: 'Pulse Blast',
    secondaryActionLabel: 'Deflector',
    features: ['Pulse Strikers', 'Zero-G Drift', 'Orbital Shockwaves'],
    physics: {
      topSpeed: 22,
      acceleration: 26,
      handling: 3.1,
      friction: 0.95,
      boostMultiplier: 1.55,
      armorRating: 84,
      gravityScale: 0.35,
    },
  },
};

export const ARENA_MODE_ORDER: ArenaModeId[] = ['f1', 'tank', 'ice', 'zerog'];

const DEFAULT_MODE_PINS: Record<ArenaModeId, string> = {
  f1: '8492',
  tank: '4170',
  ice: '6325',
  zerog: '9048',
};

const MODE_DEFAULT_LIVERY: Record<ArenaModeId, string> = {
  f1: '#ef1a4b',
  tank: '#00f5ff',
  ice: '#ffb703',
  zerog: '#00f5a0',
};

const GUEST_CALLSIGNS: Record<ArenaModeId, string[]> = {
  f1: ['ApexLeclerc', 'KersVettel', 'DRS_Sainz', 'Slipstream', 'TurboSenna', 'Paddock7', 'MonzaPro'],
  tank: ['Ironclad', 'RailViper', 'ArmorCore', 'TreadWolf', 'SiegeNine', 'ChobhamX', 'Bastion'],
  ice: ['CryoDrift', 'FrostBumper', 'Glacier9', 'SubZero', 'IceBreaker', 'PolarSpin', 'Avalanche'],
  zerog: ['NovaStriker', 'OrbitZero', 'Quasar7', 'NebulaWing', 'PulseHawk', 'VoidRunner', 'Zenith'],
};

export function createInitialSlots(modeId: ArenaModeId = 'f1'): PlayerSlot[] {
  const hostColor = MODE_DEFAULT_LIVERY[modeId];
  return Array.from({ length: 8 }, (_, idx) => {
    const slotNumber = idx + 1;
    if (slotNumber === 1) {
      return {
        id: `${modeId}-p1`,
        slotNumber: 1,
        name: 'Host Console',
        status: 'host',
        inputType: 'Touch & Gyro',
        ready: true,
        pingMs: 8,
        liveryColor: hostColor,
        score: 0,
        accuracy: 100,
        driftPoints: 0,
        eliminations: 0,
      };
    }
    return {
      id: `${modeId}-p${slotNumber}`,
      slotNumber,
      name: `Slot ${slotNumber}`,
      status: 'empty',
      inputType: 'Touch & Gyro',
      ready: false,
      pingMs: 0,
      liveryColor: LIVERY_PALETTE[(idx + 1) % LIVERY_PALETTE.length].hex,
      score: 0,
      accuracy: 0,
      driftPoints: 0,
      eliminations: 0,
    };
  });
}

export function createInitialLobbies(): Record<ArenaModeId, GameLobbyState> {
  return {
    f1: {
      modeId: 'f1',
      roomPin: DEFAULT_MODE_PINS.f1,
      slots: createInitialSlots('f1'),
      roundNumber: 1,
      roundSeconds: 60,
      cameraPreset: ARENA_MODES.f1.defaultCamera,
    },
    tank: {
      modeId: 'tank',
      roomPin: DEFAULT_MODE_PINS.tank,
      slots: createInitialSlots('tank'),
      roundNumber: 1,
      roundSeconds: 60,
      cameraPreset: ARENA_MODES.tank.defaultCamera,
    },
    ice: {
      modeId: 'ice',
      roomPin: DEFAULT_MODE_PINS.ice,
      slots: createInitialSlots('ice'),
      roundNumber: 1,
      roundSeconds: 60,
      cameraPreset: ARENA_MODES.ice.defaultCamera,
    },
    zerog: {
      modeId: 'zerog',
      roomPin: DEFAULT_MODE_PINS.zerog,
      slots: createInitialSlots('zerog'),
      roundNumber: 1,
      roundSeconds: 60,
      cameraPreset: ARENA_MODES.zerog.defaultCamera,
    },
  };
}

export function findModeByPin(
  lobbies: Record<ArenaModeId, GameLobbyState>,
  pin: string
): ArenaModeId | null {
  for (const modeId of ARENA_MODE_ORDER) {
    if (lobbies[modeId].roomPin === pin) {
      return modeId;
    }
  }
  return null;
}

export function generateRoomPin(currentPin?: string): string {
  let next = '';
  do {
    next = String(Math.floor(1000 + Math.random() * 9000));
  } while (next === currentPin);
  return next;
}

export function addGuestToNextSlot(
  slots: PlayerSlot[],
  customName?: string,
  inputType: InputType = 'Touch & Gyro',
  modeId: ArenaModeId = 'f1'
): PlayerSlot[] {
  const emptyIndex = slots.findIndex((s) => s.status === 'empty');
  if (emptyIndex === -1) return slots;

  const slot = slots[emptyIndex];
  const pool = GUEST_CALLSIGNS[modeId];
  const defaultCallsign = pool[(slot.slotNumber - 2) % pool.length];
  const cleanName = customName?.trim() ? customName.trim().slice(0, 18) : defaultCallsign;
  const pingMs = inputType === 'AI Bot' ? 2 : 7 + ((slot.slotNumber * 3) % 11);

  return slots.map((item, idx) =>
    idx === emptyIndex
      ? {
          ...item,
          name: cleanName,
          status: 'connected',
          inputType,
          ready: true,
          pingMs,
          score: 0,
          accuracy: 84 + ((slot.slotNumber * 5) % 15),
          driftPoints: 0,
          eliminations: 0,
        }
      : item
  );
}

export function removeGuestFromSlot(
  slots: PlayerSlot[],
  slotNumber: number
): PlayerSlot[] {
  if (slotNumber === 1) return slots;
  return slots.map((slot) =>
    slot.slotNumber === slotNumber
      ? {
          ...slot,
          name: `Slot ${slotNumber}`,
          status: 'empty',
          ready: false,
          pingMs: 0,
          score: 0,
          accuracy: 0,
          driftPoints: 0,
          eliminations: 0,
        }
      : slot
  );
}

export function toggleSlotReady(
  slots: PlayerSlot[],
  slotNumber: number
): PlayerSlot[] {
  return slots.map((slot) =>
    slot.slotNumber === slotNumber && slot.status !== 'empty'
      ? { ...slot, ready: !slot.ready }
      : slot
  );
}

export function updateSlotLivery(
  slots: PlayerSlot[],
  slotNumber: number,
  colorHex: string
): PlayerSlot[] {
  return slots.map((slot) =>
    slot.slotNumber === slotNumber ? { ...slot, liveryColor: colorHex } : slot
  );
}

export function getConnectedCount(slots: PlayerSlot[]): number {
  return slots.filter((s) => s.status !== 'empty').length;
}

export function getReadyCount(slots: PlayerSlot[]): number {
  return slots.filter((s) => s.status !== 'empty' && s.ready).length;
}

export function getRankedLeaderboard(slots: PlayerSlot[]): PlayerSlot[] {
  return slots
    .filter((s) => s.status !== 'empty')
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.eliminations !== a.eliminations) return b.eliminations - a.eliminations;
      return a.slotNumber - b.slotNumber;
    });
}

export function createInitialVehicleSim(mode: ArenaModeId): VehicleSimState {
  if (mode === 'f1') {
    return {
      x: 24.5,
      z: 0,
      vx: 0,
      vz: 0,
      heading: 0,
      speed: 0,
      boostEnergy: 100,
      isBoosting: false,
      shieldActive: false,
      cooldownTimer: 0,
      score: 0,
      driftPoints: 0,
      comboMultiplier: 1,
      comboTimer: 0,
      lastWallImpact: 0,
      hitsLanded: 0,
      shotsFired: 0,
    };
  }
  return {
    x: 0,
    z: 18.5,
    vx: 0,
    vz: 0,
    heading: Math.PI,
    speed: 0,
    boostEnergy: 100,
    isBoosting: false,
    shieldActive: false,
    cooldownTimer: 0,
    score: 0,
    driftPoints: 0,
    comboMultiplier: 1,
    comboTimer: 0,
    lastWallImpact: 0,
    hitsLanded: 0,
    shotsFired: 0,
  };
}

export const ARENA_BOUNDARY_RADIUS = 37.4;
export const F1_INNER_BOUNDARY_RADIUS = 13.0;

export interface ArenaObstacle {
  x: number;
  z: number;
  radius: number;
}

export interface ArenaPoint {
  x: number;
  z: number;
  angle: number;
}

export const TANK_BUNKERS: ArenaObstacle[] = Array.from({ length: 10 }, (_, i) => {
  const angle = (i * Math.PI * 2) / 10;
  const dist = i % 2 === 0 ? 12.5 : 26.5;
  return {
    x: Number((Math.cos(angle) * dist).toFixed(3)),
    z: Number((Math.sin(angle) * dist).toFixed(3)),
    radius: 2.6,
  };
});

export const F1_BOOST_PADS: ArenaPoint[] = Array.from({ length: 6 }, (_, i) => {
  const angle = (i * Math.PI * 2) / 6 + Math.PI / 6;
  const dist = 25.5;
  return {
    x: Number((Math.cos(angle) * dist).toFixed(3)),
    z: Number((Math.sin(angle) * dist).toFixed(3)),
    angle,
  };
});

export const ZEROG_GATES: ArenaPoint[] = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI * 2) / 8 + Math.PI / 8;
  const dist = 24.5;
  return {
    x: Number((Math.cos(angle) * dist).toFixed(3)),
    z: Number((Math.sin(angle) * dist).toFixed(3)),
    angle,
  };
});

export function stepVehicleSimulation(
  prev: VehicleSimState,
  input: ControlInput,
  modeId: ArenaModeId,
  rawDt: number
): VehicleSimState {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const spec = ARENA_MODES[modeId].physics;

  let heading = prev.heading;
  let vx = prev.vx;
  let vz = prev.vz;
  let boostEnergy = prev.boostEnergy;
  const cooldownTimer = Math.max(0, prev.cooldownTimer - dt);

  const canBoost = input.boost && boostEnergy > 4;
  const isBoosting = canBoost;
  if (isBoosting) {
    boostEnergy = Math.max(0, boostEnergy - 32 * dt);
  } else {
    boostEnergy = Math.min(100, boostEnergy + 18 * dt);
  }

  const shieldActive = input.shield && modeId !== 'f1';
  const boostFactor = isBoosting ? spec.boostMultiplier : 1.0;

  if (modeId === 'f1' || modeId === 'ice') {
    const steerInput = Math.max(-1, Math.min(1, input.moveX));
    const throttle = Math.max(-1, Math.min(1, input.moveY));
    const turnAuthority = 0.45 + 0.55 * Math.min(1, prev.speed / 8);
    heading -= steerInput * spec.handling * turnAuthority * dt;

    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);
    const accel = throttle * spec.acceleration * boostFactor;
    vx += forwardX * accel * dt;
    vz += forwardZ * accel * dt;

    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);
    const lateralSpeed = vx * rightX + vz * rightZ;
    const gripDecay = Math.exp(-spec.friction * 1.4 * dt);
    const dampedLateral = lateralSpeed * gripDecay;
    const deltaLat = lateralSpeed - dampedLateral;
    vx -= rightX * deltaLat;
    vz -= rightZ * deltaLat;
  } else {
    const mag = Math.hypot(input.moveX, input.moveY);
    const nx = mag > 1 ? input.moveX / mag : input.moveX;
    const ny = mag > 1 ? input.moveY / mag : input.moveY;
    vx += nx * spec.acceleration * boostFactor * dt;
    vz -= ny * spec.acceleration * boostFactor * dt;

    if (mag > 0.15) {
      const targetHeading = Math.atan2(vx, vz);
      let diff = targetHeading - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading += diff * Math.min(1, spec.handling * 2.2 * dt);
    }
  }

  const drag = Math.exp(-spec.friction * dt);
  vx *= drag;
  vz *= drag;

  const maxSpd = spec.topSpeed * boostFactor;
  let speed = Math.hypot(vx, vz);
  if (speed > maxSpd) {
    const scale = maxSpd / speed;
    vx *= scale;
    vz *= scale;
    speed = maxSpd;
  }

  let x = prev.x + vx * dt;
  let z = prev.z + vz * dt;
  let wallImpact = 0;

  // Tactical cover obstacle collisions for Cyber Tank Duel
  if (modeId === 'tank') {
    for (let i = 0; i < TANK_BUNKERS.length; i++) {
      const ob = TANK_BUNKERS[i];
      const dx = x - ob.x;
      const dz = z - ob.z;
      const distSq = dx * dx + dz * dz;
      const minDist = ob.radius + 1.35;
      if (distSq < minDist * minDist && distSq > 0.0001) {
        const d = Math.sqrt(distSq);
        const nx = dx / d;
        const nz = dz / d;
        x = ob.x + nx * minDist;
        z = ob.z + nz * minDist;
        const intoWall = vx * nx + vz * nz;
        if (intoWall < 0) {
          wallImpact = Math.max(wallImpact, Math.min(1, Math.abs(intoWall) / 14));
          vx -= 1.25 * intoWall * nx;
          vz -= 1.25 * intoWall * nz;
        }
        speed = Math.hypot(vx, vz);
      }
    }
  }

  const dist = Math.hypot(x, z);
  if (modeId === 'f1' && dist < F1_INNER_BOUNDARY_RADIUS) {
    const nx = dist > 0.0001 ? x / dist : 1;
    const nz = dist > 0.0001 ? z / dist : 0;
    x = nx * F1_INNER_BOUNDARY_RADIUS;
    z = nz * F1_INNER_BOUNDARY_RADIUS;
    const radialVel = vx * nx + vz * nz;
    if (radialVel < 0) {
      wallImpact = Math.max(wallImpact, Math.min(1, Math.abs(radialVel) / 18));
      vx -= 1.35 * radialVel * nx;
      vz -= 1.35 * radialVel * nz;
    }
    speed = Math.hypot(vx, vz);
  }
  if (dist > ARENA_BOUNDARY_RADIUS) {
    const nx = x / dist;
    const nz = z / dist;
    x = nx * ARENA_BOUNDARY_RADIUS;
    z = nz * ARENA_BOUNDARY_RADIUS;
    const radialVel = vx * nx + vz * nz;
    if (radialVel > 0) {
      wallImpact = Math.max(wallImpact, Math.min(1, Math.abs(radialVel) / 18));
      vx -= 1.35 * radialVel * nx;
      vz -= 1.35 * radialVel * nz;
    }
    speed = Math.hypot(vx, vz);
  }

  const drifting =
    speed > 3 && Math.abs(input.moveX) > 0.35 && (modeId === 'f1' || modeId === 'ice');
  const driftGain = drifting ? speed * 16 * dt : 0;
  const speedGain = speed > 0.8 ? speed * (isBoosting ? 5.5 : 2.8) * dt : 0;

  let comboTimer = Math.max(0, prev.comboTimer - dt);
  let comboMultiplier = prev.comboMultiplier;
  if (comboTimer <= 0 && comboMultiplier > 1) {
    comboMultiplier = 1;
  }

  return {
    ...prev,
    x,
    z,
    vx,
    vz,
    heading,
    speed,
    boostEnergy,
    isBoosting,
    shieldActive,
    cooldownTimer,
    comboMultiplier,
    comboTimer,
    lastWallImpact: wallImpact,
    driftPoints: prev.driftPoints + driftGain,
    score: prev.score + (speedGain + driftGain * 0.5) * comboMultiplier,
  };
}

export function awardComboPoints(
  state: VehicleSimState,
  basePoints: number
): { nextState: VehicleSimState; awarded: number; combo: number } {
  const nextCombo = state.comboTimer > 0 ? Math.min(4, state.comboMultiplier + 1) : 1;
  const awarded = Math.round(basePoints * nextCombo);
  return {
    nextState: {
      ...state,
      score: state.score + awarded,
      comboMultiplier: nextCombo,
      comboTimer: 4.5,
    },
    awarded,
    combo: nextCombo,
  };
}

export interface BumperCollisionResult {
  collided: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  speed: number;
  impactIntensity: number;
  normalX: number;
  normalZ: number;
}

export function resolveVehicleBumperCollision(
  playerX: number,
  playerZ: number,
  playerVx: number,
  playerVz: number,
  rivalX: number,
  rivalZ: number,
  minDistance = 2.65,
  restitution = 1.45
): BumperCollisionResult {
  const dx = playerX - rivalX;
  const dz = playerZ - rivalZ;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDistance * minDistance || distSq < 0.00001) {
    return {
      collided: false,
      x: playerX,
      z: playerZ,
      vx: playerVx,
      vz: playerVz,
      speed: Math.hypot(playerVx, playerVz),
      impactIntensity: 0,
      normalX: 0,
      normalZ: 0,
    };
  }
  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const nz = dz / dist;
  const x = rivalX + nx * minDistance;
  const z = rivalZ + nz * minDistance;
  const relVel = playerVx * nx + playerVz * nz;
  let vx = playerVx;
  let vz = playerVz;
  let impactIntensity = 0.28;
  if (relVel < 0) {
    impactIntensity = Math.min(1, Math.max(0.28, Math.abs(relVel) / 14));
    vx -= restitution * relVel * nx;
    vz -= restitution * relVel * nz;
  } else {
    vx += nx * 3.8;
    vz += nz * 3.8;
  }
  return {
    collided: true,
    x,
    z,
    vx,
    vz,
    speed: Math.hypot(vx, vz),
    impactIntensity,
    normalX: nx,
    normalZ: nz,
  };
}
