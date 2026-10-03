const RoomManager = require('../multiplayer/roomManager');

function createRoom() {
  return {
    id: 'ROOM1',
    code: 'TEST01',
    name: 'Test Lobby',
    ownerId: 'p1',
    status: 'lobby',
    maxPlayers: 4,
    players: new Map([
      ['p1', { id: 'p1', name: 'Owner' }],
      ['p2', { id: 'p2', name: 'Player Two' }],
    ]),
  };
}

describe('RoomManager', () => {
  it('returns room and code state', () => {
    const manager = new RoomManager(createRoom());

    expect(manager.getRoomCode()).toBe('TEST01');
    const roomState = manager.getRoomState();
    expect(roomState).toEqual(expect.objectContaining({
      code: 'TEST01',
      name: 'Test Lobby',
      ownerId: 'p1',
      type_of_game: 1,
      status: 'lobby',
      playerCount: 2,
      maxPlayers: 4,
    }));
    expect(roomState).not.toHaveProperty('roomId');
    expect(roomState.players).toEqual(expect.any(Array));
    expect(roomState.players).not.toBe(manager.room.players);
    expect(manager.room.players).toEqual([
      expect.objectContaining({
        player: expect.objectContaining({ id: 'p1' }),
        status: 'not_ready',
        score: 0,
      }),
      expect.objectContaining({
        player: expect.objectContaining({ id: 'p2' }),
        status: 'not_ready',
        score: 0,
      }),
    ]);
  });

  it('normalizes legacy player data and isolates public player views', () => {
    const room = {
      id: 'ROOM2',
      players: new Map([
        ['p1', { id: 'p1', name: 'Ready Player', ready: true, score: 12, token: 'private' }],
        ['p2', {
          player: { id: 'p2', name: 'Player Two', token: 'private' },
          status: 'ready',
          score: 4,
        }],
      ]),
    };
    const manager = new RoomManager(room);

    expect(room.code).toBe('ROOM2');
    expect(room.type_of_game).toBe(1);
    expect(room.players).toEqual([
      { player: { id: 'p1', name: 'Ready Player' }, status: 'ready', score: 12 },
      { player: { id: 'p2', name: 'Player Two' }, status: 'ready', score: 4 },
    ]);

    const publicState = manager.getRoomState();
    publicState.players[0].player.name = 'Changed externally';
    expect(manager.room.players[0].player.name).toBe('Ready Player');
    expect(publicState.players[0].player.token).toBeUndefined();
  });

  it('requires a room code when neither code nor id is available', () => {
    expect(() => new RoomManager({ players: [] })).toThrow('room code is required');
  });

  it('updates ready state for a room player', () => {
    const manager = new RoomManager(createRoom());

    expect(manager.setReady('p2')).toEqual({ playerId: 'p2', status: 'ready' });
    expect(manager.room.players[1].status).toBe('ready');
    expect(manager.setReady('p2', false)).toEqual({ playerId: 'p2', status: 'not_ready' });
    expect(manager.room.players[1].status).toBe('not_ready');
    expect(manager.getPlayerList()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        player: expect.objectContaining({ id: 'p2' }),
        status: 'not_ready',
        score: 0,
      }),
    ]));
  });

  it('rejects ready updates for players outside the room', () => {
    const manager = new RoomManager(createRoom());

    expect(() => manager.setReady('missing')).toThrow('player is not in the room');
  });

  it('removes a player and transfers ownership when the owner leaves', () => {
    const room = createRoom();
    const manager = new RoomManager(room);

    manager.leaveRoom('p1');

    expect(room.players).toHaveLength(1);
    expect(room.ownerId).toBe('p2');
  });

  it('removes a non-owner without changing ownership', () => {
    const room = createRoom();
    const manager = new RoomManager(room);

    const state = manager.leaveRoom('p2');

    expect(state.ownerId).toBe('p1');
    expect(state.playerCount).toBe(1);
    expect(manager.getPlayerList()).toEqual([
      expect.objectContaining({
        player: expect.objectContaining({ id: 'p1' }),
        isOwner: true,
      }),
    ]);
  });

  it('clears ownership when the last player leaves', () => {
    const room = createRoom();
    const manager = new RoomManager(room);

    manager.leaveRoom('p1');
    const state = manager.leaveRoom('p2');

    expect(state.ownerId).toBeUndefined();
    expect(state.playerCount).toBe(0);
  });

  it('rejects a player who is not in the room', () => {
    const manager = new RoomManager(createRoom());

    expect(() => manager.leaveRoom('missing'))
      .toThrow('player is not in the room');
  });

  it('allows only the owner to kick a player', () => {
    const manager = new RoomManager(createRoom());

    expect(() => manager.managePlayer('p2', 'p1', 'kick'))
      .toThrow('only the room owner can manage players');

    manager.managePlayer('p1', 'p2', 'kick');
    expect(manager.getPlayerList()).toHaveLength(1);
  });
});