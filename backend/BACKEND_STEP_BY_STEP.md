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

## Step 2: Normalize Room State — **Done (bug fixed)**

- `RoomManager` accepts the lobby's room, defaults `code` from `id`, defaults
  `type_of_game` to `1`, normalizes every player into
  `{ player: { id, name }, status, score }` with `not_ready`/`0` defaults, and
  `getRoomState()` / `getPlayerList()` return plain objects/arrays that don't
  leak internal references (verified by the "isolates public player views"
  and "safe player list" tests).

The bug (fixed): `LobbyManager.createRoom` used to initialize `players: new
Map()`, but `RoomManager`'s constructor always normalizes `room.players`
into a plain array and writes it back onto the same shared room object
(`this.room = room` — not a copy — so that `setReady`/`leaveRoom`/
`managePlayer` mutations actually persist across separate WebSocket calls).
The first time any `RoomManager` touched a room, this silently flipped
`room.players` from a `Map` to an array, and `LobbyManager.joinRoom` /
`websocketServer.js`'s `playerCount()` both had to carry `instanceof Map`
branches to cope with either shape existing at different points in a room's
life.

Fix applied: `LobbyManager` now creates rooms with `players: []` — a plain
array from the start, the same representation `RoomManager` already
normalizes into. There is now exactly one representation for the lifetime of
a room, so the shape never flips:
- `lobbyManager.js`: `createRoom` initializes `players: []`; `joinRoom`
  dropped its `playersAreMapped` branch and always does array `.push()`.
- `websocketServer.js`: `playerCount(room)` simplified to `room.players.length`
  (dropped its `instanceof Map` branch).
- `RoomManager`'s constructor still accepts either a `Map` or an array as
  input (used directly by some standalone unit-test fixtures), so nothing
  that constructed a `RoomManager` by hand broke.
- Regression test added in `test/gameStatus.test.js`: creates a room through
  the real `LobbyManager`, runs several separate `RoomManager` constructions
  against the same stored room (mirroring `get_room`/`set_ready` each being
  a fresh instance per WebSocket message), and asserts `room.players` stays
  a plain array throughout and a subsequent `joinRoom` still works correctly.

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

Each of these handlers constructs a fresh `new RoomManager(room)` per
message — previously this re-triggered the Step 2 mutation bug on every
call; now that rooms are always arrays, repeated construction is safe (see
Step 2 and Step 9's regression test).

Known gap: `list_rooms` / `rooms_list` reports `owner: room.ownerId` — fixed
(previously read the nonexistent `room.owner` and always sent `undefined`).

## Step 9: Tests — **Done for everything currently in scope**

Full suite result (`npx jest --forceExit`, verified stable across repeated
runs, most recently 2026-10-15): **4 of 6 suites pass, 52/52 tests passing**
in `roomManager.test.js`, `gameStatus.test.js`, `websocketServer.test.js`,
and `dictionaryService.test.js`. The other 2 suites (`users.test.js`,
`usersService.test.js`, 46 tests) fail only because there's no reachable
Postgres instance in this environment (`beforeAll` does `pool.query('SELECT
1;')` as a connectivity check) — unrelated to the multiplayer/room-manager
code and pre-existing. (Those two files also reveal an email/verification-
code auth service already partially built — `registerUser`,
`verifyEmail`, `generateVerificationCode`, `generateAuthToken`, etc. Worth
reading before scoping Step 12; it may already cover a chunk of it.)

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

- Added for the Step 2 fix: a regression test proving repeated `RoomManager`
  construction against the same `LobbyManager`-held room keeps `players` a
  plain array throughout and that joins/ready-updates keep working
  correctly afterward.

Still missing:
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

## Step 12: Email-Based Login — **Mostly done (one-click link, not a typed code)**

Scope changed from the original plan: instead of a 6-digit code the user
types in, login is a one-click link in the email. Final shape, as built:

- **One endpoint, no separate register:** `POST /users/login` `{ email }`.
  Looks up the user; if the email has no account yet, creates one silently
  right there (no username collected, no separate "create account" step,
  nothing in the response distinguishes new vs. returning). Either way,
  issues a fresh 64-char random token (15-min expiry, reusing the existing
  `verificationcode`/`vcexpierytime` columns — no schema change) and emails
  a one-click link containing it, then responds `200 { user, emailSent }`.
  A failed email send doesn't fail the request (account/token already
  exist) — just reports `emailSent: false`.
