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

  it('broadcasts the updated room list to every connected browser when a room is created', async () => {
    const { socket: firstSocket } = await connect(url);
    const firstConnected = await sendAndWait(firstSocket, { type: 'list_rooms' });
    expect(firstConnected.type).toBe('rooms_list');

    const created = await sendAndWait(firstSocket, { type: 'create_room', name: 'One' });

    const { socket: secondSocket } = await connect(url);
    const secondList = await sendAndWait(secondSocket, { type: 'list_rooms' });

    expect(secondList.type).toBe('rooms_list');
    expect(secondList.rooms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roomId: created.roomId, players: expect.any(Array) }),
      ]),
    );

    const firstBroadcast = await nextRelevantMessage(firstSocket, []);
    expect(firstBroadcast.type).toBe('rooms_list');
    expect(firstBroadcast.rooms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roomId: created.roomId }),
      ]),
    );

    firstSocket.close();
    secondSocket.close();
  });

  it('supports lobby setup and same-mode queue matching', async () => {
    const { socket: playerOneSocket, message: connectedOne } = await connect(url);
    const created = await sendAndWait(playerOneSocket, { type: 'create_room', name: 'One' });

    const { socket: playerTwoSocket, message: secondConnected } = await connect(url);
    const joined = await sendAndWait(playerTwoSocket, {
      type: 'join_room',
      roomId: created.roomId,
      name: 'Two',
    });

    expect(joined.type).toBe('room_joined');

    const oneModePromise = nextRelevantMessage(playerOneSocket);
    const twoModePromise = nextRelevantMessage(playerTwoSocket);
    playerOneSocket.send(JSON.stringify({ type: 'choose_mode', mode: 'classic' }));
    const [oneModeUpdate, twoModeUpdate] = await Promise.all([oneModePromise, twoModePromise]);
    expect(oneModeUpdate.type).toBe('lobby_updated');
    expect(twoModeUpdate.type).toBe('lobby_updated');

    const secondOneModePromise = nextRelevantMessage(playerOneSocket);
    const secondTwoModePromise = nextRelevantMessage(playerTwoSocket);
    playerTwoSocket.send(JSON.stringify({ type: 'choose_mode', mode: 'classic' }));
    const [secondOneModeUpdate, secondTwoModeUpdate] = await Promise.all([
      secondOneModePromise,
      secondTwoModePromise,
    ]);
    expect(secondOneModeUpdate.type).toBe('lobby_updated');
    expect(secondTwoModeUpdate.type).toBe('lobby_updated');

    const oneReadyPromise = nextRelevantMessage(playerOneSocket);
    const twoReadyPromise = nextRelevantMessage(playerTwoSocket);
    playerOneSocket.send(JSON.stringify({ type: 'set_ready', ready: true }));
    const [oneReady, twoReady] = await Promise.all([oneReadyPromise, twoReadyPromise]);
    expect(oneReady.type).toBe('lobby_updated');
    expect(twoReady.type).toBe('lobby_updated');

    const secondReadyPromise = nextRelevantMessage(playerOneSocket);
    const secondReadyOtherPromise = nextRelevantMessage(playerTwoSocket);
    playerTwoSocket.send(JSON.stringify({ type: 'set_ready', ready: true }));
    const [secondReady, secondReadyOther] = await Promise.all([
      secondReadyPromise,
      secondReadyOtherPromise,
    ]);
    expect(secondReady.type).toBe('lobby_updated');
    expect(secondReadyOther.type).toBe('lobby_updated');

    const queuedPromise = nextRelevantMessage(playerOneSocket);
    playerOneSocket.send(JSON.stringify({ type: 'join_queue' }));
    const queuedUpdate = await queuedPromise;
    expect(queuedUpdate.type).toBe('queued');

    const matchPromiseOne = nextRelevantMessage(playerOneSocket);
    const matchPromiseTwo = nextRelevantMessage(playerTwoSocket);
    playerTwoSocket.send(JSON.stringify({ type: 'join_queue' }));
    const [matchOne, matchTwo] = await Promise.all([matchPromiseOne, matchPromiseTwo]);

    expect(matchOne.type).toBe('game_room_found');
    expect(matchTwo.type).toBe('game_room_found');
    expect(matchOne.room.status).toBe('game');
    expect(matchOne.room.players).toHaveLength(2);
    expect(connectedOne.playerId).toBeTruthy();
    expect(secondConnected.playerId).toBeTruthy();
    playerOneSocket.close();
    playerTwoSocket.close();
  });
});