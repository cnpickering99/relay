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
    expect(manager.getRoomState()).toEqual(expect.objectContaining({
      code: 'TEST01',
      type_of_game: 1,
      playerCount: 2,
    }));
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

  it('updates ready state for a room player', () => {
    const manager = new RoomManager(createRoom());

    expect(manager.setReady('p2')).toEqual({ playerId: 'p2', status: 'ready' });
    expect(manager.room.players[1].status).toBe('ready');
    expect(manager.getPlayerList()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        player: expect.objectContaining({ id: 'p2' }),
        status: 'ready',
        score: 0,
      }),
    ]));
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