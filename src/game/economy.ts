import { creditPayout, PARTS, rankCost, treeCost, type CarGarage, type CreditRun, type PartId } from "./garage";
import { MAX_PART_RANK } from "./tuning";

export type RunProfile = "short" | "average" | "excellent" | "legendary";

export const RUN_PROFILES: Record<RunProfile, CreditRun> = {
  short: { distance: 180, nearMisses: 1, overtakes: 1, maxCombo: 1, personalBest: false },
  average: { distance: 550, nearMisses: 4, overtakes: 5, maxCombo: 3, personalBest: false },
  excellent: { distance: 1800, nearMisses: 14, overtakes: 16, maxCombo: 7, personalBest: true },
  legendary: { distance: 4200, nearMisses: 32, overtakes: 38, maxCombo: 8, personalBest: true },
};

export function payoutFor(profile: RunProfile): number {
  return creditPayout(RUN_PROFILES[profile]);
}

export function emptyRanks(): CarGarage["engine"] {
  return 0;
}

export type SpendState = Record<PartId, number>;

export function emptySpend(): SpendState {
  return { engine: 0, tires: 0, turbo: 0, aero: 0 };
}

export function cheapestOpen(row: SpendState): { part: PartId; cost: number; rank: number } | null {
  let best: { part: PartId; cost: number; rank: number } | null = null;
  for (const part of PARTS) {
    const next = row[part.id] + 1;
    if (next > MAX_PART_RANK) continue;
    const others = PARTS.filter((item) => item.id !== part.id).map((item) => row[item.id]);
    if (next > 3 && next <= 6 && others.every((rank) => rank < 2)) continue;
    if (next > 6 && next <= 9 && others.filter((rank) => rank >= 3).length < 2) continue;
    if (next > 9 && others.some((rank) => rank < 5)) continue;
    const cost = rankCost(next);
    if (!best || row[part.id] > best.rank || (row[part.id] === best.rank && cost < best.cost)) {
      best = { part: part.id, cost, rank: row[part.id] };
    }
  }
  return best;
}

export function greedySpend(credits: number, start: SpendState = emptySpend()): {
  remaining: number;
  ranks: SpendState;
  bought: number;
  maxedParts: number;
} {
  const ranks = { ...start };
  let remaining = Math.floor(credits);
  let bought = 0;
  for (let i = 0; i < 200; i++) {
    const next = cheapestOpen(ranks);
    if (!next || remaining < next.cost) break;
    remaining -= next.cost;
    ranks[next.part] += 1;
    bought += 1;
  }
  return {
    remaining,
    ranks,
    bought,
    maxedParts: PARTS.filter((part) => ranks[part.id] >= MAX_PART_RANK).length,
  };
}

export function treesCompleted(ranks: SpendState): number {
  return PARTS.filter((part) => ranks[part.id] >= MAX_PART_RANK).length;
}

export { treeCost };
