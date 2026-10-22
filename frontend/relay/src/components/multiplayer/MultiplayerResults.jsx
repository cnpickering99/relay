import { useEffect, useState } from 'react';
import * as C from '../relay-game/ComponentStyles.jsx';
import GameFrame, { font } from './GameFrame.jsx';

const medals = ['🥇', '🥈', '🥉'];
const wordsLabel = (count) => `${count} ${count === 1 ? 'word' : 'words'}`;

export default function MultiplayerResults({ result, myPlayerId, toast, onBackToRoom, onLeave }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 30);
    return () => window.clearTimeout(timer);
  }, []);

  const iWon = result.winnerIds.includes(myPlayerId);
  const headline = result.isTie ? 'DRAW' : iWon ? 'VICTORY' : 'DEFEAT';
  const subline = result.isTie ? 'EVENLY MATCHED' : iWon ? 'YOU TOOK THE ROUND' : 'BETTER LUCK NEXT TIME';
  const me = result.results.find((row) => row.playerId === myPlayerId);

  return (
    <GameFrame toast={toast}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.34,1.2,0.64,1)',
      }}>
        <div style={{ width: 40, height: 5, background: C.gold, borderRadius: 999, margin: '12px 0 14px' }} />
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>
          {subline}
        </div>
        <div style={{ fontSize: 46, fontWeight: 900, color: C.white, letterSpacing: -2, lineHeight: 1, marginBottom: 12 }}>
          {headline}
        </div>
        <div style={{ width: 70, height: 3, background: C.gold, borderRadius: 999, marginBottom: 22 }} />

        {/* Your score */}
        <div style={{
          background: C.purpleDeep, border: '2px solid rgba(245,197,24,0.3)', borderRadius: 18, padding: '16px 0',
          textAlign: 'center', width: '100%', marginBottom: 18, boxShadow: '0 0 40px rgba(245,197,24,0.1)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', color: C.gold, marginBottom: 6 }}>YOUR SCORE</div>
          <div style={{ fontSize: 64, fontWeight: 900, color: C.gold, lineHeight: 1, letterSpacing: -3, textShadow: '0 0 40px rgba(245,197,24,0.4)' }}>
            {me ? me.score : 0}
          </div>
          {me && <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 6 }}>{wordsLabel(me.wordCount)} chained</div>}
        </div>

        {/* Standings */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {result.results.map((row, i) => {
            const mine = row.playerId === myPlayerId;
            const winner = result.winnerIds.includes(row.playerId);
            return (
              <div key={row.playerId} style={{
                display: 'flex', alignItems: 'center', gap: 12, borderRadius: 14, padding: '12px 16px',
                background: winner ? 'rgba(245,197,24,0.14)' : 'rgba(0,0,0,0.2)',
                border: winner ? '1px solid rgba(245,197,24,0.4)' : '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ minWidth: 28, textAlign: 'center', fontSize: i < 3 ? 20 : 13, fontWeight: 900, color: C.muted }}>
                  {i < 3 ? medals[i] : `#${i + 1}`}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 800, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.name}{mine ? ' (you)' : ''}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{wordsLabel(row.wordCount)}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: winner ? C.gold : C.white, letterSpacing: -1 }}>{row.score}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <button
            onClick={onBackToRoom}
            style={{
              width: '100%', background: C.gold, border: 'none', borderRadius: 14, padding: 18, fontSize: 14, fontWeight: 800,
              letterSpacing: '0.2em', color: '#1a1a2e', cursor: 'pointer', textTransform: 'uppercase', fontFamily: font,
              boxShadow: '0 4px 24px rgba(245,197,24,0.35)',
            }}
            onMouseDown={(event) => { event.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(event) => { event.currentTarget.style.transform = 'scale(1)'; }}
          >
            BACK TO ROOM
          </button>
          <button
            onClick={onLeave}
            style={{
              width: '100%', background: 'transparent', border: 'none', borderRadius: 14, padding: 12, fontSize: 12,
              fontWeight: 700, letterSpacing: '0.18em', color: C.muted, cursor: 'pointer', textTransform: 'uppercase', fontFamily: font,
            }}
            onMouseEnter={(event) => { event.currentTarget.style.color = C.gold; }}
            onMouseLeave={(event) => { event.currentTarget.style.color = C.muted; }}
          >
            LEAVE ROOM
          </button>
        </div>
      </div>
    </GameFrame>
  );
}
