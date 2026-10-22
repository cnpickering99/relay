const GameManager = require('../multiplayer/gameManager');
const LobbyManager = require('../multiplayer/lobbyManager');
const RoomManager = require('../multiplayer/roomManager');
const { GameStatus } = require('../multiplayer/enums');

// Fake dictionary: every word is real except the ones listed, and every word
// is chainable except those ending in "ZZ".
function fakeDictionary({ fake = [] } = {}) {
  return {
    isRealWord: async word => !fake.includes(word.toLowerCase()),
    isChainable: async word => !word.toLowerCase().endsWith('zz'),
  };
}

function setup({ players = 2, ready = true, dictionary = fakeDictionary(), now } = {}) {
  let clock = 1_000;
  const games = new GameManager({
    dictionary,
    durationMs: 120_000,
    now: now ?? (() => clock),
    random: () => 0, // always the first fragment: "AS"
  });
  const lobby = new LobbyManager();
  const room = lobby.createRoom({ name: 'Test', maxPlayers: 4, ownerId: 'p1' });
  for (let i = 1; i <= players; i += 1) {
    lobby.joinRoom(room.id, { id: `p${i}`, name: `Player ${i}` });
  }
  const manager = new RoomManager(room);
  if (ready) for (let i = 1; i <= players; i += 1) manager.setReady(`p${i}`, true);
  return { games, room, advance: ms => { clock += ms; } };
}

describe('GameManager.canStart', () => {
  it('needs everyone ready and at least two players', () => {
    expect(setup().games.canStart(setup().room)).toBe(true);

    const notReady = setup({ ready: false });
    expect(notReady.games.canStart(notReady.room)).toBe(false);

    const alone = setup({ players: 1 });
    expect(alone.games.canStart(alone.room)).toBe(false);
  });

  it('does not start a game that is already running', () => {
    const { games, room } = setup();
    games.start(room);
    expect(games.canStart(room)).toBe(false);
  });
});

describe('GameManager.start', () => {
  it('puts the room in game with the same fragment and a 2:00 clock for everyone', () => {
    const { games, room } = setup({ players: 3 });
    const snapshot = games.start(room);

    expect(room.status).toBe(GameStatus.IN_GAME);
    expect(snapshot).toEqual({
      startedAt: 1_000,
      endsAt: 121_000,
      durationMs: 120_000,
      serverNow: 1_000,
      fragment: 'AS',
    });
    expect(games.scoreboard(room)).toHaveLength(3);
    expect([...room.game.players.values()].every(state => state.fragment === 'AS')).toBe(true);
  });

  it('refuses to start twice or with one player', () => {
    const { games, room } = setup();
    games.start(room);
    expect(() => games.start(room)).toThrow('a game is already in progress');

    const alone = setup({ players: 1 });
    expect(() => alone.games.start(alone.room)).toThrow('at least 2 players are needed');
  });
});

