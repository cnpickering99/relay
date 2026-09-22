# Room Operations Plan

This plan covers room-level operations in `roomManager.js`. Lobby creation, discovery, joining, and deletion remain in `lobbyManager.js`.

## Room Object

The room object will use these fields:

- `code`: Unique room code.
- `name`: Display name for the room.
- `ownerId`: Player ID of the current owner.
- `players`: Array of player entries.
- `status`: Current room status.
- `maxPlayers`: Maximum number of players.
- `type_of_game`: Game type identifier. The initial value is `1`.

Each entry in `players` will use this structure:

```js
{
  player: {
    id: 'player-id',
    name: 'Player Name'
  },
  status: 'ready',
  score: 0
}
```

The player `status` replaces the separate `readyPlayers` collection. A player is ready when `status` is `ready` and not ready when it is `not_ready`.

## Step 1: Separate Room Manager

1. Keep `lobbyManager.js` responsible for lobby lifecycle operations.
2. Keep `roomManager.js` responsible for operations inside an existing room.
3. Keep the room manager in the `backend/multiplayer` folder.
4. Avoid duplicating room state logic between the two managers.

## Step 2: Normalize Room State

1. Accept the room created by the lobby manager.
2. Ensure the room has a code and `type_of_game` value.
3. Convert existing player map data into the room `players` array.
4. Normalize every player entry with a player object, status, and score.
5. Use `not_ready` and score `0` as defaults.
6. Return public room state without exposing internal collections.

## Step 3: Leave a Room

Status: Complete.

1. Confirm the player belongs to the room.
2. Remove the player entry from `players`.
3. Remove the player's readiness state with the player entry.
4. If the owner leaves, transfer ownership to the first remaining player.
5. Return the updated room state.

## Step 4: Ready Status

1. Confirm the player belongs to the room.
2. Set the player's status to `ready` or `not_ready`.
3. Return the updated player status.
4. Later, use these statuses to determine whether a game can start.

## Step 5: Room and Code Views

1. Provide a room-code accessor.
2. Provide a public room-state view.
3. Include the room code, name, owner, player list, status, capacity, and game type.
4. Keep internal implementation details out of the public view.

## Step 6: Player List View

1. Return every player in the room.
2. Include player identity, status, score, and owner state.
3. Keep the response as an array that is safe to send to clients.
4. Do not expose the internal `Map` or other manager state.

## Step 7: Owner-Only Player Management

1. Verify that the requester is the current owner.
2. Reject management requests from regular players.
3. Support kicking a player from the room.
4. Prevent the owner from kicking themselves.
5. Remove the kicked player's complete player entry, including status and score.
6. Add additional owner actions only after defining their behavior and permissions.

## Step 8: WebSocket Integration

After the room manager behavior is stable, connect it to WebSocket messages such as:

- `leave_room`
- `set_ready`
- `get_room`
- `get_players`
- `manage_player`

The WebSocket layer should validate the request, call the room manager, and broadcast the resulting room update to affected clients.

## Step 9: Tests

Add focused tests for:

- Room field defaults and player normalization.
- Room-code and public room-state views.
- Leaving a room.
- Ownership transfer when the owner leaves.
- Ready and not-ready transitions.
- Player list contents.
- Owner-only management.
- Kicking a player removes their status and score.
- Invalid players and unauthorized actions.

Run the room manager tests before integrating WebSocket behavior, then run the full backend suite.
