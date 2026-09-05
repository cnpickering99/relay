const GameStatus = Object.freeze({
  LOBBY: 'lobby',
  QUEUED: 'queued',
  GAME: 'game',
});

const ValidationReason = Object.freeze({
  NOT_A_WORD: 'NOT_A_WORD',
  UNCHAINABLE: 'UNCHAINABLE',
});

module.exports = Object.freeze({
  GameStatus,
  ValidationReason,
});