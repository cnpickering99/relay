# Relay Backend Feature List

## Core API

- Express REST API with CORS support and JSON request parsing.
- Health/status endpoint at `GET /`.
- Configurable server port using the `PORT` environment variable.
- REST API and WebSocket server running on the same HTTP server.

## User Authentication and Profiles

- User registration with email and optional username.
- Six-digit email verification codes.
- Verification-code expiration after 15 minutes.
- Verification-code resend flow.
- Cryptographically secure authentication-token generation.
- Authentication-token expiration after 24 hours.
- Bearer-token authentication using `Authorization` and `x-user-email` headers.
- Last-login timestamp tracking.
- Logout and authentication-token invalidation.
- Profile retrieval.
- Username updates.
- Sensitive verification-code and authentication-token fields are removed from returned user objects.

### User endpoints

- `POST /users/register` - Register a user and return a verification code.
- `POST /users/resend-code` - Generate a new verification code.
- `POST /users/verify` - Verify the code and issue an authentication token.
- `POST /users/logout` - Clear the user's authentication token.
- `GET /users/profile` - Retrieve a user's profile.
- `PATCH /users/profile` - Update the user's username.

## Scores and Leaderboards

- Score submission after a completed game.
- Validation for required usernames, scores, and used-word data.
- Negative-score rejection.
- Top-10 leaderboard retrieval, ordered by score.
- Personal-best score lookup by username.
- PostgreSQL persistence for submitted scores.

### Score endpoints

- `POST /scores/submit` - Save a score with username, score, and words used.
- `GET /scores/leaderboard` - Return the top 10 scores.
- `GET /scores/personal-best` - Return a user's highest score.

## Dictionary and Word Validation

- Datamuse API integration.
- Word normalization through trimming and lowercasing.
- Real-word validation.
- Chainability validation based on a word's final two letters.
- Structured validation results for:
  - Words that are not in the dictionary.
  - Real words that cannot continue the chain.
  - Valid, chainable words.
- Propagation of dictionary API failures.

## Multiplayer WebSocket System

- WebSocket server available at `/multiplayer`.
- Unique player IDs for connected clients.
- Room creation and room joining.
- Public room-list retrieval.
- Room-list broadcasting when rooms change.
- Named rooms with configurable capacity.
- Optional unique alphanumeric room codes.
- Direct room-code joining without requiring a room-list lookup.
- Capacity enforcement for open rooms.
- Support for rooms containing more than two players.
- Player removal when a WebSocket connection closes.
- JSON message validation.
- Errors for unsupported message types and invalid room actions.

### Lobby Features

- **Create room** - Create a named lobby with a configurable player capacity and optional custom code using `create_room`.
- **Join room** - Join an available lobby from the room list using `join_room`.
- **Join room via code** - Join a lobby directly by entering its room code; the room does not need to be selected from the room list first.
- **Search room via code** - Look up a lobby by room code without joining it using `search_room`; results include `playerCount` instead of player details.
- **List rooms** - Retrieve available lobbies and their room codes, names, `playerCount`, capacities, and statuses using `list_rooms`.
- **Delete room** - Allow the room owner to remove a lobby using `delete_room`; connected members receive `room_deleted`.

### Supported client messages

- `list_rooms`
- `search_room`
- `delete_room`
- `create_room`
- `join_room`
- `create_room` accepts `playerName`, `roomName`, `maxPlayers`, and optional `code`.

### Supported server events

- `connected`
- `rooms_list`
- `room_created`
- `room_joined`
- `room_found`
- `room_deleted`
- `error`

### Multiplayer room states

- `lobby` - Players can create or join a room and wait for other players.

## Database Integration

- PostgreSQL integration through the `pg` package.
- User persistence.
- Verification-code and expiration storage.
- Authentication-token and expiration storage.
- Profile and last-login persistence.
- Score persistence.
- Leaderboard and personal-best queries.
- SQL table and seed scripts.

## Testing

- Jest test suite for user registration and authentication services.
- User API tests.
- Dictionary validation tests.
- Game-status tests.
- WebSocket room and matchmaking tests.
- Database connectivity test.

## Not Yet Implemented

The multiplayer backend currently provides lobby and room-management infrastructure, but does not yet include:

- In-game word-submission WebSocket messages.
- Game-mode selection and matchmaking.
- Multiplayer game-state management.
- Game timers.
- Multiplayer word validation flow.
- Multiplayer score calculation.
- Game completion and winner handling.
- Persistence of multiplayer match results.
