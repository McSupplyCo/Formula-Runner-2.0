import { describe, expect, it } from "vitest";
import { applyDoubleReward, canDoubleReward, shouldShowInterstitial } from "../src/game/ads";
import { greedySpend, payoutFor, treeCost, treesCompleted } from "../src/game/economy";
import { buyPart, creditPayout, partRequirement, rankCost, treeCost as garageTreeCost } from "../src/game/garage";
import { CREDIT } from "../src/game/tuning";
import { defaultSave } from "../src/game/save";

describe("economy pacing", () => {
  it("keeps a short run from buying two first ranks", () => {
    const pay = payoutFor("short");
    expect(pay).toBeGreaterThan(40);
    expect(pay).toBeLessThan(rankCost(1) * 2);
  });

  it("lets an average run buy an early upgrade but not a whole tree", () => {
    const pay = payoutFor("average");
    expect(pay).toBeGreaterThanOrEqual(rankCost(1));
    expect(pay).toBeLessThan(treeCost());
    const spent = greedySpend(pay);
    expect(spent.bought).toBeGreaterThanOrEqual(1);
    expect(spent.bought).toBeLessThan(5);
    expect(spent.maxedParts).toBe(0);
  });

  it("does not let one excellent run complete two upgrade trees", () => {
    const pay = payoutFor("excellent");
    expect(pay).toBeLessThan(treeCost());
    expect(pay * 2).toBeLessThan(treeCost() * 2);
    const spent = greedySpend(pay);
    expect(treesCompleted(spent.ranks)).toBe(0);
    expect(spent.maxedParts).toBe(0);
  });

  it("still cannot complete two trees after a doubled legendary payout", () => {
    const doubled = Math.min(CREDIT.maxPayout, payoutFor("legendary")) * 2;
    expect(doubled).toBeLessThan(treeCost() * 2);
    expect(greedySpend(doubled).maxedParts).toBeLessThan(2);
  });

  it("caps payout so hacked distance cannot mint a tree", () => {
    const hacked = creditPayout({
      distance: 1_000_000,
      nearMisses: 999,
      overtakes: 999,
      maxCombo: 8,
      personalBest: true,
    });
    expect(hacked).toBe(CREDIT.maxPayout);
    expect(hacked).toBeLessThan(garageTreeCost());
  });

  it("makes later ranks clearly more expensive", () => {
    expect(rankCost(6)).toBeGreaterThan(rankCost(2) * 1.4);
    expect(rankCost(12)).toBeGreaterThan(rankCost(6) * 1.8);
  });

  it("locks high tiers behind other parts", () => {
    const row = defaultSave().garage.apex;
    expect(partRequirement(row, "engine", 2)).toBeNull();
    expect(partRequirement(row, "engine", 4)).toMatch(/rank 2/i);
    expect(partRequirement({ ...row, tires: 2 }, "engine", 4)).toBeNull();
    expect(partRequirement({ ...row, tires: 3, turbo: 2, aero: 0 }, "engine", 8)).toMatch(/two other/i);
    expect(partRequirement({ ...row, tires: 5, turbo: 5, aero: 4 }, "engine", 10)).toMatch(/every other/i);
  });

  it("models sustained play as the path to a full tree", () => {
    const average = payoutFor("average");
    let runs = 0;
    let credits = 0;
    const start = { engine: 0, tires: 0, turbo: 0, aero: 0 };
    let ranks = start;
    while (treesCompleted(ranks) < 1 && runs < 80) {
      credits += average;
      const spent = greedySpend(credits, ranks);
      ranks = spent.ranks;
      credits = spent.remaining;
      runs += 1;
    }
    expect(runs).toBeGreaterThan(12);
    expect(runs).toBeLessThan(70);
  });
});

describe("purchase atomicity", () => {
  it("does not deduct credits when the buy fails", () => {
    const save = { ...defaultSave(), credits: 10 };
    const result = buyPart(save, "apex", "engine");
    expect(result.ok).toBe(false);
    expect(result.save.credits).toBe(10);
    expect(result.save.garage.apex.engine).toBe(0);
  });

  it("deducts credits and increments rank together", () => {
    const save = { ...defaultSave(), credits: rankCost(1) };
    const result = buyPart(save, "apex", "engine");
    expect(result.ok).toBe(true);
    expect(result.save.credits).toBe(0);
    expect(result.save.garage.apex.engine).toBe(1);
    expect(save.garage.apex.engine).toBe(0);
    expect(save.credits).toBe(rankCost(1));
  });

  it("ignores a second tap once the part is already bought at that rank", () => {
    const first = buyPart({ ...defaultSave(), credits: 500 }, "apex", "engine");
    const second = buyPart(first.save, "apex", "engine");
    expect(second.ok).toBe(true);
    expect(second.save.garage.apex.engine).toBe(2);
    expect(second.save.credits).toBe(first.save.credits - rankCost(2));
  });

  it("floors fractional credits so rounding cannot mint extra ranks", () => {
    const save = { ...defaultSave(), credits: rankCost(1) - 0.4 };
    expect(buyPart(save, "apex", "engine").ok).toBe(false);
  });
});

describe("ads", () => {
  it("doubles a grant once and refuses the second callback", () => {
    const save = { ...defaultSave(), credits: 100 };
    const grant = { runId: "run-1", baseCredits: 80, doubled: false };
    expect(canDoubleReward(grant)).toBe(true);
    const once = applyDoubleReward(save, grant);
    expect(once.ok).toBe(true);
    expect(once.save.credits).toBe(180);
    const twice = applyDoubleReward(once.save, once.grant);
    expect(twice.ok).toBe(false);
    expect(twice.save.credits).toBe(180);
  });

  it("shows an interstitial every six crashes and never at zero", () => {
    expect(shouldShowInterstitial(0)).toBe(false);
    expect(shouldShowInterstitial(5)).toBe(false);
    expect(shouldShowInterstitial(6)).toBe(true);
    expect(shouldShowInterstitial(12)).toBe(true);
    expect(shouldShowInterstitial(7)).toBe(false);
  });
});
