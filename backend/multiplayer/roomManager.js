class RoomManager {
	constructor(room) {
		if (!room || (!Array.isArray(room.players) && !(room.players instanceof Map))) {
			throw new Error('room with a player list is required');
		}

		this.room = room;
		this.room.code ??= this.room.id;
		this.room.type_of_game ??= 1;
		const players = this.room.players instanceof Map
			? [...this.room.players.values()]
			: this.room.players;
		this.room.players = players.map(playerEntry => this.normalizePlayer(playerEntry));
	}

	leaveRoom(playerId) {
		this.requirePlayer(playerId);
		this.room.players = this.room.players.filter(entry => entry.player.id !== playerId);

		if (this.room.ownerId === playerId) {
			this.room.ownerId = this.room.players[0]?.player.id;
		}

		return this.getRoomState();
	}

	setReady(playerId, ready = true) {
		const playerEntry = this.requirePlayer(playerId);
		playerEntry.status = ready ? 'ready' : 'not_ready';

		return {
			playerId,
			status: playerEntry.status,
		};
	}

	getRoomCode() {
		return this.room.code;
	}

	getRoomState() {
		return {
			code: this.room.code,
			name: this.room.name,
			ownerId: this.room.ownerId,
			players: this.getPlayerList(),
			status: this.room.status,
			playerCount: this.room.players.length,
			maxPlayers: this.room.maxPlayers,
			type_of_game: this.room.type_of_game,
			roomId: this.room.id,
		};
	}

	getPlayerList() {
		return this.room.players.map(entry => ({
			player: entry.player,
			status: entry.status,
			score: entry.score,
			isOwner: entry.player.id === this.room.ownerId,
		}));
	}

	managePlayer(ownerId, targetPlayerId, action) {
		if (ownerId !== this.room.ownerId) {
			throw new Error('only the room owner can manage players');
		}

		if (action !== 'kick') {
			throw new Error('unsupported player management action');
		}

		if (targetPlayerId === ownerId) {
			throw new Error('room owner cannot be kicked');
		}

		this.requirePlayer(targetPlayerId);
		this.room.players = this.room.players.filter(entry => entry.player.id !== targetPlayerId);
		return this.getRoomState();
	}

	normalizePlayer(playerEntry) {
		const player = playerEntry.player ?? playerEntry;
		const status = playerEntry.status ?? (player.ready ? 'ready' : 'not_ready');
		const score = playerEntry.score ?? player.score ?? 0;

		if (!player.id) {
			throw new Error('player id is required');
		}

		return { player, status, score };
	}

	requirePlayer(playerId) {
		const playerEntry = this.room.players.find(entry => entry.player.id === playerId);
		if (!playerEntry) {
			throw new Error('player is not in the room');
		}

		return playerEntry;
	}
}

module.exports = RoomManager;