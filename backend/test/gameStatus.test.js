const { GameStatus } = require('../multiplayer/enums');
const LobbyManager = require('../multiplayer/lobbyManager');

describe('GameStatus', () => {
  it('defines the supported room states', () => {
    expect(GameStatus).toEqual({
      LOBBY: 'lobby',
      IN_GAME: 'in_game',
    });
  });

  it('is immutable', () => {
    expect(Object.isFrozen(GameStatus)).toBe(true);
  });
});

describe('LobbyManager lobby lifecycle', () => {
  it('creates rooms in the lobby state', () => {
    const rooms = new LobbyManager();
    const room = rooms.createRoom();
    expect(room.status).toBe(GameStatus.LOBBY);
    expect(room.code).toBe(room.id);
  });

  it('stores the lobby name, capacity, and custom code', () => {
    const rooms = new LobbyManager();
    const room = rooms.createRoom({ name: 'Weekend Game', maxPlayers: 6, code: 'WEEK01' });

    expect(room).toEqual(expect.objectContaining({
      id: 'WEEK01',
      code: 'WEEK01',
      name: 'Weekend Game',
      maxPlayers: 6,
      status: GameStatus.LOBBY,
    }));
  });

  it('allows an owner to create only one room', () => {
    const rooms = new LobbyManager();
    rooms.createRoom({ ownerId: 'player-1' });

    expect(() => rooms.createRoom({ ownerId: 'player-1' })).toThrow('player already owns a room');
  });

  it('rejects players after the lobby reaches capacity', () => {
    const rooms = new LobbyManager();
    const room = rooms.createRoom({ maxPlayers: 2 });

    rooms.joinRoom(room.id, { id: 'p1' });
    rooms.joinRoom(room.id, { id: 'p2' });

    expect(() => rooms.joinRoom(room.id, { id: 'p3' })).toThrow('room is full');
  });

  it('delegates player removal and supports later joins after normalization', () => {
    const rooms = new LobbyManager();
    const room = rooms.createRoom({ ownerId: 'p1' });
    rooms.joinRoom(room.id, { id: 'p1', name: 'Owner' });
    rooms.joinRoom(room.id, { id: 'p2', name: 'Player Two' });

    const state = rooms.removePlayer(room.id, 'p1');

    expect(state.ownerId).toBe('p2');
    expect(state.playerCount).toBe(1);
    expect(room.players).toEqual([
      expect.objectContaining({ player: expect.objectContaining({ id: 'p2' }) }),
    ]);

    rooms.joinRoom(room.id, { id: 'p3', name: 'Player Three' });
    expect(room.players).toHaveLength(2);
    expect(room.players[1]).toEqual({
      player: { id: 'p3', name: 'Player Three' },
      status: 'not_ready',
      score: 0,
    });
  });

  it('bans a player permanently from the room they were banned in', () => {
    const rooms = new LobbyManager();
    const room = rooms.createRoom({ ownerId: 'owner-1' });
    rooms.joinRoom(room.id, { id: 'owner-1', name: 'Owner' });
    rooms.joinRoom(room.id, { id: 'troll', name: 'Troll' });

    rooms.banPlayer('owner-1', 'troll');

    expect(rooms.isBannedByOwner('owner-1', 'troll')).toBe(true);
    expect(() => rooms.joinRoom(room.id, { id: 'troll', name: 'Troll' }))
      .toThrow('player is banned from this room');
  });

  it('bans a player from every future room the banning owner creates', () => {
    const rooms = new LobbyManager();
    const firstRoom = rooms.createRoom({ ownerId: 'owner-1', code: 'ROOMA' });
    rooms.joinRoom(firstRoom.id, { id: 'owner-1', name: 'Owner' });
    rooms.joinRoom(firstRoom.id, { id: 'troll', name: 'Troll' });
    rooms.banPlayer('owner-1', 'troll');

    // owner leaves/deletes the first room and opens a new one later
    rooms.deleteRoom(firstRoom.id, 'owner-1');
    const secondRoom = rooms.createRoom({ ownerId: 'owner-1', code: 'ROOMB' });
    rooms.joinRoom(secondRoom.id, { id: 'owner-1', name: 'Owner' });

    expect(() => rooms.joinRoom(secondRoom.id, { id: 'troll', name: 'Troll' }))
      .toThrow('player is banned from this room');
  });

  it('does not ban a player from rooms owned by someone else', () => {
    const rooms = new LobbyManager();
    const bannedFromRoom = rooms.createRoom({ ownerId: 'owner-1', code: 'ROOMA' });
    rooms.joinRoom(bannedFromRoom.id, { id: 'owner-1', name: 'Owner' });
    rooms.banPlayer('owner-1', 'troll');

    const otherOwnersRoom = rooms.createRoom({ ownerId: 'owner-2', code: 'ROOMC' });
    rooms.joinRoom(otherOwnersRoom.id, { id: 'owner-2', name: 'Other Owner' });

    expect(() => rooms.joinRoom(otherOwnersRoom.id, { id: 'troll', name: 'Troll' }))
      .not.toThrow();
  });
});
