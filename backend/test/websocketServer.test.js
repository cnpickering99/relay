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
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
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
    const playerOne = await connect(url);
    const connectedOne = await nextMessage(playerOne);
    playerOne.send(JSON.stringify({ type: 'create_room', name: 'One' }));
    const created = await nextMessage(playerOne);

    const playerTwo = await connect(url);
    await nextMessage(playerTwo);
    playerTwo.send(JSON.stringify({ type: 'join_room', roomId: created.roomId, name: 'Two' }));
    const joined = await nextMessage(playerTwo);
    expect(joined.type).toBe('room_joined');

    playerOne.send(JSON.stringify({ type: 'choose_mode', mode: 'classic' }));
    expect((await nextMessage(playerOne)).type).toBe('lobby_updated');
    expect((await nextMessage(playerTwo)).type).toBe('lobby_updated');

    playerTwo.send(JSON.stringify({ type: 'choose_mode', mode: 'classic' }));
    await nextMessage(playerOne);
    await nextMessage(playerTwo);
    playerOne.send(JSON.stringify({ type: 'set_ready', ready: true }));
    await nextMessage(playerOne);
    await nextMessage(playerTwo);
    playerTwo.send(JSON.stringify({ type: 'set_ready', ready: true }));
    await nextMessage(playerOne);
    await nextMessage(playerTwo);

    playerOne.send(JSON.stringify({ type: 'join_queue' }));
    expect((await nextMessage(playerOne)).type).toBe('queued');
    playerTwo.send(JSON.stringify({ type: 'join_queue' }));
    const matchOne = await nextMessage(playerOne);
    const matchTwo = await nextMessage(playerTwo);

    expect(matchOne.type).toBe('game_room_found');
    expect(matchTwo.type).toBe('game_room_found');
    expect(matchOne.room.status).toBe('game');
    expect(matchOne.room.players).toHaveLength(2);
    expect(connectedOne.playerId).toBeTruthy();
    playerOne.close();
    playerTwo.close();
  });
});