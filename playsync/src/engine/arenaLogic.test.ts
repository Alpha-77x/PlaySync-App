import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_BOUNDARY_RADIUS,
  ARENA_MODES,
  F1_BOOST_PADS,
  F1_INNER_BOUNDARY_RADIUS,
  TANK_BUNKERS,
  ZEROG_GATES,
  addGuestToNextSlot,
  awardComboPoints,
  createInitialLobbies,
  createInitialSlots,
  createInitialVehicleSim,
  findModeByPin,
  generateRoomPin,
  getConnectedCount,
  getRankedLeaderboard,
  getReadyCount,
  removeGuestFromSlot,
  resolveVehicleBumperCollision,
  stepVehicleSimulation,
  toggleSlotReady,
  updateSlotLivery,
} from './arenaLogic';

test('each game mode maintains an isolated lobby with unique PIN and roster', () => {
  const lobbies = createInitialLobbies();
  assert.notEqual(lobbies.f1.roomPin, lobbies.tank.roomPin);
  assert.equal(findModeByPin(lobbies, lobbies.tank.roomPin), 'tank');
  assert.equal(findModeByPin(lobbies, lobbies.f1.roomPin), 'f1');

  // Adding a guest to Tank lobby does not pollute F1 lobby
  const updatedTankSlots = addGuestToNextSlot(lobbies.tank.slots, 'Ironclad', 'Gamepad', 'tank');
  assert.equal(getConnectedCount(updatedTankSlots), 2);
  assert.equal(getConnectedCount(lobbies.f1.slots), 1);
  assert.equal(ARENA_MODES.f1.cameraOptions[1].label, 'F1 Chase');
  assert.equal(ARENA_MODES.tank.cameraOptions[1].label, 'Turret Cam');
});

test('initial slots start with 1 host ready out of 8', () => {
  const slots = createInitialSlots('f1');
  assert.equal(slots.length, 8);
  assert.equal(getConnectedCount(slots), 1);
  assert.equal(getReadyCount(slots), 1);
  assert.equal(slots[0].status, 'host');
});

test('adding and removing guest players updates counts and leaves host intact', () => {
  let slots = createInitialSlots('tank');
  slots = addGuestToNextSlot(slots, 'PixelTank', 'Gamepad', 'tank');
  assert.equal(getConnectedCount(slots), 2);
  assert.equal(slots[1].name, 'PixelTank');
  assert.equal(slots[1].inputType, 'Gamepad');

  const afterHostRemove = removeGuestFromSlot(slots, 1);
  assert.equal(getConnectedCount(afterHostRemove), 2);

  const afterGuestRemove = removeGuestFromSlot(slots, 2);
  assert.equal(getConnectedCount(afterGuestRemove), 1);
  assert.equal(afterGuestRemove[1].status, 'empty');
});

test('toggling ready and updating livery works deterministically', () => {
  let slots = createInitialSlots('f1');
  slots = addGuestToNextSlot(slots, 'DriftKing', 'Touch & Gyro', 'f1');
  assert.equal(getReadyCount(slots), 2);

  slots = toggleSlotReady(slots, 2);
  assert.equal(getReadyCount(slots), 1);

  slots = updateSlotLivery(slots, 1, '#ef1a4b');
  assert.equal(slots[0].liveryColor, '#ef1a4b');
});

test('ranked leaderboard orders connected players by score descending', () => {
  let slots = createInitialSlots('f1');
  slots = addGuestToNextSlot(slots, 'Alpha', 'Touch & Gyro', 'f1');
  slots = addGuestToNextSlot(slots, 'Beta', 'Touch & Gyro', 'f1');
  slots[0] = { ...slots[0], score: 300 };
  slots[1] = { ...slots[1], score: 950 };
  slots[2] = { ...slots[2], score: 620 };

  const ranked = getRankedLeaderboard(slots);
  assert.equal(ranked.length, 3);
  assert.deepEqual(
    ranked.map((r) => r.name),
    ['Alpha', 'Beta', 'Host Console']
  );
});

test('room pin generator produces 4-digit pin distinct from previous pin', () => {
  const next = generateRoomPin('8492');
  assert.match(next, /^\d{4}$/);
  assert.notEqual(next, '8492');
});

test('vehicle simulation accelerates, boosts, scores, and stays inside arena boundary', () => {
  let state = createInitialVehicleSim('f1');
  for (let i = 0; i < 120; i++) {
    state = stepVehicleSimulation(
      state,
      { moveX: 0.5, moveY: 1, boost: true, action: false, shield: false },
      'f1',
      0.03
    );
  }
  assert.ok(state.speed > 5, 'vehicle should gain speed');
  assert.ok(state.score > 10, 'vehicle should accumulate score');
  assert.ok(state.boostEnergy < 100, 'boosting should consume boost energy');
  assert.ok(
    Math.hypot(state.x, state.z) <= ARENA_BOUNDARY_RADIUS + 0.001,
    'vehicle must stay within arena boundary'
  );
});

