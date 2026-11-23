import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
  type ArenaModeId,
  type CarChoiceId,
  type InputType,
  type MatchPhase,
  type PlayerSlot,
  ARENA_MODES,
  ARENA_MODE_ORDER,
  LIVERY_PALETTE,
  createInitialLobbies,
  createInitialVehicleSim,
  generateRoomPin,
  getModeStartPose,
} from './src/engine/arenaLogic.ts';
import { getNordschleifeStartPose } from './src/engine/trackMath.ts';
import type {
  ClientToServerMessage,
  PlayerNetTransform,
  RoomSummary,
  ServerRoomSnapshot,
  ServerToClientMessage,
} from './src/shared/multiplayerProtocol.ts';

interface InternalRoom {
  modeId: ArenaModeId;
  roomPin: string;
  hostClientId: string | null;
  matchPhase: MatchPhase;
  isSandbox: boolean;
  roundNumber: number;
  totalRounds: number;
  roundSeconds: number;
  targetLaps: number;
  targetScore: number;
  timeLeft: number;
  slots: PlayerSlot[];
  players: Map<string, PlayerNetTransform>;
  clientSlots: Map<string, number>; // clientId -> slotNumber (1..8)
}

interface ClientSession {
  clientId: string;
  ws: WebSocket;
  isAlive: boolean;
  roomPin: string | null;
  slotNumber: number | null;
}

const initialLobbies = createInitialLobbies();
const roomsByMode = new Map<ArenaModeId, InternalRoom>();
const roomsByPin = new Map<string, InternalRoom>();
const sessions = new Map<WebSocket, ClientSession>();

function makeFreshRoom(modeId: ArenaModeId, pin: string): InternalRoom {
  const defaultSeconds = modeId === 'f1' ? 120 : 60;
  return {
    modeId,
    roomPin: pin,
    hostClientId: null,
    matchPhase: 'lobby',
    isSandbox: false,
    roundNumber: 1,
    totalRounds: 3,
    roundSeconds: defaultSeconds,
    targetLaps: modeId === 'f1' ? 3 : 0,
    targetScore: 0,
    timeLeft: defaultSeconds,
    slots: Array.from({ length: 8 }, (_, idx) => {
      const hostHex = ARENA_MODES[modeId].accentColor;
      const otherPalette = LIVERY_PALETTE.filter((c) => c.hex !== hostHex);
      const slotHex = idx === 0 ? hostHex : otherPalette[(idx - 1) % otherPalette.length].hex;
      return {
        id: `${modeId}-p${idx + 1}`,
        slotNumber: idx + 1,
        name: `Slot ${idx + 1}`,
        status: 'empty',
        inputType: 'Touch & Gyro',
        ready: false,
        pingMs: 0,
        liveryColor: slotHex,
        score: 0,
        accuracy: 0,
        driftPoints: 0,
        eliminations: 0,
      };
    }),
    players: new Map(),
    clientSlots: new Map(),
  };
}

for (const modeId of ARENA_MODE_ORDER) {
  const lobby = initialLobbies[modeId];
  const room = makeFreshRoom(modeId, lobby.roomPin);
  roomsByMode.set(modeId, room);
  roomsByPin.set(room.roomPin, room);
}

function serializeRoom(room: InternalRoom): ServerRoomSnapshot {
  return {
    roomPin: room.roomPin,
    modeId: room.modeId,
    hostClientId: room.hostClientId,
    matchPhase: room.matchPhase,
    isSandbox: room.isSandbox,
    roundNumber: room.roundNumber,
    totalRounds: room.totalRounds,
    roundSeconds: room.roundSeconds,
    targetLaps: room.targetLaps,
    targetScore: room.targetScore,
    timeLeft: room.timeLeft,
    slots: room.slots,
    players: Array.from(room.players.values()),
  };
}

