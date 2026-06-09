/**
 * @file
 * Usage: node src/index.ts
 *
 * Dumb scraper that simply downloads and caches HTML files.
 *
 * Based on [UCSD Classrooms' scraper][scraper]. I am rewriting the script
 * because:
 *
 * - The original script was written in Deno, which I'm moving away from.
 *
 * - The original script deeply intertwines scraping with parsing. Since parsing
 *   is turning out to be a bigger task than expected (see gen/), I'd like to
 *   separate them: fetch everything before UCSD decommissions Schedule of
 *   Classes, then figure out how to parse everything when I have the time.
 *
 * [scraper]:
 * https://github.com/SheepTester/uxdy/blob/main/scheduleofclasses/scrape.ts
 */

import { getDepartments, getResultsHtml } from "./get.ts";

function* terms(): Generator<string> {
  for (let year = 1995; year <= 2026; year++) {
    for (const term of ["WI", "SP", "SA", "FA"]) {
      yield `${term}${(year % 100).toString().padStart(2, "0")}`;
    }
  }
}

await getResultsHtml(
  "SP26",
  await getDepartments("SP26").then((departments) =>
    departments.map(({ code }) => code),
  ),
  4,
);
