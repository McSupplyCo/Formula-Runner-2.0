import { ADS } from "./tuning";
import { formatCredits, type GarageState } from "./garage";

export type RewardGrant = {
  runId: string;
  baseCredits: number;
  doubled: boolean;
};

export function canDoubleReward(grant: RewardGrant | null): boolean {
  return Boolean(grant && !grant.doubled && grant.baseCredits > 0);
}

export function applyDoubleReward<T extends GarageState>(
  save: T,
  grant: RewardGrant,
): { save: T; grant: RewardGrant; ok: boolean; hint: string } {
  if (!canDoubleReward(grant)) {
    return { save, grant, ok: false, hint: "Already claimed." };
  }
  const bonus = Math.floor(grant.baseCredits);
  return {
    save: { ...save, credits: Math.floor(save.credits) + bonus },
    grant: { ...grant, doubled: true },
    ok: true,
    hint: `Credits doubled · +${formatCredits(bonus)}`,
  };
}

export function shouldShowInterstitial(crashCount: number): boolean {
  return crashCount > 0 && crashCount % ADS.interstitialEvery === 0;
}

export function simulateAd(ms: number, onDone: () => void): () => void {
  const id = window.setTimeout(onDone, ms);
  return () => window.clearTimeout(id);
}
