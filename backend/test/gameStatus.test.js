const { GameStatus } = require('../multiplayer/enums');
const RoomManager = require('../multiplayer/roomManager');

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

describe('RoomManager lobby lifecycle', () => {
  it('creates rooms in the lobby state', () => {
    const rooms = new RoomManager();
    const room = rooms.createRoom();
    expect(room.status).toBe(GameStatus.LOBBY);
  });

  it('stores the lobby name, capacity, and custom code', () => {
    const rooms = new RoomManager();
    const room = rooms.createRoom({ name: 'Weekend Game', maxPlayers: 6, code: 'WEEK01' });

    expect(room).toEqual(expect.objectContaining({
      id: 'WEEK01',
      name: 'Weekend Game',
      maxPlayers: 6,
      status: GameStatus.LOBBY,
    }));
  });

  it('rejects players after the lobby reaches capacity', () => {
    const rooms = new RoomManager();
    const room = rooms.createRoom({ maxPlayers: 2 });

    rooms.joinRoom(room.id, { id: 'p1' });
    rooms.joinRoom(room.id, { id: 'p2' });

    expect(() => rooms.joinRoom(room.id, { id: 'p3' })).toThrow('room is full');
  });
});
