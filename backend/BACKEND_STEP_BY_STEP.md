# Backend Step-by-Step: Room Manager

Status snapshot based on a read of `backend/multiplayer/lobbyManager.js`,
`backend/multiplayer/roomManager.js`, `backend/multiplayer/websocketServer.js`,
`backend/multiplayer/enums.js`, and every file in `backend/test/`. Last
verified against the actual test run on 2026-10-08 (see Step 9).

## Step 1: Separate Room Manager — **Done**

- `lobbyManager.js` owns lobby lifecycle (create/find/join/delete room, ban
  tracking, socket-level `removePlayer`). `roomManager.js` owns in-room
  operations (leave, ready, player list, owner management) and lives in
  `backend/multiplayer/`.
- `LobbyManager.removePlayer` does **not** duplicate removal logic — it
  delegates to `new RoomManager(room).leaveRoom(playerId)` and only adds the
  lobby-level concern (deleting the room when it empties out). There is a
  single source of truth for "remove a player from a room."

## Step 2: Normalize Room State — **Partially done (one known bug, not yet fixed)**

What's working:
- `RoomManager` accepts the lobby's room, defaults `code` from `id`, defaults
  `type_of_game` to `1`, normalizes every player into
  `{ player: { id, name }, status, score }` with `not_ready`/`0` defaults, and
  `getRoomState()` / `getPlayerList()` return plain objects/arrays that don't
  leak internal references (verified by the "isolates public player views"
  and "safe player list" tests).

The bug (still present, unfixed):
- The constructor does `this.room = room` (same object reference from the
  lobby, not a copy), then does `this.room.players = players.map(normalizePlayer)`.
  That line **permanently mutates the lobby's stored room**, converting
  `room.players` from a `Map` into a plain array the first time *any*
  `RoomManager` is constructed for that room (every `get_room`, `set_ready`,
  `get_players`, and `manage_player` call does this).
- `LobbyManager.joinRoom` branches on `room.players instanceof Map` to decide
  how to add a player, and `websocketServer.js`'s `playerCount()` /
  `listRoomsState()` also branch on `instanceof Map`. Today these branches
  happen to produce a working array-path too, so nothing currently crashes —
  but the room's "shape" silently flips the first time it's touched by a
  room-manager call, which is fragile: any other code added later that
  assumes `room.players` is always a `Map` (or always an array) will break
  depending on call order.
- Fix direction: have `RoomManager` normalize into a **local copy**
  (`this.room = { ...room, players: normalizedArray }`) rather than mutating
  the lobby's room in place, or have `LobbyManager` store players as an
  array from the start so there's one representation everywhere.
- No regression test exists yet proving a second `RoomManager` construction
  on the same lobby-held room is safe — see Step 9.

## Step 3: Leave a Room — **Done**

- `requirePlayer` confirms membership before removal.
- `leaveRoom` filters the player out of `players` (status/score go with the
  entry, so nothing is left behind).
- Ownership transfers to `players[0]` when the owner leaves (and clears to
  `undefined` when the room empties). Because `players` preserves join order,
  `players[0]` is always whichever remaining player joined earliest.
- Returns the updated public room state.
- Does **not** gate on `room.status` — leaving works the same whether the
  room is in the lobby or mid-game (see Step 10).
- Covered by tests: ownership transfer (2-player and 3-player cases),
  non-owner leave, last-player leave, leaving as a non-member (throws), and
  leaving while `status` is `in_game`.

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

## Step 7: Owner-Only Player Management — **Done (kick + ban, as scoped)**

- `managePlayer` verifies `ownerId === room.ownerId`, rejects non-owners,
  rejects the owner targeting themselves, and supports `'kick'` and `'ban'`
  (anything else throws `'unsupported player management action'`).
- Both actions remove the full player entry (status + score go with it) from
  the current room. `ban` additionally persists a permanent cross-room block
  — see Step 11.
- No other owner actions are implemented. Per the plan, only add a new one
  once its behavior/permissions are defined (that's exactly how `ban` was
  scoped before being built).