function sendJson(ws: WebSocket, payload: ServerToClientMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(
  room: InternalRoom,
  payload: ServerToClientMessage,
  excludeClientId?: string
): void {
  const encoded = JSON.stringify(payload);
  for (const session of sessions.values()) {
    if (
      session.roomPin === room.roomPin &&
      session.clientId !== excludeClientId &&
      session.ws.readyState === WebSocket.OPEN
    ) {
      session.ws.send(encoded);
    }
  }
}

function broadcastRoomState(room: InternalRoom): void {
  broadcastToRoom(room, { type: 'room:state', room: serializeRoom(room) });
}

function detachClientFromRoom(session: ClientSession): void {
  if (!session.roomPin) return;
  const room = roomsByPin.get(session.roomPin);
  session.roomPin = null;
  session.slotNumber = null;
  if (!room) return;

  const slotNum = room.clientSlots.get(session.clientId);
  room.clientSlots.delete(session.clientId);
  room.players.delete(session.clientId);

  if (slotNum !== undefined) {
    const idx = slotNum - 1;
    if (room.slots[idx]) {
      room.slots[idx] = {
        ...room.slots[idx],
        name: `Slot ${slotNum}`,
        status: 'empty',
        ready: false,
        pingMs: 0,
        score: 0,
        accuracy: 0,
        driftPoints: 0,
        eliminations: 0,
      };
    }
  }

  // Reassign host or reset room cleanly whenever 0 human players remain
  const remainingHuman = Array.from(room.clientSlots.entries())[0];
  if (remainingHuman) {
    if (room.hostClientId === session.clientId || !room.clientSlots.has(room.hostClientId ?? '')) {
      room.hostClientId = remainingHuman[0];
      const nextIdx = remainingHuman[1] - 1;
      if (room.slots[nextIdx]) {
        room.slots[nextIdx] = { ...room.slots[nextIdx], status: 'host', ready: true };
      }
    }
    broadcastRoomState(room);
  } else {
    room.hostClientId = null;
    room.matchPhase = 'lobby';
    room.timeLeft = room.roundSeconds;
    room.players.clear();
    room.slots = makeFreshRoom(room.modeId, room.roomPin).slots;
    if (roomsByMode.get(room.modeId) !== room) {
      roomsByPin.delete(room.roomPin);
    } else {
      broadcastRoomState(room);
    }
  }
}

function pruneDeadClients(room: InternalRoom): void {
  for (const [cid, slotNum] of Array.from(room.clientSlots.entries())) {
    const activeSession = Array.from(sessions.values()).find(
      (s) => s.clientId === cid && s.ws.readyState === WebSocket.OPEN
    );
    if (!activeSession) {
      room.clientSlots.delete(cid);
      room.players.delete(cid);
      if (room.slots[slotNum - 1]) {
        room.slots[slotNum - 1] = {
          ...room.slots[slotNum - 1],
          name: `Slot ${slotNum}`,
          status: 'empty',
          ready: false,
          pingMs: 0,
        };
      }
    }
  }
  if (room.clientSlots.size === 0) {
    room.hostClientId = null;
    room.matchPhase = 'lobby';
    room.timeLeft = room.roundSeconds;
    room.players.clear();
    room.slots = makeFreshRoom(room.modeId, room.roomPin).slots;
  }
}

function assignSlotToClient(
  room: InternalRoom,
  session: ClientSession,
  playerName: string,
  inputType: InputType,
  liveryColor: string,
  carChoice: CarChoiceId = 'bmw-m5'
): boolean {
  // Idempotent guard: already seated in this room
  const existingSlot = room.clientSlots.get(session.clientId);
  if (existingSlot !== undefined) {
    session.roomPin = room.roomPin;
    session.slotNumber = existingSlot;
    return true;
  }

  const emptyIndex = room.slots.findIndex((s) => s.status === 'empty');
  if (emptyIndex === -1) return false;

  const slotNumber = emptyIndex + 1;
  const isFirstHuman = room.hostClientId === null;
  if (isFirstHuman) {
    room.hostClientId = session.clientId;
  }

  const safeName =
    playerName.trim().slice(0, 18) ||
    (isFirstHuman ? 'Host Console' : `Player ${slotNumber}`);
  const safeLivery = /^#[0-9a-fA-F]{6}$/.test(liveryColor)
    ? liveryColor
    : room.slots[emptyIndex].liveryColor;

  room.slots[emptyIndex] = {
    ...room.slots[emptyIndex],
    name: safeName,
    status: isFirstHuman ? 'host' : 'connected',
    inputType,
    ready: true,
    pingMs: 8,
    liveryColor: safeLivery,
    score: 0,
    accuracy: 100,
    driftPoints: 0,
    eliminations: 0,
  };

  room.clientSlots.set(session.clientId, slotNumber);
  session.roomPin = room.roomPin;
  session.slotNumber = slotNumber;

  const pose = getModeStartPose(room.modeId, slotNumber - 1);
  room.players.set(session.clientId, {
    clientId: session.clientId,
    slotNumber,
    name: safeName,
    liveryColor: safeLivery,
    carChoice,
    isBot: false,
    x: pose.x,
    z: pose.z,
    elevationY: 0,
    heading: pose.heading,
    speed: 0,
    score: 0,
    hits: 0,
    trackProgress: 0,
    crossedStartGate: false,
    isBoosting: false,
    shieldActive: false,
    turretAngle: 0,
    updatedAt: Date.now(),
  });

  return true;
}

// Authoritative server 1Hz match clock & bot progression across all active rooms
const matchClockTimer = setInterval(() => {
  for (const room of roomsByPin.values()) {
    if (room.matchPhase !== 'playing' || room.isSandbox) continue;

    if (room.timeLeft <= 1) {
      // Finalize real round scores into slots (no arbitrary fake bot scores!)
      room.timeLeft = 0;
      room.matchPhase = 'results';
      for (const slot of room.slots) {
        if (slot.status === 'empty') continue;
        let matchedScore = slot.score;
        let matchedElims = slot.eliminations;
        for (const p of room.players.values()) {
          if (p.slotNumber === slot.slotNumber) {
            matchedScore = Math.max(matchedScore, Math.round(p.score));
            matchedElims = Math.max(matchedElims, Math.round(p.eliminations ?? p.hits ?? 0));
          }
        }
        slot.score = matchedScore;
        slot.eliminations = matchedElims;
      }
      broadcastRoomState(room);
      broadcastToRoom(room, {
        type: 'room:event',
        text: `Round ${room.roundNumber} complete!`,
        accent: '#ffb703',
      });
    } else {
      room.timeLeft -= 1;
      broadcastRoomState(room);
    }
  }
}, 1000);

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      rooms: roomsByMode.size,
      connectedClients: sessions.size,
    });
  });

  app.get('/api/rooms', (_req, res) => {
    const list: RoomSummary[] = ARENA_MODE_ORDER.map((modeId) => {
      const r = roomsByMode.get(modeId)!;
      return {
        modeId: r.modeId,
        roomPin: r.roomPin,
        playerCount: r.slots.filter((s) => s.status !== 'empty').length,
        matchPhase: r.matchPhase,
      };
    });
    res.json({ rooms: list });
  });

  app.get('/api/rooms/:pin', (req, res) => {
    const pin = String(req.params.pin || '').trim();
    const room = roomsByPin.get(pin);
    if (!room) {
      res.json({ found: false });
      return;
    }
    pruneDeadClients(room);
    res.json({
      found: true,
      modeId: room.modeId,
      roomPin: room.roomPin,
      playerCount: room.slots.filter((s) => s.status !== 'empty').length,
      matchPhase: room.matchPhase,
    });
  });

  app.post('/api/rooms/roll', (req, res) => {
    const requestedMode = (req.body?.modeId as ArenaModeId | undefined);
    const targets = requestedMode && roomsByMode.has(requestedMode) ? [requestedMode] : ARENA_MODE_ORDER;
    for (const modeId of targets) {
      const curRoom = roomsByMode.get(modeId)!;
      pruneDeadClients(curRoom);
      const oldPin = curRoom.roomPin;
      let nextPin = generateRoomPin(oldPin);
      while (roomsByPin.has(nextPin)) {
        nextPin = generateRoomPin(nextPin);
      }

      if (curRoom.clientSlots.size === 0) {
        roomsByPin.delete(oldPin);
        curRoom.roomPin = nextPin;
        curRoom.hostClientId = null;
        curRoom.matchPhase = 'lobby';
        curRoom.timeLeft = curRoom.roundSeconds;
        curRoom.players.clear();
        curRoom.slots = makeFreshRoom(modeId, nextPin).slots;
        roomsByPin.set(nextPin, curRoom);
        broadcastRoomState(curRoom);
      } else {
        // Keep existing occupied room alive under oldPin, allocate a fresh idle showcase room for the Hub
        const freshRoom = makeFreshRoom(modeId, nextPin);
        roomsByMode.set(modeId, freshRoom);
        roomsByPin.set(nextPin, freshRoom);
      }
    }
    const list: RoomSummary[] = ARENA_MODE_ORDER.map((modeId) => {
      const r = roomsByMode.get(modeId)!;
      return {
        modeId: r.modeId,
        roomPin: r.roomPin,
        playerCount: r.slots.filter((s) => s.status !== 'empty').length,
        matchPhase: r.matchPhase,
      };
    });
    res.json({ rooms: list });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url ?? '';
    if (reqUrl === '/ws' || reqUrl.startsWith('/ws?')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  let nextClientCounter = 1;

  wss.on('connection', (ws) => {
    const clientId = `c-${nextClientCounter++}-${Math.random().toString(36).slice(2, 6)}`;
    const session: ClientSession = {
      clientId,
      ws,
      isAlive: true,
      roomPin: null,
      slotNumber: null,
    };
    sessions.set(ws, session);
    ws.on('pong', () => {
      session.isAlive = true;
    });
    sendJson(ws, { type: 'welcome', clientId });

    ws.on('message', (raw) => {
      session.isAlive = true;
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(String(raw)) as ClientToServerMessage;
      } catch {
        return;
      }

      if (msg.type === 'ping:req') {
        sendJson(ws, { type: 'pong', t: msg.t });
        return;
      }

      if (msg.type === 'room:join') {
        if (session.roomPin) {
          detachClientFromRoom(session);
        }

        let targetRoom: InternalRoom | undefined;
        if (msg.asHost) {
          const candidate =
            msg.roomPin && roomsByPin.has(msg.roomPin)
              ? roomsByPin.get(msg.roomPin)
              : roomsByMode.get(msg.modeId);
          if (candidate) {
            pruneDeadClients(candidate);
          }
          if (
            candidate &&
            (candidate.clientSlots.size === 0 || candidate.hostClientId === null) &&
            candidate.modeId === msg.modeId
          ) {
            targetRoom = candidate;
          } else {
            let freshPin =
              msg.roomPin && /^\d{4}$/.test(msg.roomPin) && !roomsByPin.has(msg.roomPin)
                ? msg.roomPin
                : generateRoomPin(candidate?.roomPin);
            while (roomsByPin.has(freshPin)) {
              freshPin = generateRoomPin(freshPin);
            }
            const freshRoom = makeFreshRoom(msg.modeId, freshPin);
            roomsByPin.set(freshPin, freshRoom);
            roomsByMode.set(msg.modeId, freshRoom);
            targetRoom = freshRoom;
          }
        } else {
          if (msg.roomPin) {
            targetRoom = roomsByPin.get(msg.roomPin);
            if (!targetRoom && /^\d{4}$/.test(msg.roomPin)) {
              sendJson(ws, {
                type: 'room:error',
                message: `Room #${msg.roomPin} not found or host left — ask host for the active PIN.`,
              });
              return;
            }
          } else {
            targetRoom = roomsByMode.get(msg.modeId);
          }
          if (targetRoom) {
            pruneDeadClients(targetRoom);
          }
        }

        if (!targetRoom) {
          sendJson(ws, { type: 'room:error', message: 'Room PIN not found.' });
          return;
        }

        const seated = assignSlotToClient(
          targetRoom,
          session,
          msg.playerName,
          msg.inputType,
          msg.liveryColor,
          msg.carChoice === 'monster-truck' ? 'monster-truck' : 'bmw-m5'
        );

        if (!seated) {
          sendJson(ws, { type: 'room:error', message: 'Lobby is full (8/8 players).' });
          return;
        }

        broadcastRoomState(targetRoom);
        broadcastToRoom(targetRoom, {
          type: 'room:event',
          text: `${msg.playerName || 'Player'} joined ${ARENA_MODES[targetRoom.modeId].title}`,
          accent: '#00f5a0',
        });
        return;
      }

      if (msg.type === 'room:leave') {
        detachClientFromRoom(session);
        return;
      }

      const room = session.roomPin ? roomsByPin.get(session.roomPin) : undefined;
      if (!room) return;

      if (msg.type === 'room:ready' && session.slotNumber !== null) {
        const slot = room.slots[session.slotNumber - 1];
        if (slot && slot.status !== 'empty') {
          slot.ready = Boolean(msg.ready);
          broadcastRoomState(room);
        }
        return;
      }

      if (msg.type === 'room:livery' && session.slotNumber !== null) {
        const slot = room.slots[session.slotNumber - 1];
        if (slot && /^#[0-9a-fA-F]{6}$/.test(msg.liveryColor)) {
          slot.liveryColor = msg.liveryColor;
          const netP = room.players.get(session.clientId);
          if (netP) netP.liveryColor = msg.liveryColor;
          broadcastRoomState(room);
        }
        return;
      }

      if (msg.type === 'room:car' && session.slotNumber !== null) {
        const netP = room.players.get(session.clientId);
        if (netP && (msg.carChoice === 'bmw-m5' || msg.carChoice === 'monster-truck')) {
          netP.carChoice = msg.carChoice;
          broadcastRoomState(room);
        }
        return;
      }

      if (msg.type === 'room:settings') {
        let changed = false;
        if (typeof msg.roundSeconds === 'number' && Number.isFinite(msg.roundSeconds)) {
          const clampedSec = Math.max(15, Math.min(600, Math.round(msg.roundSeconds)));
          room.roundSeconds = clampedSec;
          if (room.matchPhase === 'lobby') {
            room.timeLeft = clampedSec;
          }
          changed = true;
        }
        if (typeof msg.targetLaps === 'number' && Number.isFinite(msg.targetLaps)) {
          room.targetLaps = Math.max(0, Math.min(10, Math.round(msg.targetLaps)));
          changed = true;
        }
        if (typeof msg.targetScore === 'number' && Number.isFinite(msg.targetScore)) {
          room.targetScore = Math.max(0, Math.min(10000, Math.round(msg.targetScore)));
          changed = true;
        }
        if (typeof msg.totalRounds === 'number' && Number.isFinite(msg.totalRounds)) {
          room.totalRounds = Math.max(1, Math.min(10, Math.round(msg.totalRounds)));
          changed = true;
        }
        if (changed) {
          broadcastRoomState(room);
        }
        return;
      }

      if (msg.type === 'room:regenerate_pin') {
        const oldPin = room.roomPin;
        let nextPin = generateRoomPin(oldPin);
        while (roomsByPin.has(nextPin)) {
          nextPin = generateRoomPin(nextPin);
        }
        roomsByPin.delete(oldPin);
        room.roomPin = nextPin;
        roomsByPin.set(nextPin, room);
        for (const s of sessions.values()) {
          if (s.roomPin === oldPin) {
            s.roomPin = nextPin;
          }
        }
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'room:add_bot') {
        const emptyIdx = room.slots.findIndex((s) => s.status === 'empty');
        if (emptyIdx === -1) return;
        const slotNumber = emptyIdx + 1;
        const botName = msg.name?.trim().slice(0, 18) || `AI Rival ${slotNumber}`;
        const botColor = LIVERY_PALETTE[(emptyIdx + 2) % LIVERY_PALETTE.length].hex;
        room.slots[emptyIdx] = {
          ...room.slots[emptyIdx],
          name: botName,
          status: 'connected',
          inputType: 'AI Bot',
          ready: true,
          pingMs: 2,
          liveryColor: botColor,
          score: 0,
          accuracy: 88,
          driftPoints: 0,
          eliminations: 0,
        };
        const botId = `bot-${room.modeId}-${slotNumber}`;
        const botPose = getModeStartPose(room.modeId, slotNumber - 1);
        room.players.set(botId, {
          clientId: botId,
          slotNumber,
          name: botName,
          liveryColor: botColor,
          isBot: true,
          x: botPose.x,
          z: botPose.z,
          heading: botPose.heading,
          speed: 0,
          score: 0,
          hits: 0,
          isBoosting: false,
          shieldActive: false,
          turretAngle: 0,
          updatedAt: Date.now(),
        });
        broadcastRoomState(room);
        broadcastToRoom(room, {
          type: 'room:event',
          text: `${botName} entered grid slot P${slotNumber}`,
          accent: '#38bdf8',
        });
        return;
      }

      if (msg.type === 'room:remove_slot') {
        if (msg.slotNumber < 1 || msg.slotNumber > 8) return;
        const slot = room.slots[msg.slotNumber - 1];
        if (!slot || slot.status === 'host' || slot.status === 'empty') return;

        // If a human is in that slot, only allow removing bots from remote or self
        if (slot.inputType === 'AI Bot') {
          const botId = `bot-${room.modeId}-${msg.slotNumber}`;
          room.players.delete(botId);
          room.slots[msg.slotNumber - 1] = {
            ...slot,
            name: `Slot ${msg.slotNumber}`,
            status: 'empty',
            ready: false,
            pingMs: 0,
            score: 0,
            accuracy: 0,
            driftPoints: 0,
            eliminations: 0,
          };
          broadcastRoomState(room);
        }
        return;
      }

      if (msg.type === 'match:start') {
        if (room.matchPhase === 'results') {
          room.roundNumber = room.roundNumber >= room.totalRounds ? 1 : room.roundNumber + 1;
        }
        room.isSandbox = false;
        room.timeLeft = room.roundSeconds;
        room.matchPhase = 'playing';
        for (const p of room.players.values()) {
          p.score = 0;
          p.hits = 0;
          p.eliminations = 0;
          p.alive = true;
          p.hasCrown = false;
          p.hp = 5;
          p.laps = 1;
          p.trackProgress = 0;
          p.crossedStartGate = false;
        }
        for (const s of room.slots) {
          if (s.status !== 'empty') {
            s.score = 0;
            s.driftPoints = 0;
            s.eliminations = 0;
          }
        }
        broadcastRoomState(room);
        broadcastToRoom(room, {
          type: 'room:event',
          text: `${ARENA_MODES[room.modeId].title} Round ${room.roundNumber}/${room.totalRounds} started!`,
          accent: '#00f5ff',
        });
        return;
      }

      if (msg.type === 'match:pause') {
        if (room.matchPhase === 'playing' || room.matchPhase === 'paused') {
          room.matchPhase = msg.paused ? 'paused' : 'playing';
          broadcastRoomState(room);
        }
        return;
      }

      if (msg.type === 'match:end') {
        room.matchPhase = 'lobby';
        room.timeLeft = room.roundSeconds;
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'match:finish') {
        if (room.matchPhase === 'playing') {
          room.matchPhase = 'results';
          if (Array.isArray(msg.standings)) {
            for (const st of msg.standings) {
              const slot = room.slots[st.slotNumber - 1];
              if (slot && slot.status !== 'empty') {
                slot.score = Math.max(0, Math.round(st.score));
                if (typeof st.eliminations === 'number') {
                  slot.eliminations = Math.max(0, Math.round(st.eliminations));
                }
              }
            }
          }
          broadcastRoomState(room);
          broadcastToRoom(room, {
            type: 'room:event',
            text: `${ARENA_MODES[room.modeId].title} Round ${room.roundNumber} finished!`,
            accent: '#ffb703',
          });
        }
        return;
      }

      if (msg.type === 'player:state') {
        const netP = room.players.get(session.clientId);
        if (netP) {
          netP.x = msg.x;
          netP.z = msg.z;
          if (typeof msg.elevationY === 'number') netP.elevationY = msg.elevationY;
          netP.heading = msg.heading;
          netP.speed = msg.speed;
          netP.score = msg.score;
          netP.hits = msg.hits;
          if (typeof msg.eliminations === 'number') netP.eliminations = msg.eliminations;
          if (typeof msg.alive === 'boolean') netP.alive = msg.alive;
          if (typeof msg.hasCrown === 'boolean') netP.hasCrown = msg.hasCrown;
          if (typeof msg.hp === 'number') netP.hp = msg.hp;
          if (typeof msg.laps === 'number') netP.laps = msg.laps;
          if (typeof msg.trackProgress === 'number') netP.trackProgress = msg.trackProgress;
          if (typeof msg.crossedStartGate === 'boolean') netP.crossedStartGate = msg.crossedStartGate;
          if (msg.carChoice === 'bmw-m5' || msg.carChoice === 'monster-truck') netP.carChoice = msg.carChoice;
          netP.isBoosting = msg.isBoosting;
          netP.shieldActive = msg.shieldActive;
          netP.turretAngle = msg.turretAngle;
          netP.updatedAt = Date.now();
          if (session.slotNumber !== null && room.slots[session.slotNumber - 1]) {
            room.slots[session.slotNumber - 1].score = Math.round(msg.score);
            room.slots[session.slotNumber - 1].eliminations = Math.round(
              msg.eliminations ?? msg.hits ?? 0
            );
          }
        }
        broadcastToRoom(
          room,
          {
            type: 'player:state',
            clientId: session.clientId,
            x: msg.x,
            z: msg.z,
            elevationY: msg.elevationY,
            heading: msg.heading,
            speed: msg.speed,
            score: msg.score,
            hits: msg.hits,
            eliminations: msg.eliminations,
            alive: msg.alive,
            hasCrown: msg.hasCrown,
            hp: msg.hp,
            laps: msg.laps,
            trackProgress: msg.trackProgress,
            crossedStartGate: msg.crossedStartGate,
            carChoice: msg.carChoice,
            isBoosting: msg.isBoosting,
            shieldActive: msg.shieldActive,
            turretAngle: msg.turretAngle,
          },
          session.clientId
        );
        return;
      }

      if (msg.type === 'player:action') {
        broadcastToRoom(
          room,
          {
            type: 'player:action',
            clientId: session.clientId,
            actionType: msg.actionType,
            x: msg.x,
            z: msg.z,
            heading: msg.heading,
          },
          session.clientId
        );
        return;
      }

      if (msg.type === 'player:pvp') {
        if (msg.effect === 'crown_steal') {
          for (const p of room.players.values()) {
            p.hasCrown = p.clientId === session.clientId;
          }
        }
        for (const s of sessions.values()) {
          if (
            s.roomPin === room.roomPin &&
            s.clientId === msg.targetClientId &&
            s.ws.readyState === WebSocket.OPEN
          ) {
            sendJson(s.ws, {
              type: 'player:pvp',
              sourceClientId: session.clientId,
              targetClientId: msg.targetClientId,
              effect: msg.effect,
              vx: msg.vx,
              vz: msg.vz,
              damage: msg.damage,
              attackerName: msg.attackerName ?? room.players.get(session.clientId)?.name ?? 'Rival',
            });
            break;
          }
        }
        return;
      }

      if (msg.type === 'player:hit') {
        const attacker = room.players.get(session.clientId);
        if (attacker) {
          attacker.score += msg.points;
          attacker.hits += 1;
          if (session.slotNumber !== null && room.slots[session.slotNumber - 1]) {
            room.slots[session.slotNumber - 1].score = Math.round(attacker.score);
            room.slots[session.slotNumber - 1].eliminations += 1;
          }
        }
        broadcastToRoom(room, {
          type: 'room:event',
          text: `${attacker?.name ?? 'Player'}: ${msg.reason} (+${msg.points})`,
          accent: '#ef1a4b',
        });
      }
    });

    ws.on('close', () => {
      detachClientFromRoom(session);
      sessions.delete(ws);
    });
  });

  // Periodic WebSocket heartbeat reaper so abruptly dropped mobile/headless sockets free slots
  const heartbeatTimer = setInterval(() => {
    for (const [ws, session] of Array.from(sessions.entries())) {
      if (!session.isAlive) {
        detachClientFromRoom(session);
        sessions.delete(ws);
        ws.terminate();
        continue;
      }
      session.isAlive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }, 15000);

  let viteDevServer: { close: () => Promise<void> } | null = null;

  if (process.env.NODE_ENV !== 'production') {
    // Vite 8 injects /@vite/client into dev HTML/CSS even when HMR is disabled,
    // and the stock client still attempts a WebSocket connection to port 24678.
    // Serve a clean no-WebSocket client shim supporting CSS updates and hot stubs.
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript');
      res.send(`import "/@vite/env";
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => {
        lastInsertedStyle = undefined;
      }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document
      .querySelectorAll(\`link[rel="stylesheet"][data-vite-dev-id="\${CSS.escape(id)}"]\`)
      .forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
export class ErrorOverlay extends (globalThis.HTMLElement || class {}) {}
`);
    });

    // Initialize Vite concurrently so the HTTP server binds port 3000 immediately
    // without blocking container startup readiness probes.
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
          ws: false,
          allowedHosts: true,
        },
        appType: 'spa',
      }).then((v) => {
        viteDevServer = v;
        return v;
      })
    );
    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite dev middleware:', err);
    });

    app.use((req, res, next) => {
      vitePromise
        .then((vite) => vite.middlewares(req, res, next))
        .catch(next);
    });
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  let cliPort: number | undefined;
  let cliHost: string | undefined;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port' && args[i + 1]) {
      cliPort = Number(args[++i]);
    } else if (arg.startsWith('--port=')) {
      cliPort = Number(arg.slice('--port='.length));
    } else if (arg === '--host' && args[i + 1]) {
      cliHost = args[++i];
    } else if (arg.startsWith('--host=')) {
      cliHost = arg.slice('--host='.length);
    } else if (/^\d+$/.test(arg) && !cliPort) {
      cliPort = Number(arg);
    } else if (!arg.startsWith('-') && !cliHost) {
      cliHost = arg;
    }
  }

  const npmPort = process.env.npm_config_port ? Number(process.env.npm_config_port) : undefined;
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  const safeEnvPort = envPort && envPort !== nginxPort ? envPort : undefined;
  const port = cliPort || npmPort || Number(process.env.DEFAULT_APP_PORT) || safeEnvPort || 3000;
  const host = cliHost || process.env.npm_config_host || process.env.HOST || '0.0.0.0';

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(matchClockTimer);
    clearInterval(heartbeatTimer);
    for (const client of wss.clients) {
      client.terminate();
    }
    wss.close();
    server.close(async () => {
      try {
        if (viteDevServer) await viteDevServer.close();
      } catch {
        // Ignore cleanup errors on exit
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      console.log(`PlaySync multiplayer server listening on http://${host}:${port}`);
      resolve();
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start PlaySync server:', err);
  process.exit(1);
});
