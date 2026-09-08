const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const crypto = require('crypto');
const RoomManager = require('./roomManager');

function send(socket, type, payload = {}) {
  if (socket.readyState === WebSocket.OPEN) {
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

function listRoomsState(rooms) {
  return [...rooms.values()].map(room => ({
    roomId: room.id,
    mode: room.mode || null,
    status: room.status,
    players: [...room.players.values()],
    maxPlayers: Math.max(room.players.size, 2),
  }));
}

function broadcastRoom(sockets, roomId, type, payload) {
  for (const [client, clientState] of sockets) {
    if (clientState.roomId === roomId) send(client, type, payload);
  }
}

function broadcastRoomList(sockets) {
  const payload = { rooms: listRoomsState(sockets.getRoomList ? sockets.getRoomList() : new Map()) };
  for (const [client] of sockets) {
    send(client, 'rooms_list', payload);
  }
}

function createWebSocketServer(server) {
  const rooms = new RoomManager();
  const sockets = new Map();
  const websocketServer = new WebSocketServer({ server, path: '/multiplayer' });

  sockets.getRoomList = () => rooms.rooms;

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
        if (message.type === 'list_rooms') {
          send(socket, 'rooms_list', { rooms: listRoomsState(rooms.rooms) });
          return;
        }

        if (message.type === 'create_room') {
          const room = rooms.createRoom();
          roomId = room.id;
          player.name = message.name || player.name;
          rooms.joinRoom(roomId, player);
          sockets.get(socket).roomId = roomId;
          const createdPayload = { roomId, playerId: player.id, room: roomState(rooms.getRoom(roomId)) };
          send(socket, 'room_created', createdPayload);
          broadcastRoomList(sockets);
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
          broadcastRoomList(sockets);
          return;
        }

        if (message.type === 'choose_mode') {
          const room = rooms.setPlayerMode(roomId, player.id, message.mode);
          broadcastRoom(sockets, roomId, 'lobby_updated', { room: roomState(room) });
          return;
        }

        if (message.type === 'set_ready') {
          const room = rooms.setPlayerReady(roomId, player.id, message.ready !== false);
          broadcastRoom(sockets, roomId, 'lobby_updated', { room: roomState(room) });
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
              clientState.roomId = match.id;
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
      const state = sockets.get(socket);
      if (state?.roomId) rooms.removePlayer(state.roomId, player.id);
      sockets.delete(socket);
    });
  });

  return websocketServer;
}

module.exports = createWebSocketServer;
