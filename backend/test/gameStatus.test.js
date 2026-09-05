const GameStatus = require('../multiplayer/gameStatus');
const RoomManager = require('../multiplayer/roomManager');

describe('GameStatus', () => {
  it('defines the supported room states', () => {
    expect(GameStatus).toEqual({
      LOBBY: 'lobby',
      QUEUED: 'queued',
      GAME: 'game',
    });
  });

  it('is immutable', () => {
    expect(Object.isFrozen(GameStatus)).toBe(true);
  });
});

describe('RoomManager status lifecycle', () => {
  function createReadyLobby(playerIds = ['p1', 'p2']) {
    const rooms = new RoomManager();
    const room = rooms.createRoom();

    for (const id of playerIds) {
      rooms.joinRoom(room.id, { id, name: id });
      rooms.setPlayerMode(room.id, id, 'classic');
      rooms.setPlayerReady(room.id, id, true);
    }

    return { rooms, room };
  }

  it('creates rooms in the lobby state', () => {
    const { room } = createReadyLobby(['p1']);
    expect(room.status).toBe(GameStatus.LOBBY);
  });

  it('moves a ready player into the queue', () => {
    const { rooms, room } = createReadyLobby();

    expect(rooms.joinQueue(room.id, 'p1')).toBeNull();
    expect(room.status).toBe(GameStatus.QUEUED);
  });

  it('creates a game room when a compatible second player queues', () => {
    const { rooms, room } = createReadyLobby();
    rooms.joinQueue(room.id, 'p1');
    const match = rooms.joinQueue(room.id, 'p2');

    expect(match.status).toBe(GameStatus.GAME);
    expect(match.mode).toBe('classic');
    expect([...match.players.keys()]).toEqual(['p1', 'p2']);
  });

  it('does not match players using different modes', () => {
    const rooms = new RoomManager();
    const classicLobby = rooms.createRoom();
    const rankedLobby = rooms.createRoom();

    rooms.joinRoom(classicLobby.id, { id: 'p1' });
    rooms.setPlayerMode(classicLobby.id, 'p1', 'classic');
    rooms.setPlayerReady(classicLobby.id, 'p1', true);
    rooms.joinRoom(rankedLobby.id, { id: 'p2' });
    rooms.setPlayerMode(rankedLobby.id, 'p2', 'ranked');
    rooms.setPlayerReady(rankedLobby.id, 'p2', true);

    expect(rooms.joinQueue(classicLobby.id, 'p1')).toBeNull();
    expect(rooms.joinQueue(rankedLobby.id, 'p2')).toBeNull();
  });

  it('requires mode selection and readiness before queueing', () => {
    const rooms = new RoomManager();
    const room = rooms.createRoom();
    rooms.joinRoom(room.id, { id: 'p1' });

    expect(() => rooms.joinQueue(room.id, 'p1')).toThrow('choose a game mode first');
    rooms.setPlayerMode(room.id, 'p1', 'classic');
    expect(() => rooms.joinQueue(room.id, 'p1')).toThrow(
      'player must be ready before joining the queue'
    );
  });
});