## Step 8: WebSocket Integration — **Done for the listed message types**

`backend/multiplayer/websocketServer.js` wires up all five original message
types, plus `create_room`, `join_room`, `delete_room`, `list_rooms`, and
`search_room`:
- `leave_room` → `LobbyManager.removePlayer` → broadcasts `room_updated` to
  the room (if non-empty) and `rooms_list` to everyone. The socket `close`
  handler runs the identical cleanup for an ungraceful disconnect.
- `set_ready` → `RoomManager.setReady` → replies `ready_status` to the
  sender, broadcasts `room_updated` to the rest of the room.
- `get_room` → `RoomManager.getRoomState` → replies `room_state`.
- `get_players` → `RoomManager.getPlayerList` → replies `players_list`.
- `manage_player` (`kick` or `ban`) → `RoomManager.managePlayer` → notifies
  the removed client (`player_kicked` or `player_banned`), broadcasts
  `room_updated` to the rest of the room, replies `player_managed` to the
  owner, and refreshes `rooms_list`. For `ban`, also calls
  `LobbyManager.banPlayer` to persist the permanent block.

Caveat: because every one of these handlers constructs a fresh `new
RoomManager(room)`, each call re-triggers the Step 2 mutation bug — worth
fixing before relying on this integration long-term, even though current
behavior is correct.

Known gap: `list_rooms` / `rooms_list` reports `owner: room.ownerId` — fixed
(previously read the nonexistent `room.owner` and always sent `undefined`).

## Step 9: Tests — **Done for everything currently in scope**

Full suite result (`npx jest --forceExit`, verified stable across repeated
runs on 2026-10-08): **4 of 6 suites pass, 51/51 tests passing** in
`roomManager.test.js`, `gameStatus.test.js`, `websocketServer.test.js`, and
`dictionaryService.test.js`. The other 2 suites (`users.test.js`,
`usersService.test.js`, 46 tests) fail only because there's no reachable
Postgres instance in this environment (`beforeAll` does `pool.query('SELECT
1;')` as a connectivity check) — unrelated to the multiplayer/room-manager
code and pre-existing.

Coverage that exists today:
- `roomManager.test.js` — field defaults, player normalization (including
  legacy `{ id, ready, score }` shapes from a `Map`), room-code/public-state
  views + copy-safety, leave + ownership transfer (2- and 3-player), ready/
  not-ready transitions (including unknown player), player list contents +
  copy-safety, owner-only kick (non-owner rejected, self-kick rejected,
  unsupported action rejected, unknown target rejected, status/score
  removed), owner-only ban (same checks), leaving while `status: in_game`.
- `gameStatus.test.js` — `GameStatus` enum shape/frozen-ness, lobby
  creation/capacity/one-room-per-owner, `LobbyManager.removePlayer`
  delegation + later rejoin after normalization, ban blocks rejoin in the
  same room, ban blocks joining a brand-new room from the same owner after
  the first is deleted, ban does **not** block a different owner's room.
- `websocketServer.test.js` — full round-trip coverage for `create_room`,
  `join_room` (direct and via list), `delete_room`, `list_rooms`,
  `search_room`, `set_ready` (including broadcast to other members and
  invalid-value/outside-room rejection), `get_room`, `get_players`,
  `leave_room` (ownership transfer, empty-room cleanup, outside-room
  rejection), disconnect cleanup (socket `close` without `leave_room`),
  `manage_player` kick (owner-only, no self-kick, unsupported action,
  unknown target, status/score removal, broadcast to the room) and ban
  (removal + broadcast + blocks rejoin in that room and in a new room from
  the same owner), one-room-per-owner and one-room-per-player limits, and
  room-capacity rejection.

Fixed while verifying this step: a flaky test in `websocketServer.test.js`
(`bans a player...`) attached a listener with `nextMessage` instead of
`nextRelevantMessage` right after a `join_room` call, so it would
occasionally catch the join's own `rooms_list` broadcast instead of the
intended `player_banned` event. Switched to `nextRelevantMessage`, matching
the pattern already used elsewhere in the same file for this exact race.
Confirmed stable across 3 repeated full-suite runs afterward.

