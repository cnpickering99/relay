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

Rooms are created in `lobby` status. Game-mode selection, readiness, matchmaking, word rules, timers, and submissions belong to later game-flow services and are not part of the lobby protocol.
