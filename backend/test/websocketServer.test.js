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
    socket.once('message', onMessage);
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

    socket.once('message', onMessage);
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