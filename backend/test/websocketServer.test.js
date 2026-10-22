const http = require('http');
const WebSocket = require('ws');
const createWebSocketServer = require('../multiplayer/websocketServer');
const pool = require('../data/db');
const usersService = require('../service/usersService');

// The WebSocket server now requires a logged-in email+authToken on the
// connection URL (see multiplayer/websocketServer.js's 'upgrade' handler),
// so every test connection needs real credentials from a real user row.
// This suite therefore talks to the same real Postgres DB
// usersService.test.js does — see that file for setup notes.
const TEST_PREFIX = `jest_ws_${Date.now()}`;
let emailCounter = 0;
const createdEmails = [];

function uniqueEmail(label) {
  emailCounter += 1;
  const email = `${TEST_PREFIX}_${label}_${emailCounter}@example.com`;
  createdEmails.push(email);
  return email;
}

// Logs a fresh test user in for real (via the same service functions the
// HTTP /users/login + /users/verify routes use) and connects with the
// resulting credentials on the URL, exactly as the frontend does.
async function authedConnect(url, email) {
  const { loginToken } = await usersService.requestLogin(email);
  const { authToken } = await usersService.verifyEmail(email, loginToken);
  const authedUrl = `${url}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(authToken)}`;
  return connect(authedUrl);
}

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

function nextChatMessage(socket) {
  return nextRelevantMessage(socket, ['rooms_list', 'room_updated', 'chat_history']);
}

