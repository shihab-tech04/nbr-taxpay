/** Collapse the two browser events triggered by a return to the same tab into
 * one fresh read. Never cache successful responses: explicit edits always
 * request the latest persisted lists and people. One gate is scoped per view. */
export function createBeneficiaryAutoRefreshGate(cooldownMs = 1250) {
  let running = false;
  let lastStartedAt = Number.NEGATIVE_INFINITY;
  return {
    begin(now: number): boolean {
      if (!Number.isFinite(now) || running || now - lastStartedAt < cooldownMs) return false;
      running = true;
      lastStartedAt = now;
      return true;
    },
    finish(): void { running = false; }
  };
}
