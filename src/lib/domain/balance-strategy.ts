export const balanceStrategies = ["default", "simplified", "super_simplified"] as const;
export type BalanceStrategy = (typeof balanceStrategies)[number];

export function effectiveBalanceStrategy(
  strategy: BalanceStrategy,
  landlordEnabled: boolean,
): BalanceStrategy {
  return strategy === "super_simplified" && !landlordEnabled ? "simplified" : strategy;
}
