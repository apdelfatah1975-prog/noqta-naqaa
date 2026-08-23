export function printCurrentPage(): void {
  if (typeof window !== "undefined" && typeof window.print === "function") {
    window.print();
  }
}
