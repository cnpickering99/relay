const crypto = require('crypto');
const { GameStatus } = require('./enums');
const RoomManager = require('./roomManager');

class LobbyManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom({ name = 'Lobby', maxPlayers = 4, code, ownerId } = {}) {
    if (ownerId && [...this.rooms.values()].some(room => room.ownerId === ownerId)) {
      throw new Error('player already owns a room');
    }

    const roomId = this.createRoomId(code);

    const room = {
      id: roomId,
      code: roomId,
      ownerId,
      name: String(name).trim() || 'Lobby',
      maxPlayers: this.normalizeMaxPlayers(maxPlayers),
      status: GameStatus.LOBBY,
      players: new Map(),
      game: null,
      type_of_game: 1
    };
    this.rooms.set(roomId, room);
    return room;
  }

  createRoomId(code) {
    const requestedCode = code ? String(code).trim().toUpperCase() : '';
    if (requestedCode && !/^[A-Z0-9]{3,12}$/.test(requestedCode)) {
      throw new Error('room code must be 3 to 12 letters or numbers');
    }

    if (requestedCode) {
      if (this.rooms.has(requestedCode)) throw new Error('room code is already in use');
      return requestedCode;
    }

    let roomId;
    do {
      roomId = crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (this.rooms.has(roomId));
    return roomId;
  }

  normalizeMaxPlayers(maxPlayers) {
    const value = Number(maxPlayers);
    if (!Number.isInteger(value) || value < 2 || value > 12) {
      throw new Error('room capacity must be between 2 and 12 players');
    }
    return value;
  }

  getRoom(roomId) {
    return this.rooms.get(String(roomId).toUpperCase());
  }

  findRoom(roomId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('room not found');
    return room;
  }

  joinRoom(roomId, player) {
    const room = this.findRoom(roomId);
    if (!player || !player.id) throw new Error('player id is required');
    const playersAreMapped = room.players instanceof Map;
    const existingPlayer = playersAreMapped
      ? room.players.has(player.id)
      : room.players.some(entry => (entry.player ?? entry).id === player.id);
    if (existingPlayer) return room;
    if (room.status !== GameStatus.LOBBY) throw new Error('room is no longer accepting players');
    const playerCount = playersAreMapped ? room.players.size : room.players.length;
    if (playerCount >= room.maxPlayers) throw new Error('room is full');

    if (playersAreMapped) {
      room.players.set(player.id, player);
    } else {
      room.players.push({ player, status: 'not_ready', score: 0 });
    }
    return room;
  }

  deleteRoom(roomId, requesterId) {
    const room = this.findRoom(roomId);
    if (room.ownerId !== requesterId) throw new Error('only the room owner can delete the room');

    this.rooms.delete(room.id);
    return room;
  }

  removePlayer(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    const updatedRoom = new RoomManager(room).leaveRoom(playerId);
    if (updatedRoom.playerCount === 0) this.rooms.delete(room.id);
    return updatedRoom;
  }
}

module.exports = LobbyManager;
module.exports.GameStatus = GameStatus;