describe('GameManager.submitWord', () => {
  it('scores a valid word by length and moves that player to the new fragment', async () => {
    const { games, room } = setup();
    games.start(room);

    const result = await games.submitWord(room, 'p1', 'ashen');
    expect(result).toEqual({ type: 'accepted', word: 'ASHEN', points: 5, score: 5, fragment: 'EN' });

    // The other player is unaffected and still starts from "AS".
    const second = await games.submitWord(room, 'p2', 'aster');
    expect(second).toEqual({ type: 'accepted', word: 'ASTER', points: 5, score: 5, fragment: 'ER' });
  });

  it('rejects bad words without ending the run', async () => {
    const { games, room } = setup({ dictionary: fakeDictionary({ fake: ['asxyz'] }) });
    games.start(room);

    expect(await games.submitWord(room, 'p1', '')).toMatchObject({ type: 'rejected', reason: 'EMPTY' });
    expect(await games.submitWord(room, 'p1', 'as')).toMatchObject({ reason: 'TOO_SHORT' });
    expect(await games.submitWord(room, 'p1', 'bat')).toMatchObject({ reason: 'WRONG_START', message: 'Must start with "AS"' });
    expect(await games.submitWord(room, 'p1', 'asxyz')).toMatchObject({ reason: 'NOT_A_WORD' });
    expect(await games.submitWord(room, 'p1', 'as1ch')).toMatchObject({ reason: 'NOT_A_WORD' });

    await games.submitWord(room, 'p1', 'ashen');
    expect(await games.submitWord(room, 'p1', 'aster')).toMatchObject({ reason: 'WRONG_START', message: 'Must start with "EN"' });
    await games.submitWord(room, 'p1', 'enas');   // loops back to "AS"
    expect(await games.submitWord(room, 'p1', 'ashen')).toMatchObject({ reason: 'ALREADY_USED' });
    expect(games.scoreboard(room).find(row => row.playerId === 'p1').finished).toBe(false);
  });

  it('ends only that player\'s run when the word breaks the chain', async () => {
    const { games, room } = setup();
    games.start(room);

    await games.submitWord(room, 'p1', 'ashen');
    const broke = await games.submitWord(room, 'p1', 'enzz');
    expect(broke).toEqual({ type: 'finished', word: 'ENZZ', lastTwo: 'ZZ', score: 5 });
    expect(await games.submitWord(room, 'p1', 'aster')).toMatchObject({ reason: 'FINISHED' });

    expect(games.shouldEnd(room)).toBe(false);
    await games.submitWord(room, 'p2', 'aszz');
    expect(games.shouldEnd(room)).toBe(true);
  });

  it('rejects words once the clock has run out', async () => {
    const { games, room, advance } = setup();
    games.start(room);
    advance(120_000);
    expect(await games.submitWord(room, 'p1', 'ashen')).toMatchObject({ reason: 'GAME_OVER' });
  });

  it('does not score a word that finishes checking after the time is up', async () => {
    let release;
    const slowDictionary = {
      isRealWord: () => new Promise(resolve => { release = () => resolve(true); }),
      isChainable: async () => true,
    };
    const { games, room, advance } = setup({ dictionary: slowDictionary });
    games.start(room);

    const pending = games.submitWord(room, 'p1', 'ashen');
    advance(120_000);
    release();
    expect(await pending).toMatchObject({ type: 'rejected', reason: 'GAME_OVER' });
    expect(games.scoreboard(room).find(row => row.playerId === 'p1').score).toBe(0);
  });

  it('refuses a second word while one is still being checked', async () => {
    let release;
    const slowDictionary = {
      isRealWord: () => new Promise(resolve => { release = () => resolve(true); }),
      isChainable: async () => true,
    };
    const { games, room } = setup({ dictionary: slowDictionary });
    games.start(room);

    const first = games.submitWord(room, 'p1', 'ashen');
    expect(await games.submitWord(room, 'p1', 'aster')).toMatchObject({ reason: 'BUSY' });
    release();
    expect(await first).toMatchObject({ type: 'accepted' });
  });

  it('keeps the run going when the dictionary is unavailable', async () => {
    const down = { isRealWord: async () => { throw new Error('network'); }, isChainable: async () => true };
    const { games, room } = setup({ dictionary: down });
    games.start(room);
    expect(await games.submitWord(room, 'p1', 'ashen')).toMatchObject({ reason: 'DICTIONARY_UNAVAILABLE' });
    expect(games.scoreboard(room).every(row => !row.finished)).toBe(true);
  });

  it('throws when there is no game or the player is not in it', async () => {
    const { games, room } = setup();
    await expect(games.submitWord(room, 'p1', 'ashen')).rejects.toThrow('no game is in progress');
    games.start(room);
    await expect(games.submitWord(room, 'nobody', 'ashen')).rejects.toThrow('player is not in the game');
  });
});

describe('GameManager.end', () => {
  it('ranks by score, names the winner, and resets the room to the lobby', async () => {
    const { games, room } = setup({ players: 3 });
    games.start(room);
    await games.submitWord(room, 'p1', 'ashen');   // 5
    await games.submitWord(room, 'p2', 'asters');  // 6
    await games.submitWord(room, 'p3', 'asp');     // 3

    const outcome = games.end(room);
    expect(outcome.results.map(row => [row.playerId, row.score])).toEqual([['p2', 6], ['p1', 5], ['p3', 3]]);
    expect(outcome.winnerIds).toEqual(['p2']);
    expect(outcome.isTie).toBe(false);
    expect(outcome.results[0].words).toEqual(['ASTERS']);

    expect(room.status).toBe(GameStatus.LOBBY);
    expect(room.game).toBeNull();
    expect(room.players.every(entry => entry.status === 'not_ready' && entry.score === 0)).toBe(true);
    expect(games.canStart(room)).toBe(false);
  });

  it('reports a tie when the top scores match, including 0-0', async () => {
    const { games, room } = setup();
    games.start(room);
    const outcome = games.end(room);
    expect(outcome.winnerIds.sort()).toEqual(['p1', 'p2']);
    expect(outcome.isTie).toBe(true);
  });

  it('throws when no game is running', () => {
    const { games, room } = setup();
    expect(() => games.end(room)).toThrow('no game is in progress');
  });
});

describe('GameManager.removePlayer / shouldEnd', () => {
  it('ends the game when fewer than two players remain', () => {
    const { games, room } = setup({ players: 3 });
    games.start(room);

    games.removePlayer(room, 'p3');
    expect(games.shouldEnd(room)).toBe(false);
    games.removePlayer(room, 'p2');
    expect(games.shouldEnd(room)).toBe(true);

    const outcome = games.end(room);
    expect(outcome.winnerIds).toEqual(['p1']);
  });
});