Still missing:
- No regression test proving a second `RoomManager` construction on the same
  lobby-held room doesn't corrupt it (the Step 2 bug). Can't fully land this
  until Step 2 is actually fixed, since today's behavior *is* the bug.
- No `unban` action/tests (not implemented — see Step 11).

## Step 10: Leaving Functionality — **Done**

Scope as defined: leaving should work the same whether the player is in the
lobby or mid-game, and when the owner leaves, ownership should transfer to
whichever remaining player joined earliest.

- No production code changes were needed: `RoomManager.leaveRoom` never
  gated on `room.status`, and ownership transfer already used `players[0]`,
  which is the earliest-joined remaining player because `players` preserves
  `Map` insertion order.
- Added `GameStatus.IN_GAME` to `multiplayer/enums.js` so an in-progress game
  is actually representable (previously only `LOBBY` existed).
- Added tests making both guarantees explicit: leaving while
  `status: 'in_game'` behaves identically to leaving in the lobby, and with
  3 players, ownership goes to the earliest-joined remaining player (not
  just the 2-player case already covered).

## Step 11: Banning a Player — **Done (no unban yet)**

Scope as defined: banning removes the player from the current room (like
`kick`) **and** permanently blocks that player id from joining any room
created by that same owner, present or future.

- `RoomManager.managePlayer` accepts `'ban'` alongside `'kick'` — same
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
- Ban scope is tied to the *owner who issued it*, not to a specific room: if
  ownership of a room transfers to someone else, bans from the previous
  owner stop applying to that room but still apply everywhere that original
  owner creates new rooms.
- Tested in `roomManager.test.js` (owner-only, no self-ban, removes
  status/score), `gameStatus.test.js` (ban blocks rejoin in the same room,
  blocks joining a brand-new room from the same owner after the first is
  deleted, and does *not* block joining a different owner's room), and
  `websocketServer.test.js` (end-to-end: `player_banned` event delivery,
  rejoin rejected, rejoin rejected in a second room from the same owner).

Not implemented: an `unban` action — there is currently no way to reverse a
ban.

## Step 12: Email-Based Login — **Not started**

Scope as given: a player enters their email to create an account or log into
an existing one. The server emails them a verification code, which they
enter into the game to complete login. Not yet designed or implemented.
Open questions to settle before building:
- Where account state lives — there's an existing `backend/data`/`sql`/
  `service`/`controller`/`routes` layer with a users table (`users.test.js`,
  `usersService.test.js`) separate from the in-memory `multiplayer/` room
  state; this almost certainly extends that, not the room manager.
- Verification code: generation, expiry, one-time use, retry/resend limits,
  rate limiting on both "send code" and "submit code" to prevent abuse.
- Email delivery mechanism (which provider/service) and what happens if
  sending fails.
- How a verified login maps to the existing multiplayer flow — does the
  WebSocket `player.id` (currently a random UUID assigned per connection)
  become tied to an authenticated account id, and if so at what point in the
  connection/create_room/join_room flow.
- Session/token handling after verification (how "logged in" is represented
  and carried on subsequent requests/connections).

Not implemented yet — behavior needs to be defined first, same as `ban` was
scoped before Step 11 was built.

## What's next

1. Fix the Step 2 mutation bug (copy-on-normalize in `RoomManager`, or
   standardize `LobbyManager` to store players as an array from creation),
   then add the regression test that proves it.
2. Define exact scope for Step 12 (email-based login) and start
   implementation — likely the biggest remaining chunk of work.
3. Decide whether an `unban` action is needed for Step 11.
4. Get `users.test.js` / `usersService.test.js` runnable in this environment
   (a reachable Postgres instance, or a test-env fallback) so the full suite
   can be verified end-to-end rather than just the 4 non-DB suites.
