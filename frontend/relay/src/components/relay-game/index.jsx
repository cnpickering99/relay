import { useState, useEffect, useRef, useCallback } from "react";
import MenuIcon from "./Menuicon.jsx";
import ChainPill from "./Chainpill.jsx";
import * as C from "./ComponentStyles.jsx";
import Connector from "./Connecter.jsx";
import Toast from "./Toast.jsx";
import GameOver from "./GameOver.jsx";
import Menu from "./Menu.jsx";
import LoadingScreen from "./LoadingScreen.jsx";
import { validateWord, isChainable } from "../../api/dictionaryapi.js";
import { getRandomFragment } from "./Fragments.js";
import Keyboard from "./Keyboard.jsx";
import UsedWords from "./UsedWords.jsx";

const font = "'Poppins', 'Nunito', sans-serif";
const getFragment = (word) => word.slice(-2).toUpperCase();

export default function RelayGame() {
  const [wordsUsed, setWordsUsed] = useState([]);
  const [fragment, setFragment] = useState(() => getRandomFragment());
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [toast, setToast] = useState({ message: "", type: "" });
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState(null);

  // Loading + menu transition states
  const [showLoading, setShowLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Animation states
  const [goldFlash, setGoldFlash] = useState(false);
  const [scoreKey, setScoreKey] = useState(0);
  const [flyingWord, setFlyingWord] = useState(null);

  const toastTimer = useRef(null);
  const inputRef = useRef(null);

  // Loading done → fade menu in
  const handleLoadingDone = useCallback(() => {
    setShowLoading(false);
    setShowMenu(true);
    setTimeout(() => setMenuVisible(true), 50);
  }, []);

  // Menu PLAY → fade menu out
  const handlePlay = () => {
    setMenuVisible(false);
    setTimeout(() => setShowMenu(false), 400);
  };

  const showToast = useCallback((message, type = "") => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ message: "", type: "" }), 2000);
  }, []);

  const resetGame = () => {
    setWordsUsed([]);
    setFragment(getRandomFragment());
    setScore(0);
    setInput("");
    setIsGameOver(false);
    setGameOverReason(null);
    setMenuVisible(false);
    setTimeout(() => {
      setShowMenu(true);
      setTimeout(() => setMenuVisible(true), 50);
    }, 300);
  };

  const triggerGoldFlash = () => {
    setGoldFlash(true);
    setTimeout(() => setGoldFlash(false), 450);
  };

  const triggerFlyingWord = (word) => {
    const id = Date.now();
    setFlyingWord({ word, id });
    setTimeout(() => setFlyingWord(null), 800);
  };

  const submitWord = async () => {
    const word = input.trim().toUpperCase();
    if (!word) return;

    // 1. Check if real word
    const result = await validateWord(word);
    if (!result.valid && result.reason === "NOT_A_WORD") {
      showToast("Not a real word!", "error");
      setInput("");
      return;
    }

    if (word.length < 3) { showToast("Word too short", "error"); return; }
    if (!word.startsWith(fragment)) { showToast(`Must start with "${fragment}"`, "error"); return; }
    if (wordsUsed.includes(word)) { showToast("Already used!", "error"); return; }

    // 2. Check chainability
    const chainable = await isChainable(word);
    if (!chainable) {
      const lastTwo = word.slice(-2).toUpperCase();
      setGameOverReason({ word, lastTwo });
      setIsGameOver(true);
      return;
    }

    // 3. Valid word — trigger animations then update state
    triggerFlyingWord(word);
    triggerGoldFlash();

    setTimeout(() => {
      setWordsUsed(prev => [...prev, word]);
      setScore(prev => {
        setScoreKey(k => k + 1);
        return prev + word.length;
      });
      setFragment(getFragment(word));
      setInput("");
      showToast(`+${word.length} pts`, "success");
      inputRef.current?.focus();
    }, 300);
  };

  const handleKeyPress = (key) => {
    if (key === "ENTER") submitWord();
    else if (key === "BACK") setInput(prev => prev.slice(0, -1));
    else setInput(prev => prev + key);
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === "Enter") submitWord(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [submitWord]);

  const highlights = wordsUsed.map((word, i) => {
    if (i === 0) return 0;
    return getFragment(wordsUsed[i - 1]).length;
  });

  return (
    <>
      {/* Loading screen sits above everything */}
      {showLoading && <LoadingScreen onDone={handleLoadingDone} />}

      <div style={{
        minHeight: "100vh",
        width: "100%",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
      }}>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />

        <style>{`
          @keyframes scoreBounce {
            0%   { transform: scale(1); }
            40%  { transform: scale(1.4); }
            70%  { transform: scale(0.9); }
            100% { transform: scale(1); }
          }
          @keyframes wordFlyUp {
            0%   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
            70%  { opacity: 0.7; transform: translateX(-50%) translateY(-180px) scale(0.8); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-220px) scale(0.65); }
          }
          @keyframes goldFlashAnim {
            0%   { opacity: 0; }
            25%  { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes pillPop {
            0%   { transform: scale(0.7); opacity: 0; }
            70%  { transform: scale(1.08); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>

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

          {/* Gold flash overlay */}
          {goldFlash && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: "rgba(245,197,24,0.18)",
              zIndex: 50,
              pointerEvents: "none",
              borderRadius: 44,
              animation: "goldFlashAnim 0.45s ease forwards",
            }} />
          )}

          {/* Flying word */}
          {flyingWord && (
            <div key={flyingWord.id} style={{
              position: "absolute",
              bottom: 320,
              left: "50%",
              fontSize: 22,
              fontWeight: 900,
              color: C.gold,
              zIndex: 60,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              textShadow: "0 0 24px rgba(245,197,24,0.7)",
              animation: "wordFlyUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards",
            }}>
              {flyingWord.word}
            </div>
          )}

          {/* Menu overlay with fade + scale transition */}
          {showMenu && (
            <div style={{
              position: "absolute",
              inset: 0,
              zIndex: 200,
              borderRadius: 44,
              opacity: menuVisible ? 1 : 0,
              transform: menuVisible ? "scale(1)" : "scale(0.96)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
            }}>
              <Menu onPlay={handlePlay} />
            </div>
          )}

          {/* Game Over — slides up from bottom */}
          {isGameOver && (
            <GameOver
              score={score}
              reason={gameOverReason}
              onPlayAgain={resetGame}
              onMainMenu={resetGame}
            />
          )}

          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
            <button
              onClick={() => { setShowMenu(true); setTimeout(() => setMenuVisible(true), 50); }}
              style={{
                width: 42, height: 42, borderRadius: 12,
                border: "2px solid rgba(255,255,255,0.2)",
                background: "rgba(0,0,0,0.15)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.3)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.15)"}
            >
              <MenuIcon />
            </button>

            <div style={{ textAlign: "right", lineHeight: 1 }}>
              <div
                key={scoreKey}
                style={{
                  fontSize: 42,
                  fontWeight: 900,
                  color: C.gold,
                  letterSpacing: -1,
                  lineHeight: 1,
                  display: "inline-block",
                  textShadow: "0 0 20px rgba(245,197,24,0.35)",
                  animation: scoreKey > 0 ? "scoreBounce 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none",
                }}
              >
                {score}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: C.goldDim }}>
                SCORE
              </div>
            </div>
          </div>

          {/* Chain track */}
                <UsedWords wordsUsed={wordsUsed} fragment={fragment} highlightLen={highlights}/> 


          {/* Chain from card */}
          <div style={{
            background: C.purpleDeep, borderRadius: 20,
            padding: "24px 22px 22px", marginBottom: 18,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: C.gold, marginBottom: 8 }}>
              CHAIN FROM
            </div>
            <div style={{ fontSize: 64, fontWeight: 900, color: C.gold, lineHeight: 1, marginBottom: 14, letterSpacing: -2, textShadow: "0 0 30px rgba(245,197,24,0.3)" }}>
              {fragment}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: C.muted, textTransform: "uppercase" }}>
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
              width: "90%", background: "rgba(0,0,0,0.25)",
              border: "2px solid rgba(255,255,255,0.1)", borderRadius: 14,
              padding: "18px 20px", fontSize: 16, fontWeight: 600,
              color: C.white, outline: "none", marginBottom: 12,
              fontFamily: font, transition: "border-color 0.15s",
            }}
            onFocus={e => { e.target.style.borderColor = C.gold; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
          />

          {/* Submit */}
          <button
            onClick={submitWord}
            style={{
              width: "100%", background: C.gold, border: "none",
              borderRadius: 14, padding: 18, fontSize: 14, fontWeight: 800,
              letterSpacing: "0.18em", color: "#1a1a2e", cursor: "pointer",
              textTransform: "uppercase", marginBottom: 28, fontFamily: font,
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

          <Keyboard onKeyPress={handleKeyPress} />

          {/* Words used */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: C.muted, marginBottom: 12, textTransform: "uppercase" }}>
            WORDS USED
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
       {/* Chain track */}
       <UsedWords wordsUsed={wordsUsed} fragment={fragment} highlightLen={highlights}/> 
          </div>
        </div>
      </div>
    </>
  );
}