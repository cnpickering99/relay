# Multiplayer server structure

The multiplayer server uses WebSockets at `/multiplayer` on the same HTTP port as the REST API.

## Lobby messages

```json
{ "type": "list_rooms" }
{ "type": "search_room", "roomId": "ABC123" }
{ "type": "delete_room", "roomId": "ABC123" }
{ "type": "create_room", "playerName": "Player 1", "roomName": "Saturday Relay", "maxPlayers": 4, "code": "SAT123" }
{ "type": "join_room", "roomId": "SAT123", "name": "Player 2" }
```

The lobby is the room menu. Players can browse open rooms, search for a room by code, create a room, join an open room, enter a room code directly, or delete a room they own. Room summaries expose `playerCount` rather than player details. Room creation supports a display name, a capacity from 2 to 12 players, and an optional unique alphanumeric code. The server owns generated room codes and enforces room capacity.

## Room operations

Room-operation requests require the connection to have joined a room. Send `{ "type": "get_room" }` for a `room_state` response or `{ "type": "get_players" }` for a `players_list` response. The player list contains identity, readiness status, score, and owner state.

Send `{ "type": "set_ready", "ready": true }` or set `ready` to `false` to update your own status. The caller receives `ready_status`; other room members receive `room_updated`.

Send `{ "type": "leave_room" }` to leave. The caller receives `room_left`; remaining members receive `room_updated`. If the owner leaves, ownership transfers to the first remaining player. Disconnecting performs the same room-state update.

Only the owner may kick another player with `{ "type": "manage_player", "action": "kick", "targetPlayerId": "PLAYER_ID" }`. The owner receives `player_managed`, the target receives `player_kicked`, and remaining members receive `room_updated`. Other actions and self-kicks are rejected.

Rooms are created in `lobby` status. Game-mode selection, matchmaking, word rules, timers, and submissions belong to later game-flow services and are not part of the lobby protocol.
