export const FOLLOW_UP_DAYS = 120;

export const visitTypes = [
  "installation",
  "maintenance",
  "cartridge_change",
  "follow_up",
  "other",
] as const;

export type VisitType = (typeof visitTypes)[number];

export function needsAutomaticReminder(visitType: VisitType) {
  return visitType === "installation" || visitType === "maintenance";
}

export function followUpDate(visitDate: Date) {
  const dueDate = new Date(visitDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + FOLLOW_UP_DAYS);
  return dueDate;
}

export function calculateStockBalance(
  openingQuantity: number,
  movements: Array<{ movementType: "incoming" | "outgoing"; quantity: number }>,
) {
  return movements.reduce(
    (balance, movement) =>
      movement.movementType === "incoming"
        ? balance + movement.quantity
        : balance - movement.quantity,
    openingQuantity,
  );
}
