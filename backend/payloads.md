# Multiplayer WebSocket Payloads

Connect to `ws://{{host}}:{{port}}/multiplayer` and send/receive JSON text
frames. Every client message needs a `type` field; every server message has a
`type` field plus a payload. On error the server always replies
`{ "type": "error", "message": "<reason>" }` instead of closing the socket.

On connect, the server immediately sends:

```json
{ "type": "connected", "playerId": "<uuid>" }
```

Keep that `playerId` — it identifies this socket as a player for the rest of
the session (used for ownership checks, kick targets, etc.).

---

## list_rooms

List every open room.

**Send**
```json
{ "type": "list_rooms" }
```

**Receive** — `rooms_list`
```json
{
  "type": "rooms_list",
  "rooms": [
    {
      "roomId": "TEST01",
      "name": "Test Lobby",
      "status": "lobby",
      "playerCount": 1,
      "maxPlayers": 4,
      "owner": "<uuid-of-room-owner>"
    }
  ]
}
```

---

## search_room

Look up a room by id/code without joining it.

**Send**
```json
{ "type": "search_room", "roomId": "TEST01" }
```
(`code` also works as the field name.)

**Receive** — `room_found`
```json
{
  "type": "room_found",
  "room": {
    "roomId": "TEST01",
    "name": "Test Lobby",
    "status": "lobby",
    "playerCount": 1,
    "maxPlayers": 4
  }
}
```

**Errors:** `room not found`

---

## create_room

Create a room and join it as the owner in one step.

**Send**
```json
{
  "type": "create_room",
  "playerName": "Player One",
  "owner": "Player One",
  "roomName": "Test Lobby",
  "maxPlayers": 4,
  "code": "TEST01"
}
```
- `owner` / `playerName` / `name` are all accepted for the creator's display
  name (first one present wins); all optional, default to `"Player"`.
- `roomName` optional, defaults to the player name, then `"Lobby"`.
- `maxPlayers` optional, defaults to `4`, must be an integer 2–12.
- `code` optional; if omitted a random 6-character code is generated. If
  provided it must be 3–12 letters/numbers and not already in use.

**Receive** — `room_created` (to creator), then `rooms_list` broadcast to
everyone
```json
{
  "type": "room_created",
  "roomId": "TEST01",
  "playerId": "<uuid>",
  "room": {
    "roomId": "TEST01",
    "name": "Test Lobby",
    "status": "lobby",
    "playerCount": 1,
    "maxPlayers": 4
  }
}
```

**Errors:** `player is already in a room`, `player already owns a room`,
`room code must be 3 to 12 letters or numbers`, `room code is already in
use`, `room capacity must be between 2 and 12 players`

---

## join_room

Join an existing room by code.

**Send**
```json
{ "type": "join_room", "roomId": "TEST01", "name": "Player Two" }
```
- `name` optional, keeps whatever name the socket already had otherwise.

**Receive** — `room_joined` (to joiner), then `rooms_list` broadcast to
everyone
```json
{
  "type": "room_joined",
  "roomId": "TEST01",
  "playerId": "<uuid>",
  "playerCount": 2,
  "status": "lobby",
  "room": {
    "roomId": "TEST01",
    "name": "Test Lobby",
    "status": "lobby",
    "playerCount": 2,
    "maxPlayers": 4
  }
}
```

