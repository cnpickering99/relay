import ChainPill from "./Chainpill";

function UsedWords({wordsUsed, fragment, highlightLen}) {

    return (
        <div className="words-chain-wrapper">
            <div className="words-chain">
                {wordsUsed.map((word, i) => (
                    <>
                        <ChainPill key={word + i} word={word} highlightLen={highlightLen[i]} isCurrent={false} />
                    </>
                ))}
                <ChainPill isCurrent fragment={fragment} />
            </div>
        </div>
    )

}

export default UsedWords;