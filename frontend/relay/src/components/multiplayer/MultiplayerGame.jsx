import { useEffect, useRef, useState } from 'react';
import * as C from '../relay-game/ComponentStyles.jsx';
import UsedWords from '../relay-game/UsedWords.jsx';
import WordBank from '../relay-game/WordBank.jsx';
import Keyboard from '../relay-game/Keyboard.jsx';
import GameFrame, { font } from './GameFrame.jsx';
import useCountdown, { formatClock } from './useCountdown.js';

const LOW_TIME_MS = 15_000;
const getFragment = (word) => word.slice(-2).toUpperCase();

export default function MultiplayerGame({ game, run, scoreboard, myPlayerId, toast, onSubmitWord }) {
  const [input, setInput] = useState('');
  const [goldFlash, setGoldFlash] = useState(false);
  const [flyingWord, setFlyingWord] = useState(null);
  const [scoreKey, setScoreKey] = useState(0);
  const [seenWordCount, setSeenWordCount] = useState(run.wordsUsed.length);
  const inputRef = useRef(null);

  const remaining = useCountdown(game.endsAt);
  const timeUp = remaining === 0;
  const lowTime = remaining !== null && remaining > 0 && remaining <= LOW_TIME_MS;
  const canType = !run.finished && !timeUp;

  // A word was accepted: clear the box and play the solo game's flourish.
  if (seenWordCount !== run.wordsUsed.length) {
    setSeenWordCount(run.wordsUsed.length);
    setInput('');
    setScoreKey((key) => key + 1);
    setGoldFlash(true);
    setFlyingWord({ word: run.wordsUsed[run.wordsUsed.length - 1], id: run.wordsUsed.length });
  }

  useEffect(() => {
    if (!goldFlash) return undefined;
    const timer = window.setTimeout(() => setGoldFlash(false), 450);
    return () => window.clearTimeout(timer);
  }, [goldFlash]);

  useEffect(() => {
    if (!flyingWord) return undefined;
    const timer = window.setTimeout(() => setFlyingWord(null), 800);
    return () => window.clearTimeout(timer);
  }, [flyingWord]);

  const submit = () => {
    const word = input.trim();
    if (!word || !canType) return;
    onSubmitWord(word);
  };

  const handleKeyPress = (key) => {
    if (!canType) return;
    if (key === 'ENTER') submit();
    else if (key === 'BACK') setInput((prev) => prev.slice(0, -1));
    else setInput((prev) => prev + key);
  };

  const highlights = run.wordsUsed.map((word, i) => (i === 0 ? 0 : getFragment(run.wordsUsed[i - 1]).length));
  const fractionLeft = remaining === null ? 1 : Math.min(1, remaining / game.durationMs);

  return (
    <GameFrame toast={toast}>
      {/* Gold flash overlay */}
      {goldFlash && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(245,197,24,0.18)', zIndex: 50,
          pointerEvents: 'none', borderRadius: 44, animation: 'goldFlashAnim 0.45s ease forwards',
        }} />
      )}

      {/* Flying word */}
      {flyingWord && (
        <div key={flyingWord.id} style={{
          position: 'absolute', bottom: 320, left: '50%', fontSize: 22, fontWeight: 900, color: C.gold,
          zIndex: 60, pointerEvents: 'none', whiteSpace: 'nowrap', textShadow: '0 0 24px rgba(245,197,24,0.7)',
          animation: 'wordFlyUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
        }}>
          {flyingWord.word}
        </div>
      )}

      {/* Run over: waiting for the others */}
      {run.finished && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100, borderRadius: 44, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%', boxSizing: 'border-box', background: '#1a1a2e', borderRadius: '28px 28px 0 0',
            padding: '24px 28px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center',
            boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ width: 40, height: 5, background: C.gold, borderRadius: 999, marginBottom: 14 }} />
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>
              CHAIN BROKEN
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.white, marginBottom: 14, letterSpacing: -1, lineHeight: 1 }}>
              YOU&rsquo;RE OUT
            </div>
            {run.finishReason && (
              <div style={{
                background: 'rgba(255,99,99,0.08)', border: '1px solid rgba(255,99,99,0.25)', borderRadius: 14,
                padding: '12px 20px', textAlign: 'center', width: '100%', boxSizing: 'border-box', marginBottom: 14,
              }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: C.white, letterSpacing: -1, marginBottom: 4 }}>
                  {run.finishReason.word}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
                  No words start with <span style={{ color: C.gold, fontWeight: 800 }}>&ldquo;{run.finishReason.lastTwo}&rdquo;</span>
                </div>
              </div>
            )}
            <div style={{
              background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(245,197,24,0.25)', borderRadius: 18,
              padding: '14px 0', textAlign: 'center', width: '100%', marginBottom: 14,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', color: C.gold, marginBottom: 4 }}>YOUR SCORE</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: C.gold, lineHeight: 1, letterSpacing: -2 }}>{run.score}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: C.muted, textTransform: 'uppercase' }}>
              Waiting for the others · {formatClock(remaining)}
            </div>
          </div>
        </div>
      )}

      {/* Top bar: timer + score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ lineHeight: 1 }}>
          <div style={{
            display: 'inline-block',
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: -1,
            color: lowTime || timeUp ? '#ff6b6b' : C.white,
            textShadow: lowTime ? '0 0 20px rgba(255,107,107,0.5)' : 'none',
            animation: lowTime ? 'timerPulse 1s ease-in-out infinite' : 'none',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {formatClock(remaining)}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: C.muted, marginTop: 2 }}>
            TIME LEFT
          </div>
        </div>

        <div style={{ textAlign: 'right', lineHeight: 1 }}>
          <div
            key={scoreKey}
            style={{
              fontSize: 42, fontWeight: 900, color: C.gold, letterSpacing: -1, lineHeight: 1, display: 'inline-block',
              textShadow: '0 0 20px rgba(245,197,24,0.35)',
              animation: scoreKey > 0 ? 'scoreBounce 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
            }}
          >
            {run.score}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: C.goldDim }}>SCORE</div>
        </div>
      </div>

      {/* Time bar */}
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(0,0,0,0.2)', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${fractionLeft * 100}%`,
          borderRadius: 999,
          background: lowTime || timeUp ? '#ff6b6b' : C.gold,
          transition: 'width 0.25s linear, background 0.3s',
        }} />
      </div>

      {/* Scoreboard strip */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 18, paddingBottom: 2, scrollbarWidth: 'none' }}>
        {scoreboard.map((row, i) => {
          const mine = row.playerId === myPlayerId;
          return (
            <div key={row.playerId} style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 8,
              background: mine ? 'rgba(245,197,24,0.18)' : 'rgba(0,0,0,0.2)',
              border: mine ? '1px solid rgba(245,197,24,0.45)' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: 999, padding: '6px 12px', opacity: row.finished ? 0.55 : 1,
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: C.muted }}>#{i + 1}</span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: C.white, maxWidth: 90, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {mine ? 'You' : row.name}
              </span>
              <span style={{ fontSize: 13, fontWeight: 900, color: C.gold }}>{row.score}</span>
              {row.finished && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: C.muted }}>OUT</span>}
            </div>
          );
        })}
      </div>

      {/* Chain track */}
      <UsedWords wordsUsed={run.wordsUsed} fragment={run.fragment} highlightLen={highlights} />

      {/* Chain from card */}
      <div style={{
        background: C.purpleDeep, borderRadius: 20, padding: '24px 22px 22px', marginBottom: 18,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: C.gold, marginBottom: 8 }}>CHAIN FROM</div>
        <div style={{ fontSize: 64, fontWeight: 900, color: C.gold, lineHeight: 1, marginBottom: 14, letterSpacing: -2, textShadow: '0 0 30px rgba(245,197,24,0.3)' }}>
          {run.fragment}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: C.muted, textTransform: 'uppercase' }}>
          YOUR NEXT WORD MUST START WITH {run.fragment}
        </div>
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
        disabled={!canType}
        placeholder="Type your word..."
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        style={{
          width: '90%', background: 'rgba(0,0,0,0.25)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: 14,
          padding: '18px 20px', fontSize: 16, fontWeight: 600, color: C.white, outline: 'none', marginBottom: 12,
          fontFamily: font, transition: 'border-color 0.15s',
        }}
        onFocus={(event) => { event.target.style.borderColor = C.gold; }}
        onBlur={(event) => { event.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      />

      {/* Submit */}
      <button
        onClick={submit}
        disabled={!canType}
        style={{
          width: '100%', background: C.gold, border: 'none', borderRadius: 14, padding: 18, fontSize: 14,
          fontWeight: 800, letterSpacing: '0.18em', color: '#1a1a2e', cursor: canType ? 'pointer' : 'not-allowed',
          textTransform: 'uppercase', marginBottom: 28, fontFamily: font, opacity: canType ? 1 : 0.5,
          transition: 'opacity 0.15s, transform 0.1s', boxShadow: '0 4px 20px rgba(245,197,24,0.3)',
        }}
        onMouseDown={(event) => { event.currentTarget.style.transform = 'scale(0.98)'; }}
        onMouseUp={(event) => { event.currentTarget.style.transform = 'scale(1)'; }}
      >
        {timeUp ? "TIME'S UP" : 'SUBMIT'}
      </button>

      <Keyboard onKeyPress={handleKeyPress} />

      <WordBank wordsUsed={run.wordsUsed} />
    </GameFrame>
  );
}