- `POST /users/verify` `{ email, token }` exchanges the link's token for a
  24h `authenticationtoken`, same mechanism as before (`usersService`'s
  `verifyEmail` needed no logic changes — a long token compares just like
  a short code did).
- Email sending reuses the already-existing `scripts/send-email.js`
  (`nodemailer` + Gmail, credentials already in `.env`) — this piece was
  already working before this step and needed no changes.
- `service/usersService.js`: `registerUser`/`resendVerificationCode`
  replaced by `requestLogin(email)` + a shared `issueLoginToken(user)`
  helper.
- `controller/usersController.js` / `routes/usersRoutes.js`: `register`/
  `resend-code` routes replaced by the single `login` route; `verify`
  kept, now token-based.
- `frontend/relay/src/App.jsx`: added the first auth UI the frontend has
  ever had — a dedicated `'login'` screen (email input + "Log in" button
  calling `/users/login`) that gates *everything*, including Solo play,
  until the user has logged in. An on-mount handler detects `?token=&email=`
  in the URL (what the emailed link points at, via a new `FRONTEND_URL` env
  var), calls `/users/verify`, stores the resulting `authToken` in
  localStorage, strips the query string so a refresh doesn't retry an
  already-consumed token, and advances to the menu screen.
- Tests updated in `test/usersService.test.js` for the new
  `requestLogin`/token shape; `test/users.test.js` (data-layer) untouched.

**Identity now tied into the WebSocket layer too** (this used to be listed
as deferred — it's done):
- `multiplayer/websocketServer.js` now requires a valid login to even open
  a WebSocket connection. The `WebSocketServer` is constructed with
  `noServer: true`, and a new `server.on('upgrade', ...)` handler parses
  `?email=&token=` off the connection URL, validates them via the existing
  `usersService.validateAuthToken`, and only then calls
  `websocketServer.handleUpgrade(...)` — an invalid/missing pair gets a raw
  `401` and the socket destroyed before any WebSocket connection exists (no
  `error` message frame, since no connection was ever established).
- The per-connection `player` object gains an `email` field (`player =
  { id, name, email }`), available to all WS handlers server-side.
  Deliberately **not** broadcast to other clients — `getPlayerList`/
  `getRoomState`/`players_list`/`room_updated` etc. still only ever show
  `{ id, name }` per player, to avoid leaking emails between room members.
- `frontend/relay/src/App.jsx`'s WebSocket-connect effect now only connects
  once logged in, puts `email`/`authToken` on the connection URL, and
  treats a connection that never reaches `onopen` as an expired/invalid
  session — clears stored auth and bounces back to the login screen.
- `test/websocketServer.test.js` needed the biggest update: every test
  connection now needs a real `authToken`, so the suite gained the same
  DB-integration setup `usersService.test.js` has (`beforeAll` DB check,
  per-test unique emails, `afterAll` cleanup), plus a new `authedConnect()`
  helper (calls the real `requestLogin`/`verifyEmail` service functions,
  then connects with the resulting credentials) that replaced every bare
  `connect(url)` call site.
- Full suite: 95/95 passing, verified stable across multiple repeated runs
  (both parallel and `--runInBand`). One caveat worth noting: a single
  parallel run did show transient failures in `websocketServer.test.js`
  that didn't reproduce on retry or under `--runInBand` — looks like
  connection contention against the remote Aiven Postgres when several
  Jest worker processes hit it simultaneously (this suite went from zero
  DB dependency to ~80 extra real DB round trips), not a logic bug. Worth
  watching if it recurs; `--runInBand` is the reliable fallback.

**Still open:**
- Known pre-existing caveat, newly relevant: `LobbyManager.bansByOwner`/
  `room.ownerId` are keyed by the ephemeral per-connection `player.id`
  (still a random UUID), not by email — so a ban still wouldn't survive
  the *owner* disconnecting and reconnecting (they'd get a new `player.id`,
  hence a new `ownerId` on their next created room). Not fixed here;
  flagged as a candidate follow-up now that real per-connection identity
  exists.
- No rate-limiting on `/users/login` yet (repeated calls just keep
  reissuing tokens).

## What's next

1. Decide whether ownership/ban identity should move from the ephemeral
   `player.id` to the stable `player.email` (fixes the reconnect caveat
   above).
2. Add rate-limiting to `POST /users/login` (currently uncapped).
3. Decide whether an `unban` action is needed for Step 11.