**Errors:** `player is already in a room`, `room not found`, `player is
banned from this room` (banned by this room's owner, see `manage_player`),
`room is no longer accepting players` (status isn't `lobby`), `room is full`

---

## delete_room

Owner-only: delete the whole room.

**Send**
```json
{ "type": "delete_room", "roomId": "TEST01" }
```

**Receive** — `room_deleted` to every socket currently in that room, then
`rooms_list` broadcast to everyone
```json
{ "type": "room_deleted", "roomId": "TEST01" }
```

**Errors:** `room not found`, `only the room owner can delete the room`

---

## get_room

Fetch the current full room state. Requires the sender to already be in a
room.

**Send**
```json
{ "type": "get_room" }
```

**Receive** — `room_state`
```json
{
  "type": "room_state",
  "room": {
    "code": "TEST01",
    "name": "Test Lobby",
    "ownerId": "<uuid>",
    "players": [
      {
        "player": { "id": "<uuid>", "name": "Player One" },
        "status": "not_ready",
        "score": 0,
        "isOwner": true
      }
    ],
    "status": "lobby",
    "playerCount": 1,
    "maxPlayers": 4,
    "type_of_game": 1
  }
}
```

**Errors:** `player is not in a room`

---

## get_players

Fetch just the player list. Requires the sender to already be in a room.

**Send**
```json
{ "type": "get_players" }
```

**Receive** — `players_list`
```json
{
  "type": "players_list",
  "players": [
    {
      "player": { "id": "<uuid>", "name": "Player One" },
      "status": "not_ready",
      "score": 0,
      "isOwner": true
    }
  ]
}
```

**Errors:** `player is not in a room`

---

## set_ready

Toggle the sender's own ready state. Requires the sender to already be in a
room.

**Send**
```json
{ "type": "set_ready", "ready": true }
```
(`ready: false` sets `not_ready`.)

**Receive** — `ready_status` (to sender), then `room_updated` broadcast to
the rest of the room
```json
{ "type": "ready_status", "playerId": "<uuid>", "status": "ready" }
```
```json
{
  "type": "room_updated",
  "room": {
    "code": "TEST01",
    "name": "Test Lobby",
    "ownerId": "<uuid>",
    "players": [ /* ... */ ],
    "status": "lobby",
    "playerCount": 2,
    "maxPlayers": 4,
    "type_of_game": 1
  }
}
```

**Errors:** `ready must be a boolean`, `player is not in a room`

---

## leave_room

Leave the room the sender is currently in. Works whether the room's status
is `lobby` or `in_game`. If the leaver was the owner, ownership transfers to
whichever remaining player joined earliest. If the leaver was the last
player, the room is deleted.

**Send**
```json
{ "type": "leave_room" }
```

**Receive** — `room_left` (to sender), then (if players remain)
`room_updated` broadcast to the rest of the room, then `rooms_list`
broadcast to everyone
```json
{ "type": "room_left", "roomId": "TEST01" }
```
```json
{
  "type": "room_updated",
  "room": {
    "code": "TEST01",
    "name": "Test Lobby",
    "ownerId": "<uuid-of-earliest-remaining-player>",
    "players": [ /* ... */ ],
    "status": "lobby",
    "playerCount": 1,
    "maxPlayers": 4,
    "type_of_game": 1
  }
}
```

**Errors:** `player is not in a room`

Note: disconnecting the socket entirely (closing the connection without
sending `leave_room`) triggers the same cleanup automatically.

---

## manage_player

Owner-only room management. Supports two actions: `kick` and `ban`.

**Send**
```json
{ "type": "manage_player", "targetPlayerId": "<uuid>", "action": "kick" }
```
```json
{ "type": "manage_player", "targetPlayerId": "<uuid>", "action": "ban" }
```

- `kick` removes the player from the room for this session only. They can
  rejoin with the room code immediately afterward.
- `ban` does everything `kick` does, **plus** permanently blocks that player
  id from joining this room again, and from joining *any future room this
  same owner creates* — even after the room is deleted and a new one is
  created by that owner. The ban is keyed to the owner issuing it, not to any
  one room, and is not lifted by anything in the current API (no `unban`
  yet). If ownership of a room later transfers to someone else, bans issued
  by the *previous* owner no longer apply to that room (they still apply to
  rooms the original banning owner creates elsewhere).

**Receive:**
- The removed socket gets `player_kicked` (for `kick`) or `player_banned`
  (for `ban`):
  ```json
  { "type": "player_kicked", "roomId": "TEST01" }
  ```
  ```json
  { "type": "player_banned", "roomId": "TEST01" }
  ```
- Everyone else still in the room gets `room_updated`:
  ```json
  {
    "type": "room_updated",
    "room": {
      "code": "TEST01",
      "name": "Test Lobby",
      "ownerId": "<uuid>",
      "players": [ /* ... */ ],
      "status": "lobby",
      "playerCount": 1,
      "maxPlayers": 4,
      "type_of_game": 1
    }
  }
  ```
- The owner (sender) gets `player_managed` with the same room payload:
  ```json
  { "type": "player_managed", "room": { /* same shape as room_updated.room */ } }
  ```
- Everyone gets a `rooms_list` refresh.

**Errors:** `player is not in a room`, `targetPlayerId is required`, `only
the room owner can manage players`, `room owner cannot be kicked` /
`room owner cannot be banned`, `unsupported player management action`
(anything other than `kick`/`ban`), `player is not in the room` (unknown
`targetPlayerId`)

A banned player attempting to `join_room` (this room, or any future room
created by the same owner) gets: `player is banned from this room`.

**Not yet implemented:** an `unban` action — there's currently no way to
reverse a ban. See `BACKEND_STEP_BY_STEP.md` Step 11.

---

## Error envelope

Any failed request on any message type above returns:
```json
{ "type": "error", "message": "<human-readable reason>" }
```

Unknown `type` values return:
```json
{ "type": "error", "message": "unsupported message type" }
```

Malformed (non-JSON) frames return the same, with
`"message must be valid JSON"`.