test('cyber tank resolves collision cleanly against tactical bunkers', () => {
  const bunker = TANK_BUNKERS[0];
  let state = createInitialVehicleSim('tank');
  state.x = bunker.x + 0.5;
  state.z = bunker.z + 0.5;
  state.vx = -6;
  state.vz = -6;

  state = stepVehicleSimulation(
    state,
    { moveX: 0, moveY: 0, boost: false, action: false, shield: false },
    'tank',
    0.03
  );

  const distFromBunker = Math.hypot(state.x - bunker.x, state.z - bunker.z);
  assert.ok(
    distFromBunker >= bunker.radius + 1.3,
    `tank must be pushed outside bunker cover radius (${distFromBunker})`
  );
});

test('expanded arena landmarks sit cleanly inside the 37.4-unit boundary', () => {
  assert.equal(ARENA_BOUNDARY_RADIUS, 37.4);
  assert.equal(F1_INNER_BOUNDARY_RADIUS, 13.0);
  assert.equal(F1_BOOST_PADS.length, 6);
  assert.equal(TANK_BUNKERS.length, 10);
  assert.equal(ZEROG_GATES.length, 8);
  for (const pad of F1_BOOST_PADS) {
    assert.ok(Math.hypot(pad.x, pad.z) > F1_INNER_BOUNDARY_RADIUS + 2);
    assert.ok(Math.hypot(pad.x, pad.z) < ARENA_BOUNDARY_RADIUS - 5);
  }
  for (const gate of ZEROG_GATES) {
    assert.ok(Math.hypot(gate.x, gate.z) < ARENA_BOUNDARY_RADIUS - 5);
  }
});

test('F1 car cannot cross inner island barrier or outer safety barrier and responds to pedal/steer buttons', () => {
  let state = createInitialVehicleSim('f1');
  // Drive straight toward inner island center
  state.x = 13.5;
  state.z = 0;
  state.vx = -22;
  state.vz = 0;
  for (let i = 0; i < 20; i++) {
    state = stepVehicleSimulation(
      state,
      { moveX: -1, moveY: 1, boost: true, action: false, shield: false },
      'f1',
      0.03
    );
    const dist = Math.hypot(state.x, state.z);
    assert.ok(dist >= F1_INNER_BOUNDARY_RADIUS - 0.001, `F1 inner barrier breached: ${dist}`);
    assert.ok(dist <= ARENA_BOUNDARY_RADIUS + 0.001, `F1 outer barrier breached: ${dist}`);
  }

  // Brake pedal slows and reverses cleanly
  let brakeState = createInitialVehicleSim('f1');
  brakeState.vz = 15;
  brakeState.speed = 15;
  brakeState = stepVehicleSimulation(
    brakeState,
    { moveX: 0, moveY: -1, boost: false, action: false, shield: false },
    'f1',
    0.05
  );
  assert.ok(brakeState.speed < 15, 'brake input should decelerate F1 vehicle');
});

test('combo streak escalates up to 4x and bumper collision bounces vehicles cleanly', () => {
  let sim = createInitialVehicleSim('f1');
  const first = awardComboPoints(sim, 100);
  assert.equal(first.combo, 1);
  assert.equal(first.awarded, 100);

  const second = awardComboPoints(first.nextState, 100);
  assert.equal(second.combo, 2);
  assert.equal(second.awarded, 200);

  const third = awardComboPoints(second.nextState, 100);
  const fourth = awardComboPoints(third.nextState, 100);
  const capped = awardComboPoints(fourth.nextState, 100);
  assert.equal(capped.combo, 4);
  assert.equal(capped.awarded, 400);

  const bump = resolveVehicleBumperCollision(10, 0, -12, 0, 8.8, 0, 2.65, 1.5);
  assert.equal(bump.collided, true);
  assert.ok(bump.x >= 8.8 + 2.64, 'player must separate cleanly from rival');
  assert.ok(bump.vx > 0, 'player velocity must rebound outward');
  assert.ok(bump.impactIntensity > 0.5, 'high-speed collision computes strong impact intensity');
});

test('Slip N Bump 3D activates cryo drift angle, accumulates drift points, and grants drift exit boost', () => {
  let sim = createInitialVehicleSim('ice');
  for (let i = 0; i < 30; i++) {
    sim = stepVehicleSimulation(
      sim,
      { moveX: 0, moveY: 1, boost: false, action: false, shield: false },
      'ice',
      0.03
    );
  }
  // Carve a sustained Cryo Drift (steer + shield/E drift key)
  for (let i = 0; i < 32; i++) {
    sim = stepVehicleSimulation(
      sim,
      { moveX: 1, moveY: 1, boost: false, action: false, shield: true },
      'ice',
      0.03
    );
  }
  assert.equal(sim.isDrifting, true);
  assert.ok(Math.abs(sim.driftAngle) > 0.1, 'cryo drift must generate lateral slip angle');
  assert.ok(sim.driftPoints > 25, 'cryo drift must accumulate drift points');
  assert.ok(sim.driftStreak > 0.7, 'drift streak tracks sustained drift duration');

  const speedBeforeRelease = sim.speed;
  sim = stepVehicleSimulation(
    sim,
    { moveX: 0, moveY: 1, boost: false, action: false, shield: false },
    'ice',
    0.03
  );
  assert.ok(sim.speed >= speedBeforeRelease, 'releasing sustained cryo drift preserves or boosts exit speed');
});

