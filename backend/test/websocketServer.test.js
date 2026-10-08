const http = require('http');
const WebSocket = require('ws');
const createWebSocketServer = require('../multiplayer/websocketServer');

function nextMessage(socket) {
  return new Promise((resolve, reject) => {
    const onMessage = data => {
      cleanup();
      resolve(JSON.parse(data.toString()));
    };
    const onError = error => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('message', onMessage);
      socket.off('error', onError);
    };
    socket.on('message', onMessage);
    socket.once('error', onError);
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);

    const onMessage = data => {
      socket.off('error', onError);
      resolve({ socket, message: JSON.parse(data.toString()) });
    };

    const onError = error => {
      socket.off('message', onMessage);
      reject(error);
    };

    socket.once('message', onMessage);
    socket.once('error', onError);
  });
}

function sendAndWait(socket, payload) {
  return new Promise((resolve, reject) => {
    const onMessage = data => {
      const message = JSON.parse(data.toString());
      if (message.type === 'rooms_list' && payload.type !== 'list_rooms') return;
      cleanup();
      resolve(message);
    };
    const onError = error => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('message', onMessage);
      socket.off('error', onError);
    };

    socket.on('message', onMessage);
    socket.once('error', onError);
    socket.send(JSON.stringify(payload));
  });
}

function sendAndWaitForType(socket, payload, expectedType) {
  return new Promise((resolve, reject) => {
    const onMessage = data => {
      const message = JSON.parse(data.toString());
      if (message.type !== expectedType) return;
      cleanup();
      resolve(message);
    };
    const onError = error => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('message', onMessage);
      socket.off('error', onError);
    };

    socket.on('message', onMessage);
    socket.once('error', onError);
    socket.send(JSON.stringify(payload));
  });
}

function nextRelevantMessage(socket, ignoredTypes = ['rooms_list']) {
  return new Promise((resolve, reject) => {
    const onMessage = data => {
      const message = JSON.parse(data.toString());
      if (ignoredTypes.includes(message.type)) {
        return;
      }
      cleanup();
      resolve(message);
    };
    const onError = error => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('message', onMessage);
      socket.off('error', onError);
    };

    socket.on('message', onMessage);
    socket.once('error', onError);
  });
}

