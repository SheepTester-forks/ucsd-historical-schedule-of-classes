/**
 * @file
 * Usage: node scripts/last-updated.ts > scripts/last-updated.txt (inside scrape/)
 *
 * Need to run src/index.ts first.
 */

import { readFile } from "node:fs/promises";
import { terms } from "../src/lib.ts";
import { join } from "node:path";

const regex =
  /<span class="bold_text">As of: (\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})<\/span>/;

for (const { paginateTerm } of terms()) {
  const html = await readFile(
    join(".cache", paginateTerm, "_all", "1.html"),
    "utf-8",
  ).catch(() => null);
  if (!html) {
    console.log(`[${paginateTerm}] file does not exist`);
    continue;
  }
  const match = html.match(regex);
  if (!match) {
    console.log(`[${paginateTerm}] cannot find as of date`);
    continue;
  }
  const [, month, day, year, hour, minute, second] = match;
  console.log(
    `[${paginateTerm}] ${year}-${month}-${day} ${hour}:${minute}:${second}`,
  );
  // apparently the date can change from page to page fairly frequently
  const page2 = await readFile(
    join(".cache", paginateTerm, "_all", "2.html"),
    "utf-8",
  )
    .then((html) => html.match(regex)?.slice(1, 7).join("-"))
    .catch(() => null);
  if (page2 !== match.slice(1, 7).join("-")) {
    console.error(
      `[${paginateTerm}] mismatch: ${page2} vs ${match.slice(1, 7).join("-")}`,
    );
  }
}
