const { GameStatus } = require('./enums');

const GAME_DURATION_MS = 2 * 60 * 1000;
const MIN_PLAYERS = 2;
const MIN_WORD_LENGTH = 3;

// Same curated pool the solo game starts from
// (frontend/relay/src/components/relay-game/Fragments.js).
const STARTING_FRAGMENTS = [
  'AS', 'BA', 'CA', 'DE', 'EX', 'FA', 'GA', 'HA', 'IN', 'JU',
  'LA', 'MA', 'NA', 'OP', 'PA', 'RA', 'SA', 'TA', 'UN', 'VA',
  'WA', 'AC', 'BE', 'CO', 'DI', 'EL', 'FI', 'GO', 'HO', 'IM',
  'LI', 'MO', 'NO', 'OB', 'PI', 'RE', 'SE', 'TI', 'AL', 'BI',
  'CU', 'RO', 'ST', 'TR', 'PR', 'GR', 'BL', 'CL', 'FL', 'SL',
];

function rejected(reason, message) {
  return { type: 'rejected', reason, message };
}

/**
 * Rules for the timed, simultaneous game: every player chains words on
 * their own from the same starting letters, and whoever has the highest
 * score when the clock runs out wins. The state lives on `room.game`;
 * this class holds no state of its own, so one instance serves all rooms.
 */
class GameManager {
  /**
   * @param {Object} options
   * @param {{ isRealWord(word: string): Promise<boolean>, isChainable(word: string): Promise<boolean> }} options.dictionary
   * @param {number} [options.durationMs]
   * @param {() => number} [options.now]
   * @param {() => number} [options.random]
   */
  constructor({ dictionary, durationMs = GAME_DURATION_MS, now = Date.now, random = Math.random }) {
    if (!dictionary) throw new Error('a dictionary is required');
    this.dictionary = dictionary;
    this.durationMs = durationMs;
    this.now = now;
    this.random = random;
  }

  canStart(room) {
    return room.status === GameStatus.LOBBY
      && room.players.length >= MIN_PLAYERS
      && room.players.every(entry => entry.status === 'ready');
  }

  /** Starts a game in the room and returns a snapshot to send to the players. */
  start(room) {
    if (room.status !== GameStatus.LOBBY) throw new Error('a game is already in progress');
    if (room.players.length < MIN_PLAYERS) throw new Error(`at least ${MIN_PLAYERS} players are needed`);

    const startedAt = this.now();
    const fragment = STARTING_FRAGMENTS[Math.floor(this.random() * STARTING_FRAGMENTS.length)];
    const players = new Map();
    for (const entry of room.players) {
      players.set(entry.player.id, {
        name: entry.player.name,
        fragment,
        score: 0,
        wordsUsed: [],
        finished: false,
        finishReason: null,
        pending: false,
      });
      entry.score = 0;
    }

    room.status = GameStatus.IN_GAME;
    room.game = { startedAt, endsAt: startedAt + this.durationMs, fragment, players };
    return this.snapshot(room);
  }

  snapshot(room) {
    const { startedAt, endsAt, fragment } = room.game;
    return { startedAt, endsAt, durationMs: this.durationMs, serverNow: this.now(), fragment };
  }

  isActive(room) {
    return room.status === GameStatus.IN_GAME && Boolean(room.game);
  }

