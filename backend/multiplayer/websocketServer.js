const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const crypto = require('crypto');
const LobbyManager = require('./lobbyManager');
const RoomManager = require('./roomManager');

function playerCount(room) {
  return room.players instanceof Map ? room.players.size : room.players.length;
}

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
    playerCount: playerCount(room),
    maxPlayers: room.maxPlayers,
  };
}

function listRoomsState(rooms) {
  return [...rooms.values()].map(room => ({
    roomId: room.id,
    name: room.name,
    status: room.status,
    playerCount: playerCount(room),
    maxPlayers: room.maxPlayers,
    owner: room.ownerId
  }));
}

function broadcastRoom(sockets, roomId, type, payload, excludedSocket = null) {
  for (const [client, clientState] of sockets) {
    if (client !== excludedSocket && clientState.roomId === roomId) {
      send(client, type, payload);
    }
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
  const rooms = new LobbyManager();
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
            playerCount: playerCount(room),
            status: room.status,
            room: roomState(room),
          });
          broadcastRoomList(sockets);
          return;
        }

        if (message.type === 'leave_room') {
          const clientState = sockets.get(socket);
          if (!clientState?.roomId) {
            throw new Error('player is not in a room');
          }

          const leavingRoomId = clientState.roomId;
          const updatedRoom = rooms.removePlayer(leavingRoomId, player.id);
          clientState.roomId = null;
          roomId = null;
          send(socket, 'room_left', { roomId: leavingRoomId });

          if (updatedRoom?.playerCount > 0) {
            broadcastRoom(sockets, leavingRoomId, 'room_updated', { room: updatedRoom });
          }
          broadcastRoomList(sockets);
          return;
        }

        if (message.type === 'get_room') {
          const clientState = sockets.get(socket);
          if (!clientState?.roomId) {
            throw new Error('player is not in a room');
          }

          const room = rooms.findRoom(clientState.roomId);
          const state = new RoomManager(room).getRoomState();
          send(socket, 'room_state', { room: state });
          return;
        }

        if (message.type === 'set_ready') {
          if (typeof message.ready !== 'boolean') {
            throw new Error('ready must be a boolean');
          }

          const clientState = sockets.get(socket);
          if (!clientState?.roomId) {
            throw new Error('player is not in a room');
          }

          const room = rooms.findRoom(clientState.roomId);
          const roomManager = new RoomManager(room);
          const result = roomManager.setReady(player.id, message.ready);
          send(socket, 'ready_status', result);
          broadcastRoom(
            sockets,
            clientState.roomId,
            'room_updated',
            { room: roomManager.getRoomState() },
            socket,
          );
          return;
        }

        if (message.type === 'get_players') {
          const clientState = sockets.get(socket);
          if (!clientState?.roomId) {
            throw new Error('player is not in a room');
          }

          const room = rooms.findRoom(clientState.roomId);
          const players = new RoomManager(room).getPlayerList();
          send(socket, 'players_list', { players });
          return;
        }

        if (message.type === 'manage_player') {
          const clientState = sockets.get(socket);
          if (!clientState?.roomId) {
            throw new Error('player is not in a room');
          }
          if (typeof message.targetPlayerId !== 'string' || !message.targetPlayerId) {
            throw new Error('targetPlayerId is required');
          }

          const room = rooms.findRoom(clientState.roomId);
          const updatedRoom = new RoomManager(room).managePlayer(
            player.id,
            message.targetPlayerId,
            message.action,
          );

          if (message.action === 'ban') {
            rooms.banPlayer(player.id, message.targetPlayerId);
          }

          const removedEventType = message.action === 'ban' ? 'player_banned' : 'player_kicked';
          for (const [client, state] of sockets) {
            if (state.roomId !== room.id) continue;

            if (state.playerId === message.targetPlayerId) {
              state.roomId = null;
              send(client, removedEventType, { roomId: room.id });
            } else if (client !== socket) {
              send(client, 'room_updated', { room: updatedRoom });
            }
          }

          send(socket, 'player_managed', { room: updatedRoom });
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
      const closedRoomId = state?.roomId;
      const updatedRoom = closedRoomId ? rooms.removePlayer(closedRoomId, player.id) : null;
      if (state) state.roomId = null;
      sockets.delete(socket);

      if (updatedRoom) {
        if (updatedRoom.playerCount > 0) {
          broadcastRoom(sockets, closedRoomId, 'room_updated', { room: updatedRoom });
        }
        broadcastRoomList(sockets);
      }
    });
  });

  return websocketServer;
}

module.exports = createWebSocketServer;
