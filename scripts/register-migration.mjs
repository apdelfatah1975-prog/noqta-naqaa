import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../drizzle/meta/_journal.json", import.meta.url);
const journal = JSON.parse(await readFile(path, "utf8"));
const tag = "0031_add_technician_menu_permissions";
if (!journal.entries.some((entry) => entry.tag === tag)) {
  const nextIdx = Math.max(...journal.entries.map((entry) => entry.idx)) + 1;
  journal.entries.push({
    idx: nextIdx,
    version: "5",
    when: Date.now(),
    tag,
    breakpoints: true,
  });
  await writeFile(path, `${JSON.stringify(journal, null, 2)}\n`);
  console.log(`Registered ${tag}`);
} else {
  console.log(`${tag} already registered`);
}
