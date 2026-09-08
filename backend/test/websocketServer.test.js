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

    const oneModePromise = nextMessage(playerOneSocket);
    const twoModePromise = nextMessage(playerTwoSocket);
    playerOneSocket.send(JSON.stringify({ type: 'choose_mode', mode: 'classic' }));
    const [oneModeUpdate, twoModeUpdate] = await Promise.all([oneModePromise, twoModePromise]);
    expect(oneModeUpdate.type).toBe('lobby_updated');
    expect(twoModeUpdate.type).toBe('lobby_updated');

    const secondOneModePromise = nextMessage(playerOneSocket);
    const secondTwoModePromise = nextMessage(playerTwoSocket);
    playerTwoSocket.send(JSON.stringify({ type: 'choose_mode', mode: 'classic' }));
    const [secondOneModeUpdate, secondTwoModeUpdate] = await Promise.all([
      secondOneModePromise,
      secondTwoModePromise,
    ]);
    expect(secondOneModeUpdate.type).toBe('lobby_updated');
    expect(secondTwoModeUpdate.type).toBe('lobby_updated');

    const oneReadyPromise = nextMessage(playerOneSocket);
    const twoReadyPromise = nextMessage(playerTwoSocket);
    playerOneSocket.send(JSON.stringify({ type: 'set_ready', ready: true }));
    const [oneReady, twoReady] = await Promise.all([oneReadyPromise, twoReadyPromise]);
    expect(oneReady.type).toBe('lobby_updated');
    expect(twoReady.type).toBe('lobby_updated');

    const secondReadyPromise = nextMessage(playerOneSocket);
    const secondReadyOtherPromise = nextMessage(playerTwoSocket);
    playerTwoSocket.send(JSON.stringify({ type: 'set_ready', ready: true }));
    const [secondReady, secondReadyOther] = await Promise.all([
      secondReadyPromise,
      secondReadyOtherPromise,
    ]);
    expect(secondReady.type).toBe('lobby_updated');
    expect(secondReadyOther.type).toBe('lobby_updated');

    const queuedPromise = nextMessage(playerOneSocket);
    playerOneSocket.send(JSON.stringify({ type: 'join_queue' }));
    const queuedUpdate = await queuedPromise;
    expect(queuedUpdate.type).toBe('queued');

    const matchPromiseOne = nextMessage(playerOneSocket);
    const matchPromiseTwo = nextMessage(playerTwoSocket);
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