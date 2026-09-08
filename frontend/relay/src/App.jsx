import { useState } from 'react'
import './App.css'
import RelayGame from './components/relay-game'
import MultiplayerLobby from './components/multiplayer/MultiplayerLobby.jsx'

function App() {
  const [screen, setScreen] = useState('menu')
  const [roomId, setRoomId] = useState('')
  const [playerName, setPlayerName] = useState('Player')

  const handleCreateRoom = (name) => {
    setPlayerName(name)
    setRoomId('NEW-ROOM')
    setScreen('multiplayer-lobby')
  }

  const handleJoinRoom = (code, name) => {
    setPlayerName(name)
    setRoomId(code || 'ENTERED-ROOM')
    setScreen('multiplayer-lobby')
  }

  const handleBackToMenu = () => {
    setScreen('menu')
    setRoomId('')
  }

  if (screen === 'solo') {
    return (
      <>
        <section id="center">
          <RelayGame />
        </section>
      </>
    )
  }

  if (screen === 'multiplayer-lobby') {
    return (
      <MultiplayerLobby
        roomId={roomId}
        playerName={playerName}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onBack={handleBackToMenu}
      />
    )
  }

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
          Relay Game
        </p>

        <h1 style={{ margin: '14px 0 10px', fontSize: 36, lineHeight: 1.1 }}>Choose a mode</h1>

        <p style={{ margin: '0 0 24px', color: '#c8c2dc', lineHeight: 1.6 }}>
          Start with the classic solo game, or enter the multiplayer lobby and match with other players.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => setScreen('solo')}
            style={{
              background: '#f5c518',
              color: '#1a1328',
              border: 'none',
              borderRadius: 12,
              padding: '16px 18px',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Play Solo
          </button>

          <button
            onClick={() => setScreen('multiplayer-lobby')}
            style={{
              background: 'transparent',
              color: '#f7f1ff',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 12,
              padding: '16px 18px',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Play Multiplayer
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