describe('multiplayer WebSocket server', () => {
  let server;
  let websocketServer;
  let url;

  beforeAll(async () => {
    // Sanity check: make sure we can actually reach the DB before running
    // anything, since every connection now authenticates against it.
    await pool.query('SELECT 1;');
  });

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

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await pool.query('DELETE FROM public.users WHERE email = ANY($1::text[]);', [createdEmails]);
    }
  });

  it('publishes created lobbies in the room list', async () => {
    const { socket: firstSocket } = await authedConnect(url, uniqueEmail('firstSocket'));
    const firstConnected = await sendAndWait(firstSocket, { type: 'list_rooms' });
    expect(firstConnected.type).toBe('rooms_list');

    const created = await sendAndWait(firstSocket, {
      type: 'create_room',
      playerName: 'One',
      roomName: 'Open Lobby',
      maxPlayers: 4,
    });

    const { socket: secondSocket } = await authedConnect(url, uniqueEmail('secondSocket'));
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
    const { socket: playerOneSocket } = await authedConnect(url, uniqueEmail('playerOneSocket'));
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

    const { socket: playerTwoSocket } = await authedConnect(url, uniqueEmail('playerTwoSocket'));
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
    const { socket } = await authedConnect(url, uniqueEmail('socket'));
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
    const { socket } = await authedConnect(url, uniqueEmail('socket'));

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
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'READY3',
    });

    const joinUpdate = nextRelevantMessage(ownerSocket);
    const { socket: memberSocket } = await authedConnect(url, uniqueEmail('memberSocket'));
    await sendAndWait(memberSocket, {
      type: 'join_room',
      roomId: 'READY3',
      name: 'Member',
    });
    // The owner first gets a room_updated for the join itself.
    expect((await joinUpdate).type).toBe('room_updated');

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
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
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

    const { socket: outsideSocket } = await authedConnect(url, uniqueEmail('outsideSocket'));
    const rejected = await sendAndWait(outsideSocket, { type: 'get_room' });
    expect(rejected).toEqual({ type: 'error', message: 'player is not in a room' });
    const leaveRejected = await sendAndWait(outsideSocket, { type: 'leave_room' });
    expect(leaveRejected).toEqual({ type: 'error', message: 'player is not in a room' });

    ownerSocket.close();
    outsideSocket.close();
  });

  it('allows a member to leave, transfers ownership, and removes an empty room', async () => {
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'LEAVE1',
    });

    const { socket: memberSocket } = await authedConnect(url, uniqueEmail('memberSocket'));
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

    const { socket: observerSocket } = await authedConnect(url, uniqueEmail('observerSocket'));
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
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    const created = await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'LIST01',
    });

    const { socket: memberSocket } = await authedConnect(url, uniqueEmail('memberSocket'));
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
    const { socket } = await authedConnect(url, uniqueEmail('socket'));

    const response = await sendAndWait(socket, { type: 'get_players' });

    expect(response).toEqual({ type: 'error', message: 'player is not in a room' });
    socket.close();
  });

  it('enforces owner-only player management and notifies the room after a kick', async () => {
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    const created = await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'KICK01',
      maxPlayers: 4,
    });

    const { socket: targetSocket } = await authedConnect(url, uniqueEmail('targetSocket'));
    const targetJoined = await sendAndWait(targetSocket, {
      type: 'join_room',
      roomId: 'KICK01',
      name: 'Target',
    });

    const { socket: memberSocket } = await authedConnect(url, uniqueEmail('memberSocket'));
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
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    const created = await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'BAN01',
      maxPlayers: 4,
    });

    const { socket: targetSocket } = await authedConnect(url, uniqueEmail('targetSocket'));
    const targetJoined = await sendAndWait(targetSocket, {
      type: 'join_room',
      roomId: 'BAN01',
      name: 'Target',
    });

    const bannedNotification = nextRelevantMessage(targetSocket);
    // The owner is also told (room_updated) when the target joins, so wait
    // for the manage_player reply specifically.
    const result = await sendAndWaitForType(ownerSocket, {
      type: 'manage_player',
      action: 'ban',
      targetPlayerId: targetJoined.playerId,
    }, 'player_managed');

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
    const { socket } = await authedConnect(url, uniqueEmail('socket'));

    const response = await sendAndWait(socket, {
      type: 'manage_player',
      action: 'kick',
      targetPlayerId: 'player-1',
    });

    expect(response).toEqual({ type: 'error', message: 'player is not in a room' });
    socket.close();
  });

  it('allows room discovery and joining after an owner disconnects', async () => {
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      owner: 'Owner',
      code: 'REJOIN1',
    });

    const { socket: remainingSocket } = await authedConnect(url, uniqueEmail('remainingSocket'));
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

    const { socket: joiningSocket } = await authedConnect(url, uniqueEmail('joiningSocket'));
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
    const { socket } = await authedConnect(url, uniqueEmail('socket'));
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
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      owner: 'Owner',
      code: 'MEMBER1',
    });

    const { socket: otherSocket } = await authedConnect(url, uniqueEmail('otherSocket'));
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
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      owner: 'Owner',
      code: 'JOINED1',
    });

    const { socket: memberSocket } = await authedConnect(url, uniqueEmail('memberSocket'));
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
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      roomName: 'Searchable Lobby',
      maxPlayers: 4,
      code: 'LOOKUP1',
    });

    const { socket: searchSocket } = await authedConnect(url, uniqueEmail('searchSocket'));
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
    const { socket } = await authedConnect(url, uniqueEmail('socket'));
    const response = await sendAndWait(socket, {
      type: 'search_room',
      code: 'MISSING',
    });

    expect(response).toEqual({ type: 'error', message: 'room not found' });
    socket.close();
  });

  it('allows the room owner to delete a lobby', async () => {
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
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
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      code: 'NODELETE',
    });

    const { socket: memberSocket } = await authedConnect(url, uniqueEmail('memberSocket'));
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
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    const created = await sendAndWait(ownerSocket, {
      type: 'create_room',
      playerName: 'Owner',
      maxPlayers: 2,
      code: 'FULL99',
    });
    const { socket: secondSocket } = await authedConnect(url, uniqueEmail('secondSocket'));
    await sendAndWait(secondSocket, { type: 'join_room', roomId: created.roomId, name: 'Two' });

    const { socket: thirdSocket } = await authedConnect(url, uniqueEmail('thirdSocket'));
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

  it('tells players already in a room when someone joins', async () => {
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    await sendAndWait(ownerSocket, { type: 'create_room', playerName: 'Owner', code: 'JOIN01', maxPlayers: 4 });

    const ownerUpdate = nextRelevantMessage(ownerSocket);
    const { socket: joinerSocket } = await authedConnect(url, uniqueEmail('joinerSocket'));
    const joined = await sendAndWait(joinerSocket, { type: 'join_room', roomId: 'JOIN01', name: 'Joiner' });
    expect(joined.type).toBe('room_joined');

    const update = await ownerUpdate;
    expect(update.type).toBe('room_updated');
    expect(update.room.playerCount).toBe(2);
    expect(update.room.players.map(entry => entry.player.name)).toEqual(['Owner', 'Joiner']);

    await sendAndWait(ownerSocket, { type: 'delete_room', roomId: 'JOIN01' });
    ownerSocket.close();
    joinerSocket.close();
  });

  it('relays chat messages to everyone in the room, including the sender', async () => {
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    const created = await sendAndWait(ownerSocket, { type: 'create_room', playerName: 'Owner', code: 'CHAT01' });
    const { socket: memberSocket } = await authedConnect(url, uniqueEmail('memberSocket'));
    await sendAndWait(memberSocket, { type: 'join_room', roomId: 'CHAT01', name: 'Member' });

    const memberReceives = sendAndWaitForType(memberSocket, { type: 'get_chat' }, 'chat_history');
    expect((await memberReceives).messages).toEqual([]);

    const ownerEcho = sendAndWaitForType(ownerSocket, { type: 'chat', text: '  hello room  ' }, 'chat_message');
    const memberGets = nextChatMessage(memberSocket);
    const echoed = await ownerEcho;
    const received = await memberGets;

    expect(echoed.message).toEqual(expect.objectContaining({
      playerId: created.playerId,
      name: 'Owner',
      text: 'hello room',
    }));
    expect(received.message.id).toBe(echoed.message.id);

    // Someone who joins afterwards can fetch the history.
    const { socket: lateSocket } = await authedConnect(url, uniqueEmail('lateSocket'));
    await sendAndWait(lateSocket, { type: 'join_room', roomId: 'CHAT01', name: 'Late' });
    const history = await sendAndWaitForType(lateSocket, { type: 'get_chat' }, 'chat_history');
    expect(history.messages.map(entry => entry.text)).toEqual(['hello room']);

    await sendAndWait(ownerSocket, { type: 'delete_room', roomId: 'CHAT01' });
    ownerSocket.close();
    memberSocket.close();
    lateSocket.close();
  });

  it('does not deliver chat to other rooms and validates chat messages', async () => {
    const { socket: roomASocket } = await authedConnect(url, uniqueEmail('roomASocket'));
    await sendAndWait(roomASocket, { type: 'create_room', playerName: 'A', code: 'CHATA1' });
    const { socket: roomBSocket } = await authedConnect(url, uniqueEmail('roomBSocket'));
    await sendAndWait(roomBSocket, { type: 'create_room', playerName: 'B', code: 'CHATB1' });
    const { socket: outsideSocket } = await authedConnect(url, uniqueEmail('outsideSocket'));

    const leaked = [];
    roomBSocket.on('message', data => {
      const message = JSON.parse(data.toString());
      if (message.type === 'chat_message') leaked.push(message);
    });
    await sendAndWaitForType(roomASocket, { type: 'chat', text: 'only for A' }, 'chat_message');
    await sendAndWait(roomBSocket, { type: 'list_rooms' });
    expect(leaked).toEqual([]);

    expect(await sendAndWait(roomASocket, { type: 'chat', text: '   ' }))
      .toEqual({ type: 'error', message: 'message cannot be empty' });
    expect(await sendAndWait(roomASocket, { type: 'chat', text: 'x'.repeat(501) }))
      .toEqual({ type: 'error', message: 'message is too long (max 500 characters)' });
    expect(await sendAndWait(outsideSocket, { type: 'chat', text: 'hi' }))
      .toEqual({ type: 'error', message: 'player is not in a room' });
    expect(await sendAndWait(outsideSocket, { type: 'get_chat' }))
      .toEqual({ type: 'error', message: 'player is not in a room' });

    await sendAndWait(roomASocket, { type: 'delete_room', roomId: 'CHATA1' });
    await sendAndWait(roomBSocket, { type: 'delete_room', roomId: 'CHATB1' });
    roomASocket.close();
    roomBSocket.close();
    outsideSocket.close();
  });

  it('clears chat history when the room is deleted and its code is reused', async () => {
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('ownerSocket'));
    await sendAndWait(ownerSocket, { type: 'create_room', playerName: 'Owner', code: 'CHAT02' });
    await sendAndWaitForType(ownerSocket, { type: 'chat', text: 'old message' }, 'chat_message');
    await sendAndWait(ownerSocket, { type: 'delete_room', roomId: 'CHAT02' });

    await sendAndWait(ownerSocket, { type: 'create_room', playerName: 'Owner', code: 'CHAT02' });
    const history = await sendAndWaitForType(ownerSocket, { type: 'get_chat' }, 'chat_history');
    expect(history.messages).toEqual([]);

    await sendAndWait(ownerSocket, { type: 'delete_room', roomId: 'CHAT02' });
    ownerSocket.close();
  });
});

