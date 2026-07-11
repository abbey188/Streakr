import type { Team } from "../types";

/**
 * Fan pick-consensus — how the app split on who advances. This is sentiment, not
 * a prediction: it's the community's call, and it's ours alone. Below a small
 * threshold the % would be noise ("67%" = 2 of 3), so we hold the bar back and
 * show the raw count until enough people have weighed in. The total is always
 * visible so the bar never looks more authoritative than it is.
 */
const CONSENSUS_MIN = 5;

export default function PickConsensus({
  teamA,
  teamB,
  counts,
}: {
  teamA: Team;
  teamB: Team;
  counts?: { a: number; b: number };
}) {
  const a = counts?.a ?? 0;
  const b = counts?.b ?? 0;
  const total = a + b;

  if (total < CONSENSUS_MIN) {
    return (
      <div className="mt-3 text-center text-[9px] font-mono text-[#8E9299]/70 uppercase tracking-wider">
        {total === 0 ? "Be the first to call it" : `${total} pick${total > 1 ? "s" : ""} in — call it`}
      </div>
    );
  }

  const aPct = Math.round((a / total) * 100);
  const bPct = 100 - aPct;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[9px] font-mono font-bold mb-1">
        <span className={aPct >= bPct ? "text-[#FF4E00]" : "text-[#8E9299]"}>
          {teamA.code} {aPct}%
        </span>
        <span className="text-[#8E9299]/70 uppercase tracking-wider">{total} picks</span>
        <span className={bPct > aPct ? "text-sky-400" : "text-[#8E9299]"}>
          {bPct}% {teamB.code}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex bg-[#0A0E1A]">
        <div style={{ width: `${aPct}%` }} className="bg-[#FF4E00]/80" />
        <div style={{ width: `${bPct}%` }} className="bg-sky-500/70" />
      </div>
    </div>
  );
}
