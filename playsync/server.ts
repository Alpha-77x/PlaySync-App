import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
  type ArenaModeId,
  type InputType,
  type MatchPhase,
  type PlayerSlot,
  ARENA_MODES,
  ARENA_MODE_ORDER,
  LIVERY_PALETTE,
  createInitialLobbies,
  createInitialVehicleSim,
  generateRoomPin,
} from './src/engine/arenaLogic.ts';
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
  roundSeconds: number;
  timeLeft: number;
  slots: PlayerSlot[];
  players: Map<string, PlayerNetTransform>;
  clientSlots: Map<string, number>; // clientId -> slotNumber (1..8)
}

interface ClientSession {
  clientId: string;
  ws: WebSocket;
  roomPin: string | null;
  slotNumber: number | null;
}

const initialLobbies = createInitialLobbies();
const roomsByMode = new Map<ArenaModeId, InternalRoom>();
const roomsByPin = new Map<string, InternalRoom>();
const sessions = new Map<WebSocket, ClientSession>();

function makeFreshRoom(modeId: ArenaModeId, pin: string): InternalRoom {
  return {
    modeId,
    roomPin: pin,
    hostClientId: null,
    matchPhase: 'lobby',
    isSandbox: false,
    roundNumber: 1,
    roundSeconds: 60,
    timeLeft: 60,
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
    roundSeconds: room.roundSeconds,
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

  // Reassign host if needed
  if (room.hostClientId === session.clientId) {
    const nextHuman = Array.from(room.clientSlots.entries())[0];
    if (nextHuman) {
      room.hostClientId = nextHuman[0];
      const nextIdx = nextHuman[1] - 1;
      if (room.slots[nextIdx]) {
        room.slots[nextIdx] = { ...room.slots[nextIdx], status: 'host', ready: true };
      }
    } else {
      room.hostClientId = null;
      // If no human players remain, reset bots & phase cleanly
      room.matchPhase = 'lobby';
      room.timeLeft = room.roundSeconds;
      room.players.clear();
      room.slots = makeFreshRoom(room.modeId, room.roomPin).slots;
    }
  }

  broadcastRoomState(room);
}

function assignSlotToClient(
  room: InternalRoom,
  session: ClientSession,
  playerName: string,
  inputType: InputType,
  liveryColor: string
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

  const baseSim = createInitialVehicleSim(room.modeId);
  const spreadAngle = (slotNumber - 1) * ((Math.PI * 2) / 8);
  const radius = room.modeId === 'f1' ? 24.5 : 16.5;
  room.players.set(session.clientId, {
    clientId: session.clientId,
    slotNumber,
    name: safeName,
    liveryColor: safeLivery,
    isBot: false,
    x: slotNumber === 1 ? baseSim.x : Math.cos(spreadAngle) * radius,
    z: slotNumber === 1 ? baseSim.z : Math.sin(spreadAngle) * radius,
    heading: baseSim.heading,
    speed: 0,
    score: 0,
    hits: 0,
    isBoosting: false,
    shieldActive: false,
    turretAngle: 0,
    updatedAt: Date.now(),
  });

  return true;
}

// Authoritative server 1Hz match clock & bot progression
setInterval(() => {
  for (const room of roomsByMode.values()) {
    if (room.matchPhase !== 'playing' || room.isSandbox) continue;

    if (room.timeLeft <= 1) {
      // Finalize round scores into slots
      room.timeLeft = 0;
      room.matchPhase = 'results';
      for (const slot of room.slots) {
        if (slot.status === 'empty') continue;
        let matchedScore = slot.score;
        for (const p of room.players.values()) {
          if (p.slotNumber === slot.slotNumber) {
            matchedScore = Math.max(matchedScore, Math.round(p.score));
          }
        }
        if (slot.inputType === 'AI Bot') {
          matchedScore = Math.max(matchedScore, Math.round(180 + ((slot.slotNumber * 97) % 340)));
        }
        slot.score = matchedScore;
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
      roomPin: null,
      slotNumber: null,
    };
    sessions.set(ws, session);
    sendJson(ws, { type: 'welcome', clientId });

    ws.on('message', (raw) => {
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
        let targetRoom: InternalRoom | undefined;
        if (msg.roomPin && roomsByPin.has(msg.roomPin)) {
          targetRoom = roomsByPin.get(msg.roomPin);
        } else {
          targetRoom = roomsByMode.get(msg.modeId);
        }

        if (!targetRoom) {
          sendJson(ws, { type: 'room:error', message: 'Room PIN not found.' });
          return;
        }

        if (session.roomPin && session.roomPin !== targetRoom.roomPin) {
          detachClientFromRoom(session);
        }

        const seated = assignSlotToClient(
          targetRoom,
          session,
          msg.playerName,
          msg.inputType,
          msg.liveryColor
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

      if (msg.type === 'room:settings') {
        if ([45, 60, 90].includes(msg.roundSeconds)) {
          room.roundSeconds = msg.roundSeconds;
          if (room.matchPhase === 'lobby') {
            room.timeLeft = msg.roundSeconds;
          }
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
        const angle = (slotNumber * Math.PI) / 4;
        room.players.set(botId, {
          clientId: botId,
          slotNumber,
          name: botName,
          liveryColor: botColor,
          isBot: true,
          x: Math.cos(angle) * 11,
          z: Math.sin(angle) * 11,
          heading: -angle,
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
        room.isSandbox = Boolean(msg.sandbox);
        room.timeLeft = room.roundSeconds;
        room.matchPhase = 'playing';
        for (const p of room.players.values()) {
          p.score = 0;
          p.hits = 0;
        }
        for (const s of room.slots) {
          if (s.status !== 'empty') {
            s.score = 0;
            s.driftPoints = 0;
          }
        }
        broadcastRoomState(room);
        broadcastToRoom(room, {
          type: 'room:event',
          text: `${ARENA_MODES[room.modeId].title} match started!`,
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

      if (msg.type === 'player:state') {
        const netP = room.players.get(session.clientId);
        if (netP) {
          netP.x = msg.x;
          netP.z = msg.z;
          netP.heading = msg.heading;
          netP.speed = msg.speed;
          netP.score = msg.score;
          netP.hits = msg.hits;
          netP.isBoosting = msg.isBoosting;
          netP.shieldActive = msg.shieldActive;
          netP.turretAngle = msg.turretAngle;
          netP.updatedAt = Date.now();
          if (session.slotNumber !== null && room.slots[session.slotNumber - 1]) {
            room.slots[session.slotNumber - 1].score = Math.round(msg.score);
          }
        }
        broadcastToRoom(
          room,
          {
            type: 'player:state',
            clientId: session.clientId,
            x: msg.x,
            z: msg.z,
            heading: msg.heading,
            speed: msg.speed,
            score: msg.score,
            hits: msg.hits,
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
        },
        appType: 'spa',
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
    }
  }

  const port = cliPort || Number(process.env.PORT) || 3000;
  const host = cliHost || process.env.HOST || '0.0.0.0';

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
