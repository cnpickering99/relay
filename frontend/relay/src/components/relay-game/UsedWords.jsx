import ChainPill from "./Chainpill";
import Connector from "./Connecter";

function UsedWords({ wordsUsed, fragment, highlightLen }) {
  return (
    <div style={{
      position: "relative",
      marginBottom: 22,
      overflow: "hidden",
    }}>
      {/* Left fade */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 28,
        background: "linear-gradient(to right, #7b74c2, transparent)",
        zIndex: 2,
        pointerEvents: "none",
      }} />

      {/* Right fade */}
      <div style={{
        position: "absolute",
        right: 0, top: 0, bottom: 0,
        width: 28,
        background: "linear-gradient(to left, #7b74c2, transparent)",
        zIndex: 2,
        pointerEvents: "none",
      }} />

      {/* Scrollable row */}
      <div style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        alignItems: "center",
        gap: 6,
        overflowX: "scroll",
        paddingBottom: 4,
        paddingLeft: 4,
        paddingRight: 4,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}>
        {wordsUsed.map((word, i) => (
          <>
            <ChainPill key={word + i} word={word} highlightLen={highlightLen[i]} isCurrent={false} />
            <Connector key={"dot-" + i} />
          </>
        ))}
        <ChainPill isCurrent fragment={fragment} />
      </div>
    </div>
  );
}

export default UsedWords;