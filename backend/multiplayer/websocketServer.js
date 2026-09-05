const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const RoomManager = require('./roomManager');

function send(socket, type, payload = {}) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ type, ...payload }));
  }
}

function roomState(room) {
  return {
    roomId: room.id,
    mode: room.mode || null,
    status: room.status,
    players: [...room.players.values()],
  };
}

function createWebSocketServer(server) {
  const rooms = new RoomManager();
  const sockets = new Map();
  const websocketServer = new WebSocketServer({ server, path: '/multiplayer' });

  websocketServer.on('connection', socket => {
    const player = { id: crypto.randomUUID(), name: 'Player' };
    let roomId = null;
    sockets.set(socket, { roomId: null, playerId: player.id });

    send(socket, 'connected', { playerId: player.id });

    socket.on('message', rawMessage => {
      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch {
        send(socket, 'error', { message: 'message must be valid JSON' });
        return;
      }

      try {
        if (message.type === 'create_room') {
          const room = rooms.createRoom();
          roomId = room.id;
          player.name = message.name || player.name;
          rooms.joinRoom(roomId, player);
          sockets.get(socket).roomId = roomId;
          send(socket, 'room_created', { roomId, playerId: player.id, room: roomState(rooms.getRoom(roomId)) });
          return;
        }

        if (message.type === 'join_room') {
          player.name = message.name || player.name;
          roomId = String(message.roomId || '').toUpperCase();
          const room = rooms.joinRoom(roomId, player);
          sockets.get(socket).roomId = roomId;
          send(socket, 'room_joined', {
            roomId: room.id,
            playerId: player.id,
            playerCount: room.players.size,
            status: room.status,
            room: roomState(room),
          });
          return;
        }

        if (message.type === 'choose_mode') {
          const room = rooms.setPlayerMode(roomId, player.id, message.mode);
          send(socket, 'lobby_updated', { room: roomState(room) });
          return;
        }

        if (message.type === 'set_ready') {
          const room = rooms.setPlayerReady(roomId, player.id, message.ready !== false);
          send(socket, 'lobby_updated', { room: roomState(room) });
          return;
        }

        if (message.type === 'join_queue') {
          const match = rooms.joinQueue(roomId, player.id);
          if (!match) {
            send(socket, 'queued', { room: roomState(rooms.getRoom(roomId)) });
            return;
          }

          for (const [client, clientState] of sockets) {
            if (match.players.has(clientState.playerId)) {
              send(client, 'game_room_found', { room: roomState(match) });
            }
          }
          return;
        }

        send(socket, 'error', { message: 'unsupported message type' });
      } catch (error) {
        send(socket, 'error', { message: error.message });
      }
    });

    socket.on('close', () => {
      if (roomId) rooms.removePlayer(roomId, player.id);
      sockets.delete(socket);
    });
  });

  return websocketServer;
}

module.exports = createWebSocketServer;
