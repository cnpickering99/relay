import { useState } from 'react'
import './App.css'
import RelayGame from './components/relay-game'

function App() {
  const [screen, setScreen] = useState('menu')

  if (screen === 'solo') {
    return (
      <>
        <section id="center">
          <RelayGame />
        </section>
      </>
    )
  }

  if (screen === 'multiplayer') {
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
            Multiplayer
          </p>

          <h1 style={{ margin: '14px 0 10px', fontSize: 32, lineHeight: 1.1 }}>Relay Queue</h1>

          <p style={{ margin: '0 0 24px', color: '#c8c2dc', lineHeight: 1.6 }}>
            Create a room, pick a mode, and wait for another player to join the lobby.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setScreen('menu')}
              style={{
                background: '#f5c518',
                color: '#1a1328',
                border: 'none',
                borderRadius: 12,
                padding: '14px 18px',
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Create Room
            </button>

            <button
              onClick={() => setScreen('menu')}
              style={{
                background: 'transparent',
                color: '#f7f1ff',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 12,
                padding: '14px 18px',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Join Room
            </button>

            <button
              onClick={() => setScreen('menu')}
              style={{
                background: 'transparent',
                color: '#d8c7ff',
                border: 'none',
                padding: '12px 0 0',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to menu
            </button>
          </div>
        </div>
      </div>
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
            onClick={() => setScreen('multiplayer')}
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
