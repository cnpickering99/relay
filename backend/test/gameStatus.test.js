const { GameStatus } = require('../multiplayer/enums');
const LobbyManager = require('../multiplayer/lobbyManager');

describe('GameStatus', () => {
  it('defines the supported room states', () => {
    expect(GameStatus).toEqual({
      LOBBY: 'lobby',
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
  });

  it('stores the lobby name, capacity, and custom code', () => {
    const rooms = new LobbyManager();
    const room = rooms.createRoom({ name: 'Weekend Game', maxPlayers: 6, code: 'WEEK01' });

    expect(room).toEqual(expect.objectContaining({
      id: 'WEEK01',
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
});
