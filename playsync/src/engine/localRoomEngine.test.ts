import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addLocalBotToRoom,
  createLocalRoomSnapshot,
  recordLocalScore,
  regenerateLocalRoomPin,
  removeLocalSlotFromRoom,
  startLocalMatch,
  tickLocalMatchSecond,
  updateLocalHostLivery,
  updateLocalRoundSeconds,
} from './localRoomEngine';

test('local room engine initializes host, adds bots, and launches match offline', () => {
  let room = createLocalRoomSnapshot({
    modeId: 'f1',
    playerName: 'VercelPlayer',
    inputType: 'Touch & Gyro',
    liveryColor: '#ef1a4b',
  });

  assert.equal(room.matchPhase, 'lobby');
  assert.equal(room.slots[0].name, 'VercelPlayer');
  assert.equal(room.players.length, 1);

  room = addLocalBotToRoom(room, 'TurboBot');
  assert.equal(room.players.length, 2);
  assert.equal(room.slots[1].inputType, 'AI Bot');
  assert.equal(room.slots[1].name, 'TurboBot');

  room = updateLocalHostLivery(room, '#00f5ff');
  assert.equal(room.slots[0].liveryColor, '#00f5ff');

  room = updateLocalRoundSeconds(room, 90);
  assert.equal(room.roundSeconds, 90);
  assert.equal(room.timeLeft, 90);

  const prevPin = room.roomPin;
  room = regenerateLocalRoomPin(room);
  assert.notEqual(room.roomPin, prevPin);

  room = startLocalMatch(room, false);
  assert.equal(room.matchPhase, 'playing');
  assert.equal(room.timeLeft, 90);

  room = recordLocalScore(room, 450, 3);
  assert.equal(room.slots[0].score, 450);

  room = removeLocalSlotFromRoom(room, 2);
  assert.equal(room.players.length, 1);
  assert.equal(room.slots[1].status, 'empty');
});

test('local match timer finishes round cleanly into results with bot scores', () => {
  let room = createLocalRoomSnapshot({
    modeId: 'tank',
    playerName: 'Commander',
    inputType: 'Touch & Gyro',
    liveryColor: '#00f5ff',
  });
  room = addLocalBotToRoom(room);
  room = startLocalMatch(room, false);
  room = { ...room, timeLeft: 1 };
  room = recordLocalScore(room, 520, 4);

  room = tickLocalMatchSecond(room);
  assert.equal(room.timeLeft, 0);
  assert.equal(room.matchPhase, 'results');
  assert.equal(room.slots[0].score, 520);
  assert.ok(room.slots[1].score > 0);
});
