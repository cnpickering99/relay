import { useState } from 'react';

export default function MultiplayerLobby({
  roomId,
  playerName,
  onCreateRoom,
  onJoinRoom,
  onBack,
}) {
  const [name, setName] = useState(playerName || 'Player');
  const [joinRoomCode, setJoinRoomCode] = useState('');

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
      <div style={{
        width: 'min(92vw, 420px)',
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
          onClick={() => onCreateRoom(name.trim() || 'Player')}
          style={{
            width: '100%',
            background: '#f5c518',
            color: '#1a1328',
            border: 'none',
            borderRadius: 12,
            padding: '14px 18px',
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            marginBottom: 18,
          }}
        >
          Create Room
        </button>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <input
            value={joinRoomCode}
            onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase())}
            placeholder="ROOM CODE"
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
