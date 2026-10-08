# Backend Step-by-Step: Room Manager

Status snapshot based on a read of `backend/multiplayer/lobbyManager.js`,
`backend/multiplayer/roomManager.js`, `backend/multiplayer/websocketServer.js`,
and `backend/test/roomManager.test.js`.

## Step 1: Separate Room Manager — **Done**

- `lobbyManager.js` owns lobby lifecycle (create/find/join/delete room, socket-level
  `removePlayer`). `roomManager.js` owns in-room operations (leave, ready, player
  list, owner management) and lives in `backend/multiplayer/`.
- `LobbyManager.removePlayer` does **not** duplicate removal logic — it delegates
  to `new RoomManager(room).leaveRoom(playerId)` and only adds the lobby-level
  concern (deleting the room when it empties out). There is a single source of
  truth for "remove a player from a room."

## Step 2: Normalize Room State — **Partially done (one real bug)**

What's working:
- `RoomManager` accepts the lobby's room, defaults `code` from `id`, defaults
  `type_of_game` to `1`, normalizes every player into
  `{ player: { id, name }, status, score }` with `not_ready`/`0` defaults, and
  `getRoomState()` / `getPlayerList()` return plain objects/arrays that don't leak
  internal references (verified by the "isolates public player views" and
  "safe player list" tests).

The bug:
- The constructor does `this.room = room` (same object reference from the lobby,
  not a copy), then does `this.room.players = players.map(normalizePlayer)`.
  That line **permanently mutates the lobby's stored room**, converting
  `room.players` from a `Map` into a plain array the first time *any*
  `RoomManager` is constructed for that room (every `get_room`, `set_ready`,
  `get_players`, and `manage_player` call does this).
- `LobbyManager.joinRoom` branches on `room.players instanceof Map` to decide how
  to add a player, and `websocketServer.js`'s `playerCount()` / `listRoomsState()`
  also branch on `instanceof Map`. Today these branches happen to produce a
  working array-path too, so nothing currently crashes — but the room's
  "shape" silently flips the first time it's touched by a room-manager call,
  which is fragile: any other code added later that assumes `room.players` is
  always a `Map` (or always an array) will break depending on call order.
- Fix direction: have `RoomManager` normalize into a **local copy**
  (`this.room = { ...room, players: normalizedArray }`) rather than mutating the
  lobby's room in place, or have `LobbyManager` store players as an array from
  the start so there's one representation everywhere.

## Step 3: Leave a Room — **Done**

- `requirePlayer` confirms membership before removal.
- `leaveRoom` filters the player out of `players` (status/score go with the
  entry, so nothing is left behind).
- Ownership transfers to `players[0]` when the owner leaves (and clears to
  `undefined` when the room empties).
- Returns the updated public room state.
- Covered by tests: ownership transfer, non-owner leave, last-player leave,
  and leaving as a non-member (throws).

## Step 4: Ready Status — **Done**

- `requirePlayer` confirms membership.
- `setReady` sets `ready` → `'ready'` / `'not_ready'`.
- Returns `{ playerId, status }`.
- Covered by tests: ready → not_ready transitions, and setting ready for an
  unknown player (throws).

## Step 5: Room and Code Views — **Done**

- `getRoomCode()` returns the code.
- `getRoomState()` returns code, name, ownerId, players, status, playerCount,
  maxPlayers, type_of_game — no internal `Map`/implementation details.

## Step 6: Player List View — **Done**

- `getPlayerList()` returns an array of `{ player: { id, name }, status, score,
  isOwner }`.
- Confirmed copy-safe: mutating the returned array/objects does not affect
  `manager.room.players` (tested).

## Step 7: Owner-Only Player Management — **Done (kick only, as scoped)**

- `managePlayer` verifies `ownerId === room.ownerId`, rejects non-owners,
  rejects the owner targeting themselves, and only supports `'kick'`
  (anything else throws `'unsupported player management action'`).
- Kicking removes the full player entry (status + score go with it).
- No other owner actions are implemented yet — per the plan, add them only
  once their behavior/permissions are defined.

## Step 8: WebSocket Integration — **Done for the listed message types**

`backend/multiplayer/websocketServer.js` already wires up all five:
- `leave_room` → `LobbyManager.removePlayer` → broadcasts `room_updated` to the
  room (if non-empty) and `rooms_list` to everyone.
