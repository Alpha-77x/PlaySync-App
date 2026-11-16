import type { ArenaModeId, InputType, MatchPhase, PlayerSlot } from '../engine/arenaLogic.ts';

export interface PlayerNetTransform {
  clientId: string;
  slotNumber: number;
  name: string;
  liveryColor: string;
  isBot: boolean;
  x: number;
  z: number;
  heading: number;
  speed: number;
  score: number;
  hits: number;
  isBoosting: boolean;
  shieldActive: boolean;
  turretAngle: number;
  updatedAt: number;
}

export interface ServerRoomSnapshot {
  roomPin: string;
  modeId: ArenaModeId;
  hostClientId: string | null;
  matchPhase: MatchPhase;
  isSandbox: boolean;
  roundNumber: number;
  roundSeconds: number;
  timeLeft: number;
  slots: PlayerSlot[];
  players: PlayerNetTransform[];
}

export interface RoomSummary {
  modeId: ArenaModeId;
  roomPin: string;
  playerCount: number;
  matchPhase: MatchPhase;
}

export type ClientToServerMessage =
  | {
      type: 'room:join';
      roomPin?: string;
      modeId: ArenaModeId;
      playerName: string;
      inputType: InputType;
      liveryColor: string;
      asController?: boolean;
    }
  | { type: 'room:leave' }
  | { type: 'room:ready'; ready: boolean }
  | { type: 'room:livery'; liveryColor: string }
  | { type: 'room:settings'; roundSeconds: number }
  | { type: 'room:add_bot'; name?: string }
  | { type: 'room:remove_slot'; slotNumber: number }
  | { type: 'room:regenerate_pin' }
  | { type: 'match:start'; sandbox: boolean }
  | { type: 'match:pause'; paused: boolean }
  | { type: 'match:end' }
  | {
      type: 'player:state';
      x: number;
      z: number;
      heading: number;
      speed: number;
      score: number;
      hits: number;
      isBoosting: boolean;
      shieldActive: boolean;
      turretAngle: number;
    }
  | {
      type: 'player:action';
      actionType: 'fire' | 'surge' | 'wave' | 'pulse';
      x: number;
      z: number;
      heading: number;
    }
  | {
      type: 'player:hit';
      targetClientId?: string;
      points: number;
      reason: string;
    }
  | { type: 'ping:req'; t: number };

export type ServerToClientMessage =
  | { type: 'welcome'; clientId: string }
  | { type: 'room:state'; room: ServerRoomSnapshot }
  | { type: 'room:error'; message: string }
  | {
      type: 'player:state';
      clientId: string;
      x: number;
      z: number;
      heading: number;
      speed: number;
      score: number;
      hits: number;
      isBoosting: boolean;
      shieldActive: boolean;
      turretAngle: number;
    }
  | {
      type: 'player:action';
      clientId: string;
      actionType: 'fire' | 'surge' | 'wave' | 'pulse';
      x: number;
      z: number;
      heading: number;
    }
  | { type: 'room:event'; text: string; accent?: string }
  | { type: 'pong'; t: number };
