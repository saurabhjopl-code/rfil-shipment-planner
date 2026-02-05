/**
 * FC PRIORITY SCORE
 * Applied ONLY for SHIP rows
 */

export function calculateFCPriority({ fcDRR, maxDRR, fcDW, maxDW }) {
  const drrScore = maxDRR > 0 ? fcDRR / maxDRR : 0;
  const dwScore = maxDW > 0 ? fcDW / maxDW : 0;

  return Math.max(drrScore, dwScore);
}
