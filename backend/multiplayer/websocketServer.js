const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const crypto = require('crypto');
const LobbyManager = require('./lobbyManager');
const { GameStatus } = require('./enums');
const RoomManager = require('./roomManager');
const GameManager = require('./gameManager');
const usersService = require('./../service/usersService');
const { createDictionaryService } = require('./../service/dictionaryService');

const MULTIPLAYER_PATH = '/multiplayer';
const CHAT_HISTORY_LIMIT = 50;
const CHAT_MAX_LENGTH = 500;

function playerCount(room) {
  return room.players.length;
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

/**
 * @param {import('http').Server} server
 * @param {Object} [options]
 * @param {Object} [options.dictionary] word checker (isRealWord / isChainable); defaults to Datamuse
 * @param {number} [options.gameDurationMs] length of a game; defaults to 2:00
 */
function createWebSocketServer(server, options = {}) {
  const rooms = new LobbyManager();
  const games = new GameManager({
    dictionary: options.dictionary ?? createDictionaryService(),
    durationMs: options.gameDurationMs,
  });
  const sockets = new Map();
  // roomId -> last CHAT_HISTORY_LIMIT messages. In memory only; dropped with the room.
  const chatByRoom = new Map();
  const dropChatIfRoomGone = id => {
    if (id && !rooms.getRoom(id)) chatByRoom.delete(id);
  };
  // roomId -> timeout that ends the game when the clock runs out.
  const gameTimers = new Map();
  const clearGameTimer = id => {
    clearTimeout(gameTimers.get(id));
    gameTimers.delete(id);
  };

  const finishGame = id => {
    clearGameTimer(id);
    const room = rooms.getRoom(id);
    if (!room || !games.isActive(room)) return;

    const outcome = games.end(room);
    broadcastRoom(sockets, room.id, 'game_ended', outcome);
    broadcastRoom(sockets, room.id, 'room_updated', { room: new RoomManager(room).getRoomState() });
    broadcastRoomList(sockets);
  };

  const startGame = room => {
    const snapshot = games.start(room);
    const timer = setTimeout(() => finishGame(room.id), Math.max(0, snapshot.endsAt - games.now()));
    timer.unref?.();
    gameTimers.set(room.id, timer);

    broadcastRoom(sockets, room.id, 'game_started', {
      room: new RoomManager(room).getRoomState(),
      game: snapshot,
      scoreboard: games.scoreboard(room),
    });
    broadcastRoomList(sockets);
  };

  // A player left, was kicked, or disconnected: drop them from a running
  // game and end it if it can't go on.
  const afterPlayerRemoved = (id, playerId) => {
    const room = rooms.getRoom(id);
    if (!room) {
      clearGameTimer(id);
      return;
    }
    if (!games.isActive(room)) return;

    games.removePlayer(room, playerId);
    if (games.shouldEnd(room)) {
      finishGame(room.id);
    } else {
      broadcastRoom(sockets, room.id, 'game_progress', { scoreboard: games.scoreboard(room) });
    }
  };

  // noServer: auth happens on the raw HTTP upgrade below, before a
  // WebSocket connection is ever established — see server.on('upgrade').
  const websocketServer = new WebSocketServer({ noServer: true });

  sockets.getRoomList = () => rooms.rooms;

  server.on('upgrade', async (request, socket, head) => {
    const { pathname, searchParams } = new URL(request.url, 'http://localhost');

    if (pathname !== MULTIPLAYER_PATH) {
      socket.destroy();
      return;
    }

    const email = searchParams.get('email');
    const token = searchParams.get('token');

    let user;
    try {
      if (!email || !token) {
        throw new Error('Missing credentials');
      }
      user = await usersService.validateAuthToken(email, token);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, ws => {
      websocketServer.emit('connection', ws, request, user);
    });
  });

  websocketServer.on('connection', (socket, request, user) => {
    const player = { id: crypto.randomUUID(), name: user.username || user.email, email: user.email };
    let roomId = null;
    sockets.set(socket, { roomId: null, playerId: player.id });

    send(socket, 'connected', { playerId: player.id, email: player.email });

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
          chatByRoom.delete(roomId);
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
          chatByRoom.delete(deletedRoom.id);
          clearGameTimer(deletedRoom.id);
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
          broadcastRoom(
            sockets,
            room.id,
            'room_updated',
            { room: new RoomManager(room).getRoomState() },
            socket,
          );
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
          dropChatIfRoomGone(leavingRoomId);

          if (updatedRoom?.playerCount > 0) {
            broadcastRoom(sockets, leavingRoomId, 'room_updated', { room: updatedRoom });
          }
          broadcastRoomList(sockets);
          afterPlayerRemoved(leavingRoomId, player.id);
          return;
        }

        if (message.type === 'chat') {
          const clientState = sockets.get(socket);
          if (!clientState?.roomId) {
            throw new Error('player is not in a room');
          }

          const text = typeof message.text === 'string' ? message.text.trim() : '';
          if (!text) throw new Error('message cannot be empty');
          if (text.length > CHAT_MAX_LENGTH) {
            throw new Error(`message is too long (max ${CHAT_MAX_LENGTH} characters)`);
          }

          const chatMessage = {
            id: crypto.randomUUID(),
            playerId: player.id,
            name: player.name,
            text,
            sentAt: Date.now(),
          };
          const history = chatByRoom.get(clientState.roomId) ?? [];
          history.push(chatMessage);
          if (history.length > CHAT_HISTORY_LIMIT) history.shift();
          chatByRoom.set(clientState.roomId, history);

          broadcastRoom(sockets, clientState.roomId, 'chat_message', { message: chatMessage });
          return;
        }

        if (message.type === 'get_chat') {
          const clientState = sockets.get(socket);
          if (!clientState?.roomId) {
            throw new Error('player is not in a room');
          }

          send(socket, 'chat_history', { messages: chatByRoom.get(clientState.roomId) ?? [] });
          return;
        }

        if (message.type === 'submit_word') {
          const clientState = sockets.get(socket);
          if (!clientState?.roomId) {
            throw new Error('player is not in a room');
          }

          const room = rooms.findRoom(clientState.roomId);
          games.submitWord(room, player.id, message.word)
            .then(result => {
              if (result.type === 'rejected') {
                send(socket, 'word_rejected', { reason: result.reason, message: result.message });
                return;
              }

              if (result.type === 'accepted') {
                const { type, ...accepted } = result;
                send(socket, 'word_accepted', accepted);
              } else {
                const { type, ...finished } = result;
                send(socket, 'player_finished', finished);
              }

              if (!games.isActive(room)) return;
              broadcastRoom(sockets, room.id, 'game_progress', { scoreboard: games.scoreboard(room) });
              if (games.shouldEnd(room)) finishGame(room.id);
            })
            .catch(error => send(socket, 'error', { message: error.message }));
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
          if (room.status !== GameStatus.LOBBY) throw new Error('a game is already in progress');
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
          if (games.canStart(room)) startGame(room);
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
          afterPlayerRemoved(room.id, message.targetPlayerId);
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
      dropChatIfRoomGone(closedRoomId);

      if (updatedRoom) {
        if (updatedRoom.playerCount > 0) {
          broadcastRoom(sockets, closedRoomId, 'room_updated', { room: updatedRoom });
        }
        broadcastRoomList(sockets);
      }
      if (closedRoomId) afterPlayerRemoved(closedRoomId, player.id);
    });
  });

  return websocketServer;
}

module.exports = createWebSocketServer;
