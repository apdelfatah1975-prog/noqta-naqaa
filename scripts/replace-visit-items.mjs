import fs from "node:fs";

const path = "/home/ubuntu/water-filter-app/client/src/pages/Customers.tsx";
const source = fs.readFileSync(path, "utf8");
const start = '<div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-extrabold text-teal-950">الأصناف المستخدمة</p>';
const startIndex = source.indexOf(start);
if (startIndex < 0) throw new Error("visit items section start not found");
const footer = '<div className="sticky bottom-0 flex justify-end gap-3 border-t border-teal-100 bg-white/95 pt-3 backdrop-blur">';
const footerIndex = source.indexOf(footer, startIndex);
if (footerIndex < 0) throw new Error("visit dialog footer not found");
const replacement = '<UsedItemsSection items={visitItems} setItems={setVisitItems} catalogItems={effectiveServiceCatalog?.items ?? []} manualName={manualItemName} setManualName={setManualItemName} manualQuantity={manualItemQuantity} setManualQuantity={setManualItemQuantity} onAdd={addManualVisitItem} listId="visit-inventory-items" />';
const updated = source.slice(0, startIndex) + replacement + source.slice(footerIndex);
fs.writeFileSync(path, updated);
console.log("Replaced visit items section with shared multi-item component");
