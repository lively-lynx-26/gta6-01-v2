// Solmar Bay — Neon Tide: REP, the respect system. REP is earned on jobs
// and stunts and never spent: it is a rank. The tiers are ROOKIE, HUSTLER,
// WHEELMAN, FIXER and KING OF SOLMAR, and the HUD and the map screen show
// the current tier and the progress to the next one.

import { CFG } from './config.js';

export function repTier(rep) {
  let tier = CFG.repTiers[0];
  for (const t of CFG.repTiers) {
    if (rep >= t.at) tier = t;
  }
  return tier;
}

export function repTierIndex(rep) {
  let idx = 0;
  for (let i = 0; i < CFG.repTiers.length; i++) {
    if (rep >= CFG.repTiers[i].at) idx = i;
  }
  return idx;
}

// Progress (0-1) from the current tier to the next; 1 at the top tier.
export function repProgress(rep) {
  const idx = repTierIndex(rep);
  if (idx >= CFG.repTiers.length - 1) return 1;
  const cur = CFG.repTiers[idx].at;
  const next = CFG.repTiers[idx + 1].at;
  return Math.max(0, Math.min(1, (rep - cur) / (next - cur)));
}

export function repToNext(rep) {
  const idx = repTierIndex(rep);
  if (idx >= CFG.repTiers.length - 1) return 0;
  return CFG.repTiers[idx + 1].at - rep;
}