describe('multiplayer WebSocket server', () => {
  let server;
  let websocketServer;
  let url;

  beforeAll(done => {
    server = http.createServer();
    websocketServer = createWebSocketServer(server);
    server.listen(0, () => {
      url = `ws://127.0.0.1:${server.address().port}/multiplayer`;
      done();
    });
  });

  afterAll(done => {
    websocketServer.close(() => server.close(done));
  });

  it('publishes created lobbies in the room list', async () => {
    const { socket: firstSocket } = await connect(url);
    const firstConnected = await sendAndWait(firstSocket, { type: 'list_rooms' });
    expect(firstConnected.type).toBe('rooms_list');

    const created = await sendAndWait(firstSocket, {
      type: 'create_room',
      playerName: 'One',
      roomName: 'Open Lobby',
      maxPlayers: 4,
    });

    const { socket: secondSocket } = await connect(url);
    const secondList = await sendAndWait(secondSocket, { type: 'list_rooms' });

    expect(secondList.type).toBe('rooms_list');
    expect(secondList.rooms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomId: created.roomId,
          name: 'Open Lobby',
          maxPlayers: 4,
          status: 'lobby',
          playerCount: 1,
        }),
      ]),
    );

    firstSocket.close();
    secondSocket.close();
  });

  it('creates a named lobby and allows direct room-code joining', async () => {
    const { socket: playerOneSocket } = await connect(url);
    const created = await sendAndWait(playerOneSocket, {
      type: 'create_room',
      playerName: 'One',
      roomName: 'Saturday Relay',
      maxPlayers: 2,
      code: 'SAT123',
    });

    expect(created.type).toBe('room_created');
    expect(created.room).toEqual(expect.objectContaining({
      roomId: 'SAT123',
      name: 'Saturday Relay',
      maxPlayers: 2,
      status: 'lobby',
    }));

    const { socket: playerTwoSocket } = await connect(url);
    const joined = await sendAndWait(playerTwoSocket, {
      type: 'join_room',
      roomId: 'sat123',
      name: 'Two',
    });

    expect(joined.type).toBe('room_joined');
    expect(joined.room.playerCount).toBe(2);
    expect(joined.room.players).toBeUndefined();

    playerOneSocket.close();
    playerTwoSocket.close();
  });

  it('sets ready and not-ready status for a room member', async () => {
    const { socket } = await connect(url);
    const created = await sendAndWait(socket, {
      type: 'create_room',
      playerName: 'Ready Player',
      code: 'READY1',
    });

    const ready = await sendAndWait(socket, { type: 'set_ready', ready: true });
    expect(ready).toEqual({
      type: 'ready_status',
      playerId: created.playerId,
      status: 'ready',
    });

    const notReady = await sendAndWait(socket, { type: 'set_ready', ready: false });
    expect(notReady).toEqual({
      type: 'ready_status',
      playerId: created.playerId,
      status: 'not_ready',
    });

    socket.close();
  });

  it('rejects invalid ready values and players outside a room', async () => {
    const { socket } = await connect(url);

    const outsideRoom = await sendAndWait(socket, { type: 'set_ready', ready: true });
    expect(outsideRoom).toEqual({ type: 'error', message: 'player is not in a room' });

    await sendAndWait(socket, {
      type: 'create_room',
      playerName: 'Ready Player',
      code: 'READY2',
    });

    const invalidReady = await sendAndWait(socket, { type: 'set_ready', ready: 'true' });
    expect(invalidReady).toEqual({ type: 'error', message: 'ready must be a boolean' });

    socket.close();
  });

  it('broadcasts ready changes to other room members', async () => {
    const { socket: ownerSocket } = await connect(url);
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'READY3',
    });

    const { socket: memberSocket } = await connect(url);
    await sendAndWait(memberSocket, {
      type: 'join_room',
      roomId: 'READY3',
      name: 'Member',
    });

    const roomUpdatePromise = nextRelevantMessage(ownerSocket);
    const ready = await sendAndWaitForType(
      memberSocket,
      { type: 'set_ready', ready: true },
      'ready_status',
    );
    const roomUpdate = await roomUpdatePromise;

    expect(ready.status).toBe('ready');
    expect(roomUpdate.type).toBe('room_updated');
    expect(roomUpdate.room.players).toEqual(expect.arrayContaining([
      expect.objectContaining({
        player: expect.objectContaining({ name: 'Member' }),
        status: 'ready',
      }),
    ]));

    ownerSocket.close();
    memberSocket.close();
  });

  it('returns room state to a member and rejects clients outside the room', async () => {
    const { socket: ownerSocket } = await connect(url);
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'GETROOM',
    });

    const roomState = await sendAndWaitForType(
      ownerSocket,
      { type: 'get_room' },
      'room_state',
    );
    expect(roomState.room).toEqual(expect.objectContaining({
      code: 'GETROOM',
      name: 'Owner',
      status: 'lobby',
      maxPlayers: 4,
      type_of_game: 1,
      playerCount: 1,
    }));
    expect(roomState.room).not.toHaveProperty('roomId');

    const { socket: outsideSocket } = await connect(url);
    const rejected = await sendAndWait(outsideSocket, { type: 'get_room' });
    expect(rejected).toEqual({ type: 'error', message: 'player is not in a room' });
    const leaveRejected = await sendAndWait(outsideSocket, { type: 'leave_room' });
    expect(leaveRejected).toEqual({ type: 'error', message: 'player is not in a room' });

    ownerSocket.close();
    outsideSocket.close();
  });

  it('allows a member to leave, transfers ownership, and removes an empty room', async () => {
    const { socket: ownerSocket } = await connect(url);
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'LEAVE1',
    });

    const { socket: memberSocket } = await connect(url);
    const joined = await sendAndWait(memberSocket, {
      type: 'join_room',
      roomId: 'LEAVE1',
      name: 'Member',
    });

    const ownerUpdatePromise = nextRelevantMessage(memberSocket);
    const ownerLeft = await sendAndWaitForType(
      ownerSocket,
      { type: 'leave_room' },
      'room_left',
    );
    const ownerUpdate = await ownerUpdatePromise;

    expect(ownerLeft.roomId).toBe('LEAVE1');
    expect(ownerUpdate.type).toBe('room_updated');
    expect(ownerUpdate.room.ownerId).toBe(joined.playerId);
    expect(ownerUpdate.room.playerCount).toBe(1);

    const memberLeft = await sendAndWaitForType(
      memberSocket,
      { type: 'leave_room' },
      'room_left',
    );
    expect(memberLeft.roomId).toBe('LEAVE1');

    const { socket: observerSocket } = await connect(url);
    const roomList = await sendAndWaitForType(
      observerSocket,
      { type: 'list_rooms' },
      'rooms_list',
    );
    expect(roomList.rooms).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ roomId: 'LEAVE1' }),
    ]));

    ownerSocket.close();
    memberSocket.close();
    observerSocket.close();
  });

  it('returns every room player with status, score, and owner state', async () => {
    const { socket: ownerSocket } = await connect(url);
    const created = await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'LIST01',
    });

    const { socket: memberSocket } = await connect(url);
    const joined = await sendAndWait(memberSocket, {
      type: 'join_room',
      roomId: 'LIST01',
      name: 'Member',
    });
    await sendAndWait(memberSocket, { type: 'set_ready', ready: true });

    const response = await sendAndWaitForType(
      ownerSocket,
      { type: 'get_players' },
      'players_list',
    );

    expect(response).toEqual({
      type: 'players_list',
      players: [
        {
          player: { id: created.playerId, name: 'Owner' },
          status: 'not_ready',
          score: 0,
          isOwner: true,
        },
        {
          player: { id: joined.playerId, name: 'Member' },
          status: 'ready',
          score: 0,
          isOwner: false,
        },
      ],
    });

    ownerSocket.close();
    memberSocket.close();
  });

  it('rejects player-list requests from clients outside a room', async () => {
    const { socket } = await connect(url);

    const response = await sendAndWait(socket, { type: 'get_players' });

    expect(response).toEqual({ type: 'error', message: 'player is not in a room' });
    socket.close();
  });

  it('enforces owner-only player management and notifies the room after a kick', async () => {
    const { socket: ownerSocket } = await connect(url);
    const created = await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'KICK01',
      maxPlayers: 4,
    });

    const { socket: targetSocket } = await connect(url);
    const targetJoined = await sendAndWait(targetSocket, {
      type: 'join_room',
      roomId: 'KICK01',
      name: 'Target',
    });

    const { socket: memberSocket } = await connect(url);
    await sendAndWait(memberSocket, {
      type: 'join_room',
      roomId: 'KICK01',
      name: 'Member',
    });

    const notOwner = await sendAndWait(memberSocket, {
      type: 'manage_player',
      action: 'kick',
      targetPlayerId: targetJoined.playerId,
    });
    expect(notOwner).toEqual({
      type: 'error',
      message: 'only the room owner can manage players',
    });

    const selfKick = await sendAndWait(ownerSocket, {
      type: 'manage_player',
      action: 'kick',
      targetPlayerId: created.playerId,
    });
    expect(selfKick).toEqual({ type: 'error', message: 'room owner cannot be kicked' });

    const unsupportedAction = await sendAndWait(ownerSocket, {
      type: 'manage_player',
      action: 'mute',
      targetPlayerId: targetJoined.playerId,
    });
    expect(unsupportedAction).toEqual({
      type: 'error',
      message: 'unsupported player management action',
    });

    const missingPlayer = await sendAndWait(ownerSocket, {
      type: 'manage_player',
      action: 'kick',
      targetPlayerId: 'missing-player',
    });
    expect(missingPlayer).toEqual({ type: 'error', message: 'player is not in the room' });

    const kickedNotification = nextMessage(targetSocket);
    const roomUpdate = nextMessage(memberSocket);
    const result = await sendAndWait(ownerSocket, {
      type: 'manage_player',
      action: 'kick',
      targetPlayerId: targetJoined.playerId,
    });

    expect(result.type).toBe('player_managed');
    expect(result.room.players).toEqual(expect.arrayContaining([
      expect.objectContaining({ player: expect.objectContaining({ id: created.playerId }) }),
      expect.objectContaining({ player: expect.objectContaining({ name: 'Member' }) }),
    ]));
    expect(result.room.players).toHaveLength(2);
    expect(await kickedNotification).toEqual({ type: 'player_kicked', roomId: 'KICK01' });

    const update = await roomUpdate;
    expect(update.type).toBe('room_updated');
    expect(update.room.players).toHaveLength(2);
    expect(update.room.players).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ player: expect.objectContaining({ id: targetJoined.playerId }) }),
    ]));

    const finalPlayers = await sendAndWait(ownerSocket, { type: 'get_players' });
    expect(finalPlayers.players).toHaveLength(2);

    ownerSocket.close();
    targetSocket.close();
    memberSocket.close();
  });

  it('bans a player and blocks them from rejoining that owner\'s rooms afterward', async () => {
    const { socket: ownerSocket } = await connect(url);
    const created = await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'BAN01',
      maxPlayers: 4,
    });

    const { socket: targetSocket } = await connect(url);
    const targetJoined = await sendAndWait(targetSocket, {
      type: 'join_room',
      roomId: 'BAN01',
      name: 'Target',
    });

    const bannedNotification = nextMessage(targetSocket);
    const result = await sendAndWait(ownerSocket, {
      type: 'manage_player',
      action: 'ban',
      targetPlayerId: targetJoined.playerId,
    });

    expect(result.type).toBe('player_managed');
    expect(result.room.players).toHaveLength(1);
    expect(await bannedNotification).toEqual({ type: 'player_banned', roomId: 'BAN01' });

    const rejoinAttempt = await sendAndWait(targetSocket, {
      type: 'join_room',
      roomId: 'BAN01',
      name: 'Target',
    });
    expect(rejoinAttempt).toEqual({ type: 'error', message: 'player is banned from this room' });

    await sendAndWait(ownerSocket, { type: 'delete_room', roomId: 'BAN01' });

    const secondRoom = await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'BAN02',
      maxPlayers: 4,
    });
    expect(secondRoom.type).toBe('room_created');

    const newRoomJoinAttempt = await sendAndWait(targetSocket, {
      type: 'join_room',
      roomId: 'BAN02',
      name: 'Target',
    });
    expect(newRoomJoinAttempt).toEqual({ type: 'error', message: 'player is banned from this room' });

    ownerSocket.close();
    targetSocket.close();
  });

  it('rejects player-management requests from clients outside a room', async () => {
    const { socket } = await connect(url);

    const response = await sendAndWait(socket, {
      type: 'manage_player',
      action: 'kick',
      targetPlayerId: 'player-1',
    });

    expect(response).toEqual({ type: 'error', message: 'player is not in a room' });
    socket.close();
  });

  it('allows room discovery and joining after an owner disconnects', async () => {
    const { socket: ownerSocket } = await connect(url);
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      owner: 'Owner',
      code: 'REJOIN1',
    });

    const { socket: remainingSocket } = await connect(url);
    await sendAndWait(remainingSocket, {
      type: 'join_room',
      roomId: 'REJOIN1',
      name: 'Remaining',
    });

    const disconnectUpdatePromise = nextRelevantMessage(remainingSocket);
    const ownerDisconnected = new Promise(resolve => ownerSocket.once('close', resolve));
    ownerSocket.close();
    await ownerDisconnected;
    const disconnectUpdate = await disconnectUpdatePromise;
    expect(disconnectUpdate.type).toBe('room_updated');
    expect(disconnectUpdate.room.ownerId).toBe(
      disconnectUpdate.room.players[0].player.id,
    );

    const { socket: joiningSocket } = await connect(url);
    const roomList = await sendAndWait(joiningSocket, { type: 'list_rooms' });
    expect(roomList.rooms).toEqual(expect.arrayContaining([
      expect.objectContaining({ roomId: 'REJOIN1', playerCount: 1 }),
    ]));

    const joined = await sendAndWait(joiningSocket, {
      type: 'join_room',
      roomId: 'REJOIN1',
      name: 'New Player',
    });
    expect(joined.room.playerCount).toBe(2);

    remainingSocket.close();
    joiningSocket.close();
  });

  it('prevents one player from creating more than one lobby', async () => {
    const { socket } = await connect(url);
    await sendAndWait(socket, {
      type: 'create_room',
      owner: 'Owner',
      code: 'ONEONLY',
    });

    const rejected = await sendAndWait(socket, {
      type: 'create_room',
      owner: 'Owner',
      code: 'SECOND1',
    });

    expect(rejected).toEqual({ type: 'error', message: 'player is already in a room' });
    socket.close();
  });

  it('prevents a room member from joining another lobby', async () => {
    const { socket: ownerSocket } = await connect(url);
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      owner: 'Owner',
      code: 'MEMBER1',
    });

    const { socket: otherSocket } = await connect(url);
    await sendAndWait(otherSocket, {
      type: 'create_room',
      owner: 'Other',
      code: 'MEMBER2',
    });

    const rejected = await sendAndWait(otherSocket, {
      type: 'join_room',
      roomId: 'MEMBER1',
      name: 'Other',
    });

    expect(rejected).toEqual({ type: 'error', message: 'player is already in a room' });
    ownerSocket.close();
    otherSocket.close();
  });

  it('prevents a room member from creating another lobby', async () => {
    const { socket: ownerSocket } = await connect(url);
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      owner: 'Owner',
      code: 'JOINED1',
    });

    const { socket: memberSocket } = await connect(url);
    await sendAndWait(memberSocket, {
      type: 'join_room',
      roomId: 'JOINED1',
      name: 'Member',
    });

    const rejected = await sendAndWait(memberSocket, {
      type: 'create_room',
      owner: 'Member',
      code: 'JOINED2',
    });

    expect(rejected).toEqual({ type: 'error', message: 'player is already in a room' });
    ownerSocket.close();
    memberSocket.close();
  });

  it('searches for a lobby by code without joining it', async () => {
    const { socket: ownerSocket } = await connect(url);
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      roomName: 'Searchable Lobby',
      maxPlayers: 4,
      code: 'LOOKUP1',
    });

    const { socket: searchSocket } = await connect(url);
    const found = await sendAndWait(searchSocket, {
      type: 'search_room',
      roomId: 'lookup1',
    });

    expect(found.type).toBe('room_found');
    expect(found.room).toEqual(expect.objectContaining({
      roomId: 'LOOKUP1',
      name: 'Searchable Lobby',
      maxPlayers: 4,
      playerCount: 1,
    }));
    expect(found.room.players).toBeUndefined();

    ownerSocket.close();
    searchSocket.close();
  });

  it('returns an error when searching for an unknown room code', async () => {
    const { socket } = await connect(url);
    const response = await sendAndWait(socket, {
      type: 'search_room',
      code: 'MISSING',
    });

    expect(response).toEqual({ type: 'error', message: 'room not found' });
    socket.close();
  });

  it('allows the room owner to delete a lobby', async () => {
    const { socket: ownerSocket } = await connect(url);
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      roomName: 'Disposable Lobby',
      code: 'DELETE1',
    });

    const deleted = await sendAndWait(ownerSocket, {
      type: 'delete_room',
      roomId: 'delete1',
    });

    expect(deleted).toEqual({ type: 'room_deleted', roomId: 'DELETE1' });

    const rooms = await sendAndWait(ownerSocket, { type: 'list_rooms' });
    expect(rooms.rooms).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ roomId: 'DELETE1' })]),
    );
    ownerSocket.close();
  });

  it('prevents a non-owner from deleting a lobby', async () => {
    const { socket: ownerSocket } = await connect(url);
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'NODELETE',
    });

    const { socket: memberSocket } = await connect(url);
    await sendAndWait(memberSocket, {
      type: 'join_room',
      roomId: 'NODELETE',
      name: 'Member',
    });

    const rejected = await sendAndWait(memberSocket, {
      type: 'delete_room',
      roomId: 'NODELETE',
    });

    expect(rejected).toEqual({
      type: 'error',
      message: 'only the room owner can delete the room',
    });
    ownerSocket.close();
    memberSocket.close();
  });

  it('rejects a third player when a lobby reaches capacity', async () => {
    const { socket: ownerSocket } = await connect(url);
    const created = await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      maxPlayers: 2,
      code: 'FULL99',
    });
    const { socket: secondSocket } = await connect(url);
    await sendAndWait(secondSocket, { type: 'join_room', roomId: created.roomId, name: 'Two' });

    const { socket: thirdSocket } = await connect(url);
    const rejected = await sendAndWait(thirdSocket, {
      type: 'join_room',
      roomId: created.roomId,
      name: 'Three',
    });

    expect(rejected).toEqual({ type: 'error', message: 'room is full' });
    ownerSocket.close();
    secondSocket.close();
    thirdSocket.close();
  });
});