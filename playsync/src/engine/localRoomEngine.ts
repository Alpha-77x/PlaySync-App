import {
  type ArenaModeId,
  type InputType,
  ARENA_MODES,
  LIVERY_PALETTE,
  addGuestToNextSlot,
  createInitialLobbies,
  createInitialVehicleSim,
  generateRoomPin,
  removeGuestFromSlot,
  toggleSlotReady,
  updateSlotLivery,
} from './arenaLogic';
import type { PlayerNetTransform, ServerRoomSnapshot } from '../shared/multiplayerProtocol';

export const LOCAL_CLIENT_ID = 'local-host';

export function createLocalRoomSnapshot(params: {
  modeId: ArenaModeId;
  roomPin?: string;
  playerName: string;
  inputType: InputType;
  liveryColor: string;
}): ServerRoomSnapshot {
  const lobbies = createInitialLobbies();
  const baseLobby = lobbies[params.modeId];
  const safeName = params.playerName.trim().slice(0, 18) || 'Host Console';
  const safeLivery = /^#[0-9a-fA-F]{6}$/.test(params.liveryColor)
    ? params.liveryColor
    : ARENA_MODES[params.modeId].accentColor;

  const slots = baseLobby.slots.map((slot, idx) =>
    idx === 0
      ? {
          ...slot,
          name: safeName,
          inputType: params.inputType,
          liveryColor: safeLivery,
          ready: true,
        }
      : slot
  );

  const baseSim = createInitialVehicleSim(params.modeId);
  const hostPlayer: PlayerNetTransform = {
    clientId: LOCAL_CLIENT_ID,
    slotNumber: 1,
    name: safeName,
    liveryColor: safeLivery,
    isBot: false,
    x: baseSim.x,
    z: baseSim.z,
    heading: baseSim.heading,
    speed: 0,
    score: 0,
    hits: 0,
    isBoosting: false,
    shieldActive: false,
    turretAngle: 0,
    updatedAt: Date.now(),
  };

  return {
    roomPin: params.roomPin && /^\d{4}$/.test(params.roomPin) ? params.roomPin : baseLobby.roomPin,
    modeId: params.modeId,
    hostClientId: LOCAL_CLIENT_ID,
    matchPhase: 'lobby',
    isSandbox: false,
    roundNumber: 1,
    roundSeconds: baseLobby.roundSeconds,
    timeLeft: baseLobby.roundSeconds,
    slots,
    players: [hostPlayer],
  };
}

export function addLocalBotToRoom(room: ServerRoomSnapshot, customName?: string): ServerRoomSnapshot {
  const nextSlots = addGuestToNextSlot(room.slots, customName, 'AI Bot', room.modeId);
  const addedSlot = nextSlots.find(
    (slot, idx) => slot.status !== 'empty' && room.slots[idx]?.status === 'empty'
  );
  if (!addedSlot) return room;

  const angle = (addedSlot.slotNumber - 1) * ((Math.PI * 2) / 8);
  const radius = room.modeId === 'f1' ? 24.5 : 16.5;
  const botPlayer: PlayerNetTransform = {
    clientId: `bot-${addedSlot.slotNumber}`,
    slotNumber: addedSlot.slotNumber,
    name: addedSlot.name,
    liveryColor: addedSlot.liveryColor,
    isBot: true,
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    heading: angle + Math.PI * 0.5,
    speed: 0,
    score: 0,
    hits: 0,
    isBoosting: false,
    shieldActive: false,
    turretAngle: 0,
    updatedAt: Date.now(),
  };

  return {
    ...room,
    slots: nextSlots,
    players: [...room.players, botPlayer],
  };
}

export function removeLocalSlotFromRoom(
  room: ServerRoomSnapshot,
  slotNumber: number
): ServerRoomSnapshot {
  if (slotNumber === 1) return room;
  return {
    ...room,
    slots: removeGuestFromSlot(room.slots, slotNumber),
    players: room.players.filter((p) => p.slotNumber !== slotNumber),
  };
}

