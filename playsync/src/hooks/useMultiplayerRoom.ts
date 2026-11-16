import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArenaModeId, InputType } from '../engine/arenaLogic';
import {
  LOCAL_CLIENT_ID,
  addLocalBotToRoom,
  createLocalRoomSnapshot,
  recordLocalScore,
  regenerateLocalRoomPin,
  removeLocalSlotFromRoom,
  startLocalMatch,
  tickLocalMatchSecond,
  toggleLocalHostReady,
  updateLocalHostLivery,
  updateLocalRoundSeconds,
} from '../engine/localRoomEngine';
import type {
  ClientToServerMessage,
  PlayerNetTransform,
  ServerRoomSnapshot,
  ServerToClientMessage,
} from '../shared/multiplayerProtocol';

export interface RemoteActionEvent {
  clientId: string;
  actionType: 'fire' | 'surge' | 'wave' | 'pulse';
  x: number;
  z: number;
  heading: number;
}

export interface RoomFeedEvent {
  id: string;
  text: string;
  accent?: string;
}

interface PendingJoinPayload {
  roomPin?: string;
  modeId: ArenaModeId;
  playerName: string;
  inputType: InputType;
  liveryColor: string;
}

export function useMultiplayerRoom() {
  const [wsConnected, setWsConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(LOCAL_CLIENT_ID);
  const [pingMs, setPingMs] = useState<number>(8);
  const [roomSnapshot, setRoomSnapshot] = useState<ServerRoomSnapshot | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomEvents, setRoomEvents] = useState<RoomFeedEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const wsConnectedRef = useRef(false);
  const clientIdRef = useRef<string | null>(LOCAL_CLIENT_ID);
  const pendingJoinRef = useRef<PendingJoinPayload | null>(null);
  const localRoomRef = useRef<ServerRoomSnapshot | null>(null);
  const remoteVehiclesRef = useRef<Map<string, PlayerNetTransform>>(new Map());
  const remoteActionsRef = useRef<RemoteActionEvent[]>([]);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastStateSentRef = useRef<number>(0);

  const syncRemoteVehiclesFromRoom = useCallback((room: ServerRoomSnapshot, selfId: string | null) => {
    const nextMap = new Map<string, PlayerNetTransform>();
    for (const p of room.players) {
      if (p.clientId !== selfId) {
        const existing = remoteVehiclesRef.current.get(p.clientId);
        nextMap.set(
          p.clientId,
          existing
            ? {
                ...p,
                x: existing.x,
                z: existing.z,
                heading: existing.heading,
                turretAngle: existing.turretAngle,
              }
            : p
        );
      }
    }
    remoteVehiclesRef.current = nextMap;
  }, []);

  const commitLocalRoom = useCallback(
    (updater: (prev: ServerRoomSnapshot) => ServerRoomSnapshot) => {
      if (!localRoomRef.current) return;
      const next = updater(localRoomRef.current);
      localRoomRef.current = next;
      if (!wsConnectedRef.current) {
        setRoomSnapshot(next);
        syncRemoteVehiclesFromRoom(next, LOCAL_CLIENT_ID);
      }
    },
    [syncRemoteVehiclesFromRoom]
  );

  const sendRaw = useCallback((msg: ClientToServerMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    const MAX_RECONNECT_ATTEMPTS = 2;

    function connect() {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        attempt += 1;
        if (attempt <= MAX_RECONNECT_ATTEMPTS) {
          reconnectTimerRef.current = window.setTimeout(connect, 1200);
        }
        return;
      }
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        if (disposed) return;
        attempt = 0;
        wsConnectedRef.current = true;
        setWsConnected(true);
        setRoomError(null);
        ws.send(JSON.stringify({ type: 'ping:req', t: Date.now() }));

        if (pendingJoinRef.current) {
          const j = pendingJoinRef.current;
          ws.send(
            JSON.stringify({
              type: 'room:join',
              roomPin: j.roomPin,
              modeId: j.modeId,
              playerName: j.playerName,
              inputType: j.inputType,
              liveryColor: j.liveryColor,
            })
          );
          if (localRoomRef.current && localRoomRef.current.matchPhase === 'playing') {
            ws.send(
              JSON.stringify({
                type: 'match:start',
                sandbox: localRoomRef.current.isSandbox,
              })
            );
          }
        }
      });

      ws.addEventListener('message', (event) => {
        if (disposed) return;
        let msg: ServerToClientMessage;
        try {
          msg = JSON.parse(String(event.data)) as ServerToClientMessage;
        } catch {
          return;
        }

        if (msg.type === 'welcome') {
          clientIdRef.current = msg.clientId;
          setClientId(msg.clientId);
          return;
        }

        if (msg.type === 'pong') {
          const rtt = Math.max(1, Math.round(Date.now() - msg.t));
          setPingMs(rtt);
          return;
        }

        if (msg.type === 'room:error') {
          setRoomError(msg.message);
          return;
        }

        if (msg.type === 'room:state') {
          setRoomSnapshot(msg.room);
          setRoomError(null);
          syncRemoteVehiclesFromRoom(msg.room, clientIdRef.current);
          return;
        }

        if (msg.type === 'player:state') {
          if (msg.clientId === clientIdRef.current) return;
          const prev = remoteVehiclesRef.current.get(msg.clientId);
          if (prev) {
            prev.x = msg.x;
            prev.z = msg.z;
            prev.heading = msg.heading;
            prev.speed = msg.speed;
            prev.score = msg.score;
            prev.hits = msg.hits;
            prev.isBoosting = msg.isBoosting;
            prev.shieldActive = msg.shieldActive;
            prev.turretAngle = msg.turretAngle;
            prev.updatedAt = Date.now();
          }
          return;
        }

        if (msg.type === 'player:action') {
          if (msg.clientId === clientIdRef.current) return;
          remoteActionsRef.current.push({
            clientId: msg.clientId,
            actionType: msg.actionType,
            x: msg.x,
            z: msg.z,
            heading: msg.heading,
          });
          return;
        }

        if (msg.type === 'room:event') {
          setRoomEvents((prev) => [
            { id: `${Date.now()}-${Math.random()}`, text: msg.text, accent: msg.accent },
            ...prev.slice(0, 4),
          ]);
        }
      });

      ws.addEventListener('close', () => {
        if (disposed) return;
        wsConnectedRef.current = false;
        setWsConnected(false);
        attempt += 1;
        if (attempt <= MAX_RECONNECT_ATTEMPTS) {
          const delay = 1000 * attempt;
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        }
      });

      ws.addEventListener('error', () => {
        ws.close();
      });
    }

    async function initConnection() {
      if (disposed) return;
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        const ct = res.headers.get('content-type') ?? '';
        if (!res.ok || !ct.includes('application/json')) {
          return; // Static hosting (Vercel) or offline APK: stay cleanly in local engine mode
        }
      } catch {
        return; // Offline: stay cleanly in local engine mode
      }
      if (!disposed) {
        connect();
      }
    }

    void initConnection();

    const pingInterval = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping:req', t: Date.now() }));
      }
    }, 5000);

    return () => {
      disposed = true;
      window.clearInterval(pingInterval);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [syncRemoteVehiclesFromRoom]);

  // Local 1Hz round timer when running offline / static Vercel / standalone APK
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (wsConnectedRef.current) return;
      const cur = localRoomRef.current;
      if (!cur || cur.matchPhase !== 'playing' || cur.isSandbox) return;
      const next = tickLocalMatchSecond(cur);
      localRoomRef.current = next;
      setRoomSnapshot(next);
      if (next.matchPhase === 'results') {
        setRoomEvents((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            text: `Round ${next.roundNumber} complete!`,
            accent: '#ffb703',
          },
          ...prev.slice(0, 4),
        ]);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const joinRoom = useCallback(
    (payload: PendingJoinPayload) => {
      pendingJoinRef.current = payload;
      setRoomError(null);
      const localRoom = createLocalRoomSnapshot(payload);
      localRoomRef.current = localRoom;
      if (!wsConnectedRef.current) {
        clientIdRef.current = LOCAL_CLIENT_ID;
        setClientId(LOCAL_CLIENT_ID);
        setRoomSnapshot(localRoom);
        syncRemoteVehiclesFromRoom(localRoom, LOCAL_CLIENT_ID);
      }
      sendRaw({
        type: 'room:join',
        roomPin: payload.roomPin,
        modeId: payload.modeId,
        playerName: payload.playerName,
        inputType: payload.inputType,
        liveryColor: payload.liveryColor,
      });
    },
    [sendRaw, syncRemoteVehiclesFromRoom]
  );

  const leaveRoom = useCallback(() => {
    pendingJoinRef.current = null;
    localRoomRef.current = null;
    remoteVehiclesRef.current.clear();
    setRoomSnapshot(null);
    sendRaw({ type: 'room:leave' });
  }, [sendRaw]);

  const setReady = useCallback(
    (ready: boolean) => {
      if (!sendRaw({ type: 'room:ready', ready })) {
        commitLocalRoom((prev) => toggleLocalHostReady(prev));
      }
    },
    [sendRaw, commitLocalRoom]
  );

  const setLivery = useCallback(
    (liveryColor: string) => {
      if (pendingJoinRef.current) {
        pendingJoinRef.current = { ...pendingJoinRef.current, liveryColor };
      }
      if (!sendRaw({ type: 'room:livery', liveryColor })) {
        commitLocalRoom((prev) => updateLocalHostLivery(prev, liveryColor));
      }
    },
    [sendRaw, commitLocalRoom]
  );

  const setRoundSeconds = useCallback(
    (roundSeconds: number) => {
      if (!sendRaw({ type: 'room:settings', roundSeconds })) {
        commitLocalRoom((prev) => updateLocalRoundSeconds(prev, roundSeconds));
      }
    },
    [sendRaw, commitLocalRoom]
  );

  const addBot = useCallback(
    (name?: string) => {
      if (!sendRaw({ type: 'room:add_bot', name })) {
        commitLocalRoom((prev) => addLocalBotToRoom(prev, name));
      }
    },
    [sendRaw, commitLocalRoom]
  );

  const removeSlot = useCallback(
    (slotNumber: number) => {
      if (!sendRaw({ type: 'room:remove_slot', slotNumber })) {
        commitLocalRoom((prev) => removeLocalSlotFromRoom(prev, slotNumber));
      }
    },
    [sendRaw, commitLocalRoom]
  );

  const regeneratePin = useCallback(() => {
    if (!sendRaw({ type: 'room:regenerate_pin' })) {
      commitLocalRoom((prev) => regenerateLocalRoomPin(prev));
    }
  }, [sendRaw, commitLocalRoom]);

  const startMatch = useCallback(
    (sandbox: boolean) => {
      if (!sendRaw({ type: 'match:start', sandbox })) {
        commitLocalRoom((prev) => startLocalMatch(prev, sandbox));
      }
    },
    [sendRaw, commitLocalRoom]
  );

  const pauseMatch = useCallback(
    (paused: boolean) => {
      if (!sendRaw({ type: 'match:pause', paused })) {
        commitLocalRoom((prev) => ({
          ...prev,
          matchPhase: paused ? 'paused' : 'playing',
        }));
      }
    },
    [sendRaw, commitLocalRoom]
  );

  const endMatch = useCallback(() => {
    if (!sendRaw({ type: 'match:end' })) {
      commitLocalRoom((prev) => ({
        ...prev,
        matchPhase: 'lobby',
        timeLeft: prev.roundSeconds,
      }));
    }
  }, [sendRaw, commitLocalRoom]);

  // Throttled ~18Hz state emitter for smooth multiplayer sync
  const sendVehicleState = useCallback(
    (state: {
      x: number;
      z: number;
      heading: number;
      speed: number;
      score: number;
      hits: number;
      isBoosting: boolean;
      shieldActive: boolean;
      turretAngle: number;
    }) => {
      const now = performance.now();
      if (now - lastStateSentRef.current < 55) return;
      lastStateSentRef.current = now;
      if (!sendRaw({ type: 'player:state', ...state })) {
        if (localRoomRef.current) {
          localRoomRef.current = recordLocalScore(localRoomRef.current, state.score, state.hits);
        }
      }
    },
    [sendRaw]
  );

  const sendActionEvent = useCallback(
    (actionType: 'fire' | 'surge' | 'wave' | 'pulse', x: number, z: number, heading: number) => {
      sendRaw({ type: 'player:action', actionType, x, z, heading });
    },
    [sendRaw]
  );

  const sendHitEvent = useCallback(
    (points: number, reason: string, targetClientId?: string) => {
      if (!sendRaw({ type: 'player:hit', points, reason, targetClientId })) {
        commitLocalRoom((prev) => {
          const curScore = prev.slots[0]?.score ?? 0;
          const curHits = prev.slots[0]?.eliminations ?? 0;
          return recordLocalScore(prev, curScore + points, curHits + 1);
        });
      }
    },
    [sendRaw, commitLocalRoom]
  );

  return {
    wsConnected,
    clientId,
    pingMs,
    roomSnapshot,
    roomError,
    roomEvents,
    remoteVehiclesRef,
    remoteActionsRef,
    joinRoom,
    leaveRoom,
    setReady,
    setLivery,
    setRoundSeconds,
    addBot,
    removeSlot,
    regeneratePin,
    startMatch,
    pauseMatch,
    endMatch,
    sendVehicleState,
    sendActionEvent,
    sendHitEvent,
  };
}
