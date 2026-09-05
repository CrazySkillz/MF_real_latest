export function shouldShowAlertVerificationError(
  notificationCount: number,
  notificationLoadFailed: boolean,
  reconciliationFailed: boolean,
): boolean {
  return notificationLoadFailed || (reconciliationFailed && notificationCount === 0);
}