export function updateLocalHostLivery(
  room: ServerRoomSnapshot,
  liveryColor: string
): ServerRoomSnapshot {
  const validHex = LIVERY_PALETTE.some((c) => c.hex === liveryColor) || /^#[0-9a-fA-F]{6}$/.test(liveryColor);
  if (!validHex) return room;

  return {
    ...room,
    slots: updateSlotLivery(room.slots, 1, liveryColor),
    players: room.players.map((p) =>
      p.clientId === LOCAL_CLIENT_ID ? { ...p, liveryColor } : p
    ),
  };
}

export function toggleLocalHostReady(room: ServerRoomSnapshot): ServerRoomSnapshot {
  return {
    ...room,
    slots: toggleSlotReady(room.slots, 1),
  };
}

export function updateLocalRoundSeconds(
  room: ServerRoomSnapshot,
  roundSeconds: number
): ServerRoomSnapshot {
  const clamped = Math.max(30, Math.min(180, Math.round(roundSeconds)));
  return {
    ...room,
    roundSeconds: clamped,
    timeLeft: room.matchPhase === 'lobby' ? clamped : room.timeLeft,
  };
}

export function regenerateLocalRoomPin(room: ServerRoomSnapshot): ServerRoomSnapshot {
  return {
    ...room,
    roomPin: generateRoomPin(room.roomPin),
  };
}

export function startLocalMatch(room: ServerRoomSnapshot, sandbox: boolean): ServerRoomSnapshot {
  const nextRound = room.matchPhase === 'results' ? room.roundNumber + 1 : room.roundNumber;
  const baseSim = createInitialVehicleSim(room.modeId);
  return {
    ...room,
    matchPhase: 'playing',
    isSandbox: sandbox,
    roundNumber: nextRound,
    timeLeft: room.roundSeconds,
    slots: room.slots.map((slot) =>
      slot.status === 'empty' ? slot : { ...slot, score: 0, driftPoints: 0, eliminations: 0 }
    ),
    players: room.players.map((p) => {
      const spreadAngle = (p.slotNumber - 1) * ((Math.PI * 2) / 8);
      const radius = room.modeId === 'f1' ? 24.5 : 16.5;
      return {
        ...p,
        x: p.slotNumber === 1 ? baseSim.x : Math.cos(spreadAngle) * radius,
        z: p.slotNumber === 1 ? baseSim.z : Math.sin(spreadAngle) * radius,
        heading: baseSim.heading,
        speed: 0,
        score: 0,
        hits: 0,
      };
    }),
  };
}

export function tickLocalMatchSecond(room: ServerRoomSnapshot): ServerRoomSnapshot {
  if (room.matchPhase !== 'playing' || room.isSandbox) return room;
  if (room.timeLeft <= 1) {
    return {
      ...room,
      timeLeft: 0,
      matchPhase: 'results',
      slots: room.slots.map((slot) => {
        if (slot.status === 'empty') return slot;
        const player = room.players.find((p) => p.slotNumber === slot.slotNumber);
        let finalScore = Math.max(slot.score, Math.round(player?.score ?? 0));
        if (slot.inputType === 'AI Bot') {
          finalScore = Math.max(finalScore, Math.round(180 + ((slot.slotNumber * 97) % 340)));
        }
        return { ...slot, score: finalScore };
      }),
    };
  }
  return {
    ...room,
    timeLeft: room.timeLeft - 1,
  };
}

export function recordLocalScore(
  room: ServerRoomSnapshot,
  score: number,
  hits: number
): ServerRoomSnapshot {
  const roundedScore = Math.max(0, Math.round(score));
  return {
    ...room,
    slots: room.slots.map((slot) =>
      slot.slotNumber === 1
        ? {
            ...slot,
            score: Math.max(slot.score, roundedScore),
            eliminations: Math.max(slot.eliminations, hits),
          }
        : slot
    ),
    players: room.players.map((p) =>
      p.clientId === LOCAL_CLIENT_ID
        ? {
            ...p,
            score: Math.max(p.score, roundedScore),
            hits: Math.max(p.hits, hits),
          }
        : p
    ),
  };
}
