# Multiplayer server structure

The multiplayer server uses WebSockets at `/multiplayer` on the same HTTP port as the REST API.

## Lobby and queue messages

```json
{ "type": "create_room", "name": "Player 1" }
{ "type": "join_room", "roomId": "ABC123", "name": "Player 2" }
{ "type": "choose_mode", "mode": "classic" }
{ "type": "set_ready", "ready": true }
{ "type": "join_queue" }
```

Players first join a lobby, choose a game mode, and mark themselves ready. A ready player then sends `join_queue`. The queue matches players with the same mode and emits `game_room_found` once at least two compatible players are queued. Rooms can contain more than two players.

The lobby accepts players in `lobby` status and changes to `queued` after a player enters matchmaking. The matched room is emitted with `game` status. Word rules, timers, and submissions belong in the game service layer and will be added next.