function waitFor(socket, type) {
  return new Promise(resolve => {
    const onMessage = data => {
      const message = JSON.parse(data.toString());
      if (message.type !== type) return;
      socket.off('message', onMessage);
      resolve(message);
    };
    socket.on('message', onMessage);
  });
}

describe('multiplayer game over WebSocket', () => {
  let server;
  let websocketServer;
  let url;
  const GAME_MS = 800;

  // Every word is real; anything ending in "ZZ" breaks the chain.
  const dictionary = {
    isRealWord: async () => true,
    isChainable: async word => !word.toLowerCase().endsWith('zz'),
  };

  beforeAll(done => {
    server = http.createServer();
    websocketServer = createWebSocketServer(server, { dictionary, gameDurationMs: GAME_MS });
    server.listen(0, () => {
      url = `ws://127.0.0.1:${server.address().port}/multiplayer`;
      done();
    });
  });

  afterAll(done => {
    websocketServer.close(() => server.close(done));
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await pool.query('DELETE FROM public.users WHERE email = ANY($1::text[]);', [createdEmails]);
    }
  });

  // Owner + member in a room, both ready -> game running. Returns sockets and the start message.
  async function startGame(code) {
    const { socket: owner } = await authedConnect(url, uniqueEmail('gameOwner'));
    const created = await sendAndWait(owner, { type: 'create_room', playerName: 'Owner', code, maxPlayers: 4 });
    const { socket: member } = await authedConnect(url, uniqueEmail('gameMember'));
    const joined = await sendAndWait(member, { type: 'join_room', roomId: code, name: 'Member' });

    const ownerStarted = waitFor(owner, 'game_started');
    const memberStarted = waitFor(member, 'game_started');
    await sendAndWaitForType(member, { type: 'set_ready', ready: true }, 'ready_status');
    owner.send(JSON.stringify({ type: 'set_ready', ready: true }));

    return {
      owner,
      member,
      ownerId: created.playerId,
      memberId: joined.playerId,
      ownerStarted: await ownerStarted,
      memberStarted: await memberStarted,
    };
  }

  it('starts for everyone when all players are ready, with the same letters and a 2:00-style clock', async () => {
    const game = await startGame('GAME01');

    expect(game.ownerStarted.game.fragment).toMatch(/^[A-Z]{2}$/);
    expect(game.memberStarted.game.fragment).toBe(game.ownerStarted.game.fragment);
    expect(game.ownerStarted.game.durationMs).toBe(GAME_MS);
    expect(game.ownerStarted.room.status).toBe('in_game');
    expect(game.ownerStarted.scoreboard).toHaveLength(2);

    const list = await sendAndWaitForType(game.owner, { type: 'list_rooms' }, 'rooms_list');
    expect(list.rooms.find(room => room.roomId === 'GAME01').status).toBe('in_game');

    // Wait out the clock so the room is back in the lobby before closing.
    await waitFor(game.owner, 'game_ended');
    game.owner.close();
    game.member.close();
  });

  it('does not start when a player is not ready or only one player is in the room', async () => {
    const { socket: soloSocket } = await authedConnect(url, uniqueEmail('soloSocket'));
    await sendAndWait(soloSocket, { type: 'create_room', playerName: 'Solo', code: 'GAME02' });

    let started = false;
    soloSocket.on('message', data => {
      if (JSON.parse(data.toString()).type === 'game_started') started = true;
    });
    await sendAndWaitForType(soloSocket, { type: 'set_ready', ready: true }, 'ready_status');
    await sendAndWait(soloSocket, { type: 'list_rooms' });
    expect(started).toBe(false);

    await sendAndWait(soloSocket, { type: 'delete_room', roomId: 'GAME02' });
    soloSocket.close();
  });

  it('scores accepted words, rejects bad ones, and shows everyone the scoreboard', async () => {
    const game = await startGame('GAME03');
    const fragment = game.ownerStarted.game.fragment;

    const progress = waitFor(game.member, 'game_progress');
    const accepted = await sendAndWaitForType(game.owner, { type: 'submit_word', word: `${fragment}TIC` }, 'word_accepted');
    expect(accepted).toEqual({ type: 'word_accepted', word: `${fragment}TIC`, points: 5, score: 5, fragment: 'IC' });

    const board = (await progress).scoreboard;
    expect(board[0]).toEqual(expect.objectContaining({ playerId: game.ownerId, score: 5, wordCount: 1 }));

    const wrongStart = await sendAndWaitForType(game.owner, { type: 'submit_word', word: 'ZEBRA' }, 'word_rejected');
    expect(wrongStart).toEqual({ type: 'word_rejected', reason: 'WRONG_START', message: 'Must start with "IC"' });

    const outside = await sendAndWaitForType(game.member, { type: 'submit_word', word: `${fragment}` }, 'word_rejected');
    expect(outside.reason).toBe('TOO_SHORT');

    await waitFor(game.owner, 'game_ended');
    game.owner.close();
    game.member.close();
  });

  it('ends at the timer, names the highest scorer, and returns the room to the lobby', async () => {
    const game = await startGame('GAME04');
    const fragment = game.ownerStarted.game.fragment;

    const ended = waitFor(game.member, 'game_ended');
    await sendAndWaitForType(game.owner, { type: 'submit_word', word: `${fragment}TICS` }, 'word_accepted');
    await sendAndWaitForType(game.member, { type: 'submit_word', word: `${fragment}T` + 'X' }, 'word_accepted');

    const outcome = await ended;
    expect(outcome.winnerIds).toEqual([game.ownerId]);
    expect(outcome.isTie).toBe(false);
    expect(outcome.results.map(result => [result.playerId, result.score])).toEqual([
      [game.ownerId, 6],
      [game.memberId, 4],
    ]);

    const state = await sendAndWaitForType(game.owner, { type: 'get_room' }, 'room_state');
    expect(state.room.status).toBe('lobby');
    expect(state.room.players.every(entry => entry.status === 'not_ready' && entry.score === 0)).toBe(true);

    // The room can be played again straight away.
    const again = waitFor(game.owner, 'game_started');
    await sendAndWaitForType(game.member, { type: 'set_ready', ready: true }, 'ready_status');
    game.owner.send(JSON.stringify({ type: 'set_ready', ready: true }));
    expect((await again).room.status).toBe('in_game');
    await waitFor(game.owner, 'game_ended');

    game.owner.close();
    game.member.close();
  });

  it('ends early when every player\'s run is over', async () => {
    const game = await startGame('GAME05');
    const fragment = game.ownerStarted.game.fragment;

    const ended = waitFor(game.owner, 'game_ended');
    const finished = await sendAndWaitForType(game.owner, { type: 'submit_word', word: `${fragment}ZZ` }, 'player_finished');
    expect(finished).toEqual({ type: 'player_finished', word: `${fragment}ZZ`, lastTwo: 'ZZ', score: 0 });
    game.member.send(JSON.stringify({ type: 'submit_word', word: `${fragment}ZZ` }));

    const started = Date.now();
    expect((await ended).results).toHaveLength(2);
    expect(Date.now() - started).toBeLessThan(GAME_MS);

    game.owner.close();
    game.member.close();
  });

  it('gives the win to the remaining player when the other leaves or disconnects', async () => {
    const left = await startGame('GAME06');
    const leftEnded = waitFor(left.owner, 'game_ended');
    left.member.send(JSON.stringify({ type: 'leave_room' }));
    const afterLeave = await leftEnded;
    expect(afterLeave.winnerIds).toEqual([left.ownerId]);
    expect(afterLeave.results).toHaveLength(1);
    await sendAndWait(left.owner, { type: 'delete_room', roomId: 'GAME06' });
    left.owner.close();
    left.member.close();

    const dropped = await startGame('GAME07');
    const droppedEnded = waitFor(dropped.owner, 'game_ended');
    dropped.member.close();
    expect((await droppedEnded).winnerIds).toEqual([dropped.ownerId]);
    await sendAndWait(dropped.owner, { type: 'delete_room', roomId: 'GAME07' });
    dropped.owner.close();
  });

  it('does not allow ready changes or word submissions outside the right phase', async () => {
    const { socket: ownerSocket } = await authedConnect(url, uniqueEmail('phaseOwner'));
    await sendAndWait(ownerSocket, { type: 'create_room', playerName: 'Owner', code: 'GAME08' });

    expect(await sendAndWait(ownerSocket, { type: 'submit_word', word: 'ASH' }))
      .toEqual({ type: 'error', message: 'no game is in progress' });

    await sendAndWait(ownerSocket, { type: 'delete_room', roomId: 'GAME08' });
    ownerSocket.close();

    const game = await startGame('GAME09');
    const inGame = await sendAndWait(game.owner, { type: 'set_ready', ready: false });
    expect(inGame).toEqual({ type: 'error', message: 'a game is already in progress' });
    await waitFor(game.owner, 'game_ended');
    game.owner.close();
    game.member.close();
  });
});

// Closed once, after every suite in this file has finished with the database.
afterAll(async () => {
  await pool.end();
});
