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
    name: room.name,
    status: room.status,
    playerCount: room.players.size,
    maxPlayers: room.maxPlayers,
  };
}

function listRoomsState(rooms) {
  return [...rooms.values()].map(room => ({
    roomId: room.id,
    name: room.name,
    status: room.status,
    playerCount: room.players.size,
    maxPlayers: room.maxPlayers,
    owner: room.owner
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

function ensurePlayerIsNotInRoom(sockets, socket) {
  if (sockets.get(socket)?.roomId) {
    throw new Error('player is already in a room');
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

        if (message.type === 'search_room') {
          const room = rooms.findRoom(message.roomId || message.code);
          send(socket, 'room_found', { room: roomState(room) });
          return;
        }

        if (message.type === 'create_room') {
          ensurePlayerIsNotInRoom(sockets, socket);
          const playerName = message.owner || message.playerName || message.name || player.name;
          const room = rooms.createRoom({
            name: message.roomName ?? playerName,
            maxPlayers: message.maxPlayers ?? 4,
            code: message.code,
            ownerId: player.id,
          });
          roomId = room.id;
          player.name = playerName;
          rooms.joinRoom(roomId, player);
          sockets.get(socket).roomId = roomId;
          const createdPayload = { roomId, playerId: player.id, room: roomState(rooms.getRoom(roomId)) };
          send(socket, 'room_created', createdPayload);
          broadcastRoomList(sockets);
          return;
        }

        if (message.type === 'delete_room') {
          const deletedRoom = rooms.deleteRoom(message.roomId || message.code, player.id);
          for (const [client, clientState] of sockets) {
            if (clientState.roomId === deletedRoom.id) {
              clientState.roomId = null;
              send(client, 'room_deleted', { roomId: deletedRoom.id });
            }
          }
          broadcastRoomList(sockets);
          return;
        }

        if (message.type === 'join_room') {
          ensurePlayerIsNotInRoom(sockets, socket);
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
