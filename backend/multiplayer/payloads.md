Create Room:
{
  "type": "create_room",
  "playerName": "Player One",
  "owner": "Player One",
  "roomName": "Test Lobby",
  "maxPlayers": 4,
  "code": "TEST01"
}

List Rooms:
{
  "type": "list_rooms"
}

Search Room:
{
  "type": "search_room",
  "roomId": "{{roomCode}}"
}

Join Room:
{
  "type": "join_room",
  "roomId": "{{roomCode}}",
  "name": "Player Two"
}

Delete Room:
{
  "type": "delete_room",
  "roomId": "{{roomCode}}"
}

Join Room W/ code:
{
  "type": "join_room",
  "roomId": "{{roomCode}}",
  "name": "Player Three"
}

Ready:
{"type":"set_ready","ready":true}

Un-Ready:
{"type":"set_ready","ready":false}

Leave Room:
{"type":"leave_room"}

Get Room:
{"type":"get_room"}

Get Players:
{"type":"get_players"}

Manage Player (owner only):
{"type":"manage_player","action":"kick","targetPlayerId":"{{playerId}}"}