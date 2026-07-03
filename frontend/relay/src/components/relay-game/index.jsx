import { useState, useEffect, useRef, useCallback } from "react";
import MenuIcon from "./Menuicon.jsx";
import ChainPill from "./Chainpill.jsx";
import * as C from "./ComponentStyles.jsx";
import Connector from "./Connecter.jsx";
import Toast from "./Toast.jsx";
import GameOver from "./GameOver.jsx";
import Menu from "./Menu.jsx";
import { validateWord, isChainable } from "../../api/dictionaryapi.js";

const font = "'Poppins', 'Nunito', sans-serif";

// ── Helpers ──
const getFragment = (word) => word.slice(-2).toUpperCase();

// ── Main game ──
export default function RelayGame() {
  const [wordsUsed, setWordsUsed] = useState([]);
  const [fragment, setFragment] = useState("ROW");
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [toast, setToast] = useState({ message: "", type: "" });
  const [isGameOver, setIsGameOver] = useState(false);
  const [showMenu, setShowMenu] = useState(true);
  const toastTimer = useRef(null);
  const inputRef = useRef(null);

  const showToast = useCallback((message, type = "") => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ message: "", type: "" }), 2000);
  }, []);

  const resetGame = () => {
    setWordsUsed([]);
    setFragment("ROW");
    setScore(0);
    setInput("");
    setIsGameOver(false);
    setShowMenu(true);
  };

  const submitWord = async (event) => {
    const word = input.trim().toUpperCase();
    if (!word) return;

    // 1. Check if the word is real
    const result = await validateWord(word);
    if (!result.valid && result.reason === "NOT_A_WORD") {
      showToast("Not a real word!", "error");
      setInput("");
      return;
    }

    if (word.length < 3) { showToast("Word too short", "error"); return; }
    if (!word.startsWith(fragment)) { showToast(`Must start with "${fragment}"`, "error"); return; }
    if (wordsUsed.includes(word)) { showToast("Already used!", "error"); return; }

    // 2. Always check chainability
    const chainable = await isChainable(word);
    if (!chainable) {
      setIsGameOver(true);
      return;
    }

    const newFragment = getFragment(word);
    setWordsUsed(prev => [...prev, word]);
    setScore(prev => prev + word.length);
    setFragment(newFragment);
    setInput("");
    showToast(`+${word.length} pts`, "success");
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === "Enter") submitWord(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [submitWord]);

  const highlights = wordsUsed.map((word, i) => {
    if (i === 0) return 0;
    const prevFrag = getFragment(wordsUsed[i - 1]);
    return prevFrag.length;
  });

  return (
    <div style={{
  minHeight: "100vh",
  width: "100%",
  background: "#000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: font,
}}>
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&family=Nunito:wght@400;600;700;800&display=swap"
        rel="stylesheet"
      />

      <div style={{
        width: 390,
        minHeight: 780,
        background: C.purpleBg,
        borderRadius: 44,
        padding: "36px 28px 40px",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)",
        position: "relative",
        overflow: "hidden",
      }}>
        <Toast message={toast.message} type={toast.type} />

        {/* Menu Overlay */}
        {showMenu && (
          <Menu onPlay={() => setShowMenu(false)} />
        )}

        {/* Game Over Overlay */}
        {isGameOver && (
          <GameOver
            score={score}
            onPlayAgain={resetGame}
            onMainMenu={resetGame}
          />
        )}

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <button
            onClick={() => setShowMenu(true)}
            style={{
              width: 42, height: 42, borderRadius: 12,
              border: "2px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.15)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.target.style.background = "rgba(0,0,0,0.3)"}
            onMouseLeave={e => e.target.style.background = "rgba(0,0,0,0.15)"}
          >
            <MenuIcon />
          </button>

          <div style={{ textAlign: "right", lineHeight: 1 }}>
            <div style={{
              fontSize: 42,
              fontWeight: 900,
              color: C.gold,
              letterSpacing: -1,
              lineHeight: 1,
              textShadow: "0 0 20px rgba(245,197,24,0.35)",
            }}>
              {score}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: C.goldDim }}>
              SCORE
            </div>
          </div>
        </div>

        {/* Chain track */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginBottom: 22, overflowX: "auto", paddingBottom: 4,
        }}>
          {wordsUsed.map((word, i) => (
            <>
              <ChainPill key={word + i} word={word} highlightLen={highlights[i]} isCurrent={false} />
              <Connector key={"dot-" + i} />
            </>
          ))}
          <ChainPill isCurrent fragment={fragment} />
        </div>

        {/* Chain from card */}
        <div style={{
          background: C.purpleDeep,
          borderRadius: 20,
          padding: "24px 22px 22px",
          marginBottom: 18,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.2)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.2em",
            color: C.gold, marginBottom: 8,
          }}>
            CHAIN FROM
          </div>
          <div style={{
            fontSize: 64, fontWeight: 900, color: C.gold,
            lineHeight: 1, marginBottom: 14, letterSpacing: -2,
            textShadow: "0 0 30px rgba(245,197,24,0.3)",
          }}>
            {fragment}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.14em",
            color: C.muted, textTransform: "uppercase",
          }}>
            YOUR NEXT WORD MUST START WITH {fragment}
          </div>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your word..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          style={{
            width: "90%",
            background: "rgba(0,0,0,0.25)",
            border: "2px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: "18px 20px",
            fontSize: 16,
            fontWeight: 600,
            color: C.white,
            outline: "none",
            marginBottom: 12,
            fontFamily: font,
            transition: "border-color 0.15s",
          }}
          onFocus={e => { e.target.style.borderColor = C.gold; }}
          onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
        />

        {/* Submit */}
        <button
          onClick={submitWord}
          style={{
            width: "100%",
            background: C.gold,
            border: "none",
            borderRadius: 14,
            padding: 18,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: "#1a1a2e",
            cursor: "pointer",
            textTransform: "uppercase",
            marginBottom: 28,
            fontFamily: font,
            transition: "opacity 0.15s, transform 0.1s",
            boxShadow: "0 4px 20px rgba(245,197,24,0.3)",
          }}
          onMouseEnter={e => e.target.style.opacity = "0.9"}
          onMouseLeave={e => e.target.style.opacity = "1"}
          onMouseDown={e => e.target.style.transform = "scale(0.98)"}
          onMouseUp={e => e.target.style.transform = "scale(1)"}
        >
          SUBMIT
        </button>

        {/* Words used */}
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
          color: C.muted, marginBottom: 12, textTransform: "uppercase",
        }}>
          WORDS USED
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {wordsUsed.map((w, i) => (
            <div key={w + i} style={{
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 999,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: C.pillText,
            }}>
              {w}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}