  /** Per-player scoreboard, highest score first (ties keep join order). */
  scoreboard(room) {
    return [...room.game.players.entries()]
      .map(([playerId, state]) => ({
        playerId,
        name: state.name,
        score: state.score,
        wordCount: state.wordsUsed.length,
        finished: state.finished,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Checks a word for one player and, if it is good, scores it.
   * Resolves to one of:
   *   { type: 'accepted', word, points, score, fragment }
   *   { type: 'rejected', reason, message }     (the player may try again)
   *   { type: 'finished', word, lastTwo, score } (word breaks the chain; their run ends)
   */
  async submitWord(room, playerId, rawWord) {
    if (!this.isActive(room)) throw new Error('no game is in progress');
    const game = room.game;
    const state = game.players.get(playerId);
    if (!state) throw new Error('player is not in the game');

    if (state.finished) return rejected('FINISHED', 'Your run is over.');
    if (state.pending) return rejected('BUSY', 'Still checking your previous word.');
    if (this.now() >= game.endsAt) return rejected('GAME_OVER', 'Time is up.');

    const word = String(rawWord ?? '').trim().toUpperCase();
    if (!word) return rejected('EMPTY', 'Type a word first.');
    if (!/^[A-Z]+$/.test(word)) return rejected('NOT_A_WORD', 'Not a real word!');
    if (word.length < MIN_WORD_LENGTH) return rejected('TOO_SHORT', 'Word too short');
    if (!word.startsWith(state.fragment)) return rejected('WRONG_START', `Must start with "${state.fragment}"`);
    if (state.wordsUsed.includes(word)) return rejected('ALREADY_USED', 'Already used!');

    // The game may end (or the player may leave) while we wait on the dictionary.
    const stillPlaying = () => room.game === game && game.players.get(playerId) === state
      && this.now() < game.endsAt;

    state.pending = true;
    try {
      if (!(await this.dictionary.isRealWord(word))) {
        return stillPlaying() ? rejected('NOT_A_WORD', 'Not a real word!') : rejected('GAME_OVER', 'Time is up.');
      }
      const chainable = await this.dictionary.isChainable(word);
      if (!stillPlaying()) return rejected('GAME_OVER', 'Time is up.');

      if (!chainable) {
        state.finished = true;
        state.finishReason = { word, lastTwo: word.slice(-2) };
        return { type: 'finished', word, lastTwo: word.slice(-2), score: state.score };
      }

      state.score += word.length;
      state.wordsUsed.push(word);
      state.fragment = word.slice(-2);
      const entry = room.players.find(candidate => candidate.player.id === playerId);
      if (entry) entry.score = state.score;
      return { type: 'accepted', word, points: word.length, score: state.score, fragment: state.fragment };
    } catch {
      return rejected('DICTIONARY_UNAVAILABLE', "Couldn't check that word, try again.");
    } finally {
      state.pending = false;
    }
  }

  /** Drops a player who left, was kicked, or disconnected. */
  removePlayer(room, playerId) {
    if (this.isActive(room)) room.game.players.delete(playerId);
  }

  /** True once the game cannot go on: too few players left, or everyone's run is over. */
  shouldEnd(room) {
    if (!this.isActive(room)) return false;
    const states = [...room.game.players.values()];
    return states.length < MIN_PLAYERS || states.every(state => state.finished);
  }

  /**
   * Ends the game: returns the results and puts the room back in the
   * lobby with everyone un-readied.
   */
  end(room) {
    if (!this.isActive(room)) throw new Error('no game is in progress');

    const results = [...room.game.players.entries()]
      .map(([playerId, state]) => ({
        playerId,
        name: state.name,
        score: state.score,
        wordCount: state.wordsUsed.length,
        words: [...state.wordsUsed],
        finished: state.finished,
      }))
      .sort((a, b) => b.score - a.score);

    const topScore = results.length ? results[0].score : 0;
    const winnerIds = results.filter(result => result.score === topScore).map(result => result.playerId);

    room.status = GameStatus.LOBBY;
    room.game = null;
    for (const entry of room.players) {
      entry.status = 'not_ready';
      entry.score = 0;
    }

    return { results, winnerIds, isTie: winnerIds.length > 1 };
  }
}

module.exports = GameManager;
module.exports.GAME_DURATION_MS = GAME_DURATION_MS;
module.exports.MIN_PLAYERS = MIN_PLAYERS;
module.exports.STARTING_FRAGMENTS = STARTING_FRAGMENTS;
