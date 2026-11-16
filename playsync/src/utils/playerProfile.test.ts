import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWinRate,
  createDefaultProfile,
  loadPlayerProfile,
  parseStoredProfile,
  recordMatchOutcome,
  resetCareerStats,
  sanitizeNickname,
  savePlayerProfile,
} from './playerProfile';

test('player profile sanitizes nickname and calculates win rate accurately', () => {
  assert.equal(sanitizeNickname('   Apex   Drift  '), 'Apex Drift');
  assert.equal(sanitizeNickname('   '), 'Host Console');

  assert.equal(computeWinRate({ gamesPlayed: 0, wins: 0 }), 0);
  assert.equal(computeWinRate({ gamesPlayed: 4, wins: 3 }), 75);
});

test('recording match outcomes updates games played, wins, best score, drift, and mode counts', () => {
  let profile = createDefaultProfile();
  profile = recordMatchOutcome(profile, {
    modeId: 'ice',
    score: 840,
    driftPoints: 320,
    won: true,
  });
  profile = recordMatchOutcome(profile, {
    modeId: 'f1',
    score: 520,
    driftPoints: 110,
    won: false,
  });

  assert.equal(profile.stats.gamesPlayed, 2);
  assert.equal(profile.stats.wins, 1);
  assert.equal(computeWinRate(profile.stats), 50);
  assert.equal(profile.stats.bestScore, 840);
  assert.equal(profile.stats.totalDriftPoints, 430);
  assert.equal(profile.stats.modeGames.ice, 1);
  assert.equal(profile.stats.modeGames.f1, 1);

  const afterReset = resetCareerStats(profile);
  assert.equal(afterReset.stats.gamesPlayed, 0);
  assert.equal(afterReset.stats.wins, 0);
});

test('savePlayerProfile and loadPlayerProfile round-trip cleanly via storage mock', () => {
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  let profile = createDefaultProfile();
  profile = {
    ...profile,
    nickname: 'NeonAce',
    avatarId: 'cryo-fox',
    avatarColor: '#ffb703',
  };
  profile = recordMatchOutcome(profile, {
    modeId: 'ice',
    score: 990,
    driftPoints: 410,
    won: true,
  });

  savePlayerProfile(profile, mockStorage);
  const loaded = loadPlayerProfile(mockStorage);
  assert.equal(loaded.nickname, 'NeonAce');
  assert.equal(loaded.avatarId, 'cryo-fox');
  assert.equal(loaded.avatarColor, '#ffb703');
  assert.equal(loaded.stats.gamesPlayed, 1);
  assert.equal(loaded.stats.wins, 1);

  const corrupted = parseStoredProfile('{not-valid-json');
  assert.equal(corrupted.nickname, 'Host Console');
});
