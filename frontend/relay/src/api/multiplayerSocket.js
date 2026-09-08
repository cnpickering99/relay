const SOCKET_URL = 'ws://localhost:3000/multiplayer';

export function createMultiplayerSocket() {
  const socket = new WebSocket(SOCKET_URL);

  return {
    socket,
    send(type, payload = {}) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, ...payload }));
      }
    },
    createRoom(name) {
      this.send('create_room', { name });
    },
    joinRoom(roomId, name) {
      this.send('join_room', { roomId, name });
    },
    chooseMode(mode) {
      this.send('choose_mode', { mode });
    },
    setReady(ready) {
      this.send('set_ready', { ready });
    },
    joinQueue() {
      this.send('join_queue');
    },
  };
}