- `set_ready` → `RoomManager.setReady` → replies `ready_status` to the sender,
  broadcasts `room_updated` to the rest of the room.
- `get_room` → `RoomManager.getRoomState` → replies `room_state`.
- `get_players` → `RoomManager.getPlayerList` → replies `players_list`.
- `manage_player` (kick) → `RoomManager.managePlayer` → notifies the kicked
  client (`player_kicked`), broadcasts `room_updated` to the rest of the room,
  replies `player_managed` to the owner, and refreshes `rooms_list`.

Caveat: because every one of these handlers constructs a fresh `new
RoomManager(room)`, each call re-triggers the Step 2 mutation bug — worth
fixing before relying on this integration long-term, even though current
behavior is correct.

## Step 9: Tests — **Partially done**

Present and passing in `backend/test/roomManager.test.js`:
- Field defaults + player normalization (including normalizing legacy
  `{ id, ready, score }`-shaped entries from a `Map`).
- Room-code and public room-state views, including copy-safety.
- Leaving a room + ownership transfer (owner leaves, non-owner leaves, last
  player leaves).
- Ready / not-ready transitions, including an unknown player.
- Player list contents + copy-safety.
- Owner-only management: non-owner rejected, self-kick rejected, unsupported
  action rejected, unknown target rejected, successful kick removes status and
  score.

Missing / not yet covered:
- No tests directly exercise the `RoomManager.players` Map-vs-array mutation
  bug from Step 2 (i.e. a regression test proving a second `RoomManager`
  construction on the same lobby room doesn't corrupt it).
- No WebSocket-level tests for `leave_room`, `set_ready`, `get_room`,
  `get_players`, `manage_player` (only the room-manager unit tests exist;
  `backend/test/gameStatus.test.js` covers `LobbyManager.removePlayer` but not
  the socket layer itself).
- Per the plan's instruction ("run the room manager tests before integrating
  WebSocket behavior, then run the full backend suite"), the full backend
  suite hasn't been re-run/confirmed green since the WebSocket integration
  landed.

## Step 10: Leaving Functionality — **Not started**

Scope not yet defined. Flagged for follow-up; define exact behavior before
implementing (e.g. does this cover anything beyond the existing `leaveRoom`/
`leave_room` path — rejoin behavior, leave during an active game vs. lobby,
etc.).

## Step 11: Banning a Player — **Done (no unban yet)**

Scope as defined: banning removes the player from the current room (like
`kick`) **and** permanently blocks that player id from joining any room
created by that same owner, present or future.

- `RoomManager.managePlayer` now accepts `'ban'` alongside `'kick'` — same
  owner-only / no-self-target checks, same removal from the current room.
- `LobbyManager` owns the permanent part, since bans must survive beyond any
  single room's lifetime: `bansByOwner` (`Map<ownerId, Set<playerId>>`),
  with `banPlayer(ownerId, playerId)` and `isBannedByOwner(ownerId,
  playerId)`. `joinRoom` checks `isBannedByOwner(room.ownerId, player.id)`
  before admitting anyone, so it's enforced on the current room and on every
  future room that same owner creates.
- `websocketServer.js`'s `manage_player` handler calls `RoomManager` to do
  the removal, then (only for `action === 'ban'`) calls
  `rooms.banPlayer(ownerId, targetPlayerId)` to persist it. The removed
  client gets `player_banned` instead of `player_kicked` so the client can
  distinguish the two.
- Ban scope is tied to the *owner who issued it*, not to a specific room:
  if ownership of a room transfers to someone else, bans from the previous
  owner stop applying to that room but still apply everywhere that original
  owner creates new rooms.
- Tested in `test/roomManager.test.js` (owner-only, no self-ban, removes
  status/score) and `test/gameStatus.test.js` (ban blocks rejoin in the same
  room, blocks joining a brand-new room from the same owner after the first
  is deleted, and does *not* block joining a different owner's room).

Not implemented: an `unban` action — there is currently no way to reverse a
ban.

## What's next

1. Fix the Step 2 mutation bug (copy-on-normalize in `RoomManager`, or
   standardize `LobbyManager` to store players as an array from creation).
2. Add the regression test for that bug.
3. Add WebSocket-layer tests for the five message types.
4. Run the full backend test suite and confirm green.
5. Define and implement Step 10 (leaving functionality).
6. Define and implement Step 11 (ban a player).
