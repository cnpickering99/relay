const crypto = require('crypto');
const { GameStatus } = require('./enums');

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.queues = new Map();
  }

  createRoom() {
    let roomId;
    do {
      roomId = crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (this.rooms.has(roomId));

    const room = {
      id: roomId,
      status: GameStatus.LOBBY,
      players: new Map(),
      game: null,
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(String(roomId).toUpperCase());
  }

  joinRoom(roomId, player) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('room not found');
    if (!player || !player.id) throw new Error('player id is required');
    if (room.players.has(player.id)) return room;

    room.players.set(player.id, player);
    if (!player.mode) player.mode = null;
    player.ready = false;
    player.queued = false;
    return room;
  }

  setPlayerMode(roomId, playerId, mode) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('room not found');
    const player = room.players.get(playerId);
    if (!player) throw new Error('player is not in this lobby');
    if (room.status !== GameStatus.LOBBY) throw new Error('lobby is no longer accepting choices');
    if (typeof mode !== 'string' || !mode.trim()) throw new Error('game mode is required');

    player.mode = mode.trim().toLowerCase();
    player.ready = false;
    return room;
  }

  setPlayerReady(roomId, playerId, ready = true) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('room not found');
    const player = room.players.get(playerId);
    if (!player) throw new Error('player is not in this lobby');
    if (!player.mode) throw new Error('choose a game mode first');
    if (room.status !== GameStatus.LOBBY) throw new Error('lobby is no longer accepting ready states');

    player.ready = Boolean(ready);
    return room;
  }

  joinQueue(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('room not found');
    const player = room.players.get(playerId);
    if (!player) throw new Error('player is not in this lobby');
    if (!player.mode) throw new Error('choose a game mode first');
    if (!player.ready) throw new Error('player must be ready before joining the queue');

    const queue = this.queues.get(player.mode) || [];
    if (!queue.some(entry => entry.roomId === room.id && entry.playerId === player.id)) {
      queue.push({ roomId: room.id, playerId: player.id });
    }
    player.queued = true;
    room.status = GameStatus.QUEUED;
    this.queues.set(player.mode, queue);

    return this.matchQueue(player.mode);
  }

  matchQueue(mode) {
    const queue = this.queues.get(mode) || [];
    if (queue.length < 2) return null;

    const match = this.createRoom();
    match.status = GameStatus.GAME;
    match.mode = mode;
    match.players.clear();

    for (const entry of queue) {
      const lobby = this.getRoom(entry.roomId);
      const player = lobby?.players.get(entry.playerId);
      if (!player) continue;
      player.queued = false;
      match.players.set(player.id, { ...player, ready: false, queued: false });
    }

    this.queues.delete(mode);
    return match;
  }

  removePlayer(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    room.players.delete(playerId);
    for (const [mode, queue] of this.queues) {
      const remaining = queue.filter(entry => entry.roomId !== room.id || entry.playerId !== playerId);
      if (remaining.length === 0) this.queues.delete(mode);
      else this.queues.set(mode, remaining);
    }
    if (room.players.size === 0) this.rooms.delete(room.id);
    else if (room.status !== GameStatus.GAME) room.status = GameStatus.LOBBY;
  }
}

module.exports = RoomManager;
module.exports.GameStatus = GameStatus;
