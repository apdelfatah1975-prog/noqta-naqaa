import fs from "node:fs";

const path = "drizzle/meta/_journal.json";
const journal = JSON.parse(fs.readFileSync(path, "utf8"));
const exists = journal.entries.some((entry) => entry.tag === "0032_repair_technician_menu_permissions");
if (!exists) {
  journal.entries.push({
    idx: journal.entries.length,
    version: "5",
    when: Date.now(),
    tag: "0032_repair_technician_menu_permissions",
    breakpoints: true,
  });
  fs.writeFileSync(path, JSON.stringify(journal, null, 2) + "\n");
}
