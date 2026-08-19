export type CashAdvancedFilterState = {
  category: string;
  partyType: "all" | "technician" | "customer" | "entity";
  technician: string;
  itemName: string;
  dateMode: "all" | "month" | "day" | "range";
};

export function countActiveCashFilters(filters: CashAdvancedFilterState) {
  return [
    filters.category,
    filters.partyType !== "all" ? filters.partyType : "",
    filters.technician,
    filters.itemName,
    filters.dateMode !== "all" ? filters.dateMode : "",
  ].filter(Boolean).length;
}

export function hasActiveCashFilters(filters: CashAdvancedFilterState) {
  return countActiveCashFilters(filters) > 0;
}
