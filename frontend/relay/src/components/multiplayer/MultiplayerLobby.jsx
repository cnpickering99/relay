import { useState } from 'react';

export default function MultiplayerLobby({
  roomId,
  playerName,
  rooms = [],
  hasActiveRoom = false,
  onCreateRoom,
  onJoinRoom,
  onBack,
}) {
  const [name, setName] = useState(playerName || 'Player');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomSize, setRoomSize] = useState(2);
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState('');

  const createRoom = () => {
    const trimmedName = (roomName || 'Lobby').trim();
    const finalCode = useCustomCode ? customCode.trim().toUpperCase() : '';

    onCreateRoom({
      roomName: trimmedName,
      maxPlayers: Number(roomSize) || 2,
      code: finalCode,
      playerName: (name || 'Player').trim() || 'Player',
    });

    setShowCreateModal(false);
    setRoomName('');
    setCustomCode('');
    setUseCustomCode(false);
    setRoomSize(2);
  };

  const createButtonText = hasActiveRoom ? `Room already active: ${roomId}` : 'Create Room';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#090611',
      color: '#f7f1ff',
      fontFamily: 'Poppins, sans-serif',
    }}>
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8, 7, 18, 0.78)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          zIndex: 100,
        }}>
          <div style={{
            width: 'min(92vw, 440px)',
            background: '#17132a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 22,
            boxShadow: '0 28px 70px rgba(0,0,0,0.6)',
            padding: 24,
          }}>
            <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#d5b8ff', textTransform: 'uppercase', marginBottom: 8 }}>
              Create room
            </div>

            <h2 style={{ margin: '0 0 18px', fontSize: 30 }}>New room</h2>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#c8c2dc', marginBottom: 8 }}>
              Room name
            </label>
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="My lobby"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '14px 16px', color: '#f7f1ff', fontSize: 15, marginBottom: 16 }}
            />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#c8c2dc', marginBottom: 8 }}>
              Player size
            </label>
            <select
              value={roomSize}
              onChange={(event) => setRoomSize(Number(event.target.value))}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '14px 16px', color: '#f7f1ff', fontSize: 15, marginBottom: 16 }}
            >
              <option value={2}>2 players</option>
              <option value={3}>3 players</option>
              <option value={4}>4 players</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, color: '#c8c2dc' }}>Custom room code</span>
              <button
                type="button"
                onClick={() => setUseCustomCode((value) => !value)}
                style={{ background: useCustomCode ? '#f5c518' : 'transparent', color: useCustomCode ? '#1a1328' : '#f7f1ff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '6px 12px', fontWeight: 700, cursor: 'pointer' }}
              >
                {useCustomCode ? 'On' : 'Off'}
              </button>
            </div>

            {useCustomCode && (
              <input
                value={customCode}
                onChange={(event) => setCustomCode(event.target.value.toUpperCase())}
                placeholder="XYZ123"
                maxLength={6}
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '14px 16px', color: '#f7f1ff', fontSize: 15, marginBottom: 18 }}
              />
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, color: '#f7f1ff', padding: '12px 14px', cursor: 'pointer', fontWeight: 700 }}
              >
                Cancel
              </button>

              <button
                onClick={createRoom}
                style={{ flex: 1, background: '#f5c518', border: 'none', borderRadius: 12, color: '#1a1328', padding: '12px 14px', cursor: 'pointer', fontWeight: 800 }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        width: 'min(92vw, 520px)',
        background: '#151225',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        padding: 28,
      }}>
        <p style={{ margin: 0, color: '#d5b8ff', letterSpacing: '0.18em', fontSize: 12, textTransform: 'uppercase' }}>
          Multiplayer Lobby
        </p>

        <h1 style={{ margin: '14px 0 18px', fontSize: 32, lineHeight: 1.1 }}>Set up your room</h1>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#c8c2dc', marginBottom: 8 }}>
          Display name
        </label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter your name"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: '14px 16px',
            color: '#f7f1ff',
            fontSize: 15,
            marginBottom: 18,
          }}
        />

        <button
          onClick={() => !hasActiveRoom && setShowCreateModal(true)}
          disabled={hasActiveRoom}
          style={{
            width: '100%',
            background: hasActiveRoom ? '#4a435f' : '#f5c518',
            color: hasActiveRoom ? '#d8c7ff' : '#1a1328',
            border: 'none',
            borderRadius: 12,
            padding: '14px 18px',
            fontSize: 15,
            fontWeight: 800,
            cursor: hasActiveRoom ? 'not-allowed' : 'pointer',
            marginBottom: 18,
            opacity: hasActiveRoom ? 0.9 : 1,
          }}
        >
          {createButtonText}
        </button>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <input
            value={joinRoomCode}
            onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase())}
            placeholder="Enter room code to join"
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: '14px 16px',
              color: '#f7f1ff',
              fontSize: 15,
              letterSpacing: '0.12em',
            }}
          />

          <button
            onClick={() => onJoinRoom(joinRoomCode, name.trim() || 'Player')}
            style={{
              background: 'transparent',
              color: '#f7f1ff',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 12,
              padding: '14px 16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Join
          </button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Available Rooms</h2>
            <span style={{ color: '#b7b0d8', fontSize: 12 }}>{rooms.length} open</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rooms.length === 0 ? (
              <div style={{
                color: '#c8c2dc',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '12px 14px',
              }}>
                No rooms open yet. Create one to start the lobby.
              </div>
            ) : (
              rooms.map((room) => (
                <div key={room.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: '12px 14px',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, letterSpacing: '0.12em', color: '#f7d66d' }}>{room.id}</div>
                    <div style={{ color: '#c8c2dc', fontSize: 12, marginTop: 4 }}>
                      {room.name || 'Lobby'} · {room.players || 1}/{room.maxPlayers || 2} players · {room.mode || 'classic'}
                    </div>
                  </div>

                  <button
                    onClick={() => onJoinRoom(room.id, name.trim() || 'Player')}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(245,197,24,0.5)',
                      color: '#f7d66d',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {roomId && (
          <div style={{
            background: 'rgba(245,197,24,0.08)',
            border: '1px solid rgba(245,197,24,0.22)',
            borderRadius: 12,
            padding: '12px 14px',
            color: '#f7d66d',
            fontWeight: 700,
            marginBottom: 18,
          }}>
            Room: {roomId}
          </div>
        )}

        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            color: '#d8c7ff',
            border: 'none',
            padding: 0,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back to menu
        </button>
      </div>
    </div>
  );
}
