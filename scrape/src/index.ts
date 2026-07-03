/**
 * @file
 * Usage: node src/index.ts (inside scrape/)
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
import { terms } from "./lib.ts";

for (const { deptTerms, paginateTerm } of terms()) {
  const departments = Array.from(
    new Set(
      await Promise.all(deptTerms.map((term) => getDepartments(term))).then(
        (departments) =>
          departments
            .values()
            .flatMap((departments) => departments)
            .map(({ code }) => code),
      ),
    ),
  );
  const html = await getResultsHtml(paginateTerm, departments, 1);
  const pageCountMatch = html.match(/\(\d+&nbsp;of&nbsp;(\d+)\)/);
  if (!pageCountMatch) {
    console.error(paginateTerm, "missing page count");
    break;
  }
  const pageCount = +pageCountMatch[1];
  let done = 1;
  const promises = [];
  for (let page = 2; page <= pageCount; page++) {
    promises.push(
      getResultsHtml(paginateTerm, departments, page)
        .then(() => {
          done++;
          process.stderr.write(
            `\r[${paginateTerm}] ${done}/${pageCount}`.padEnd(30),
          );
        })
        .catch((error) => {
          console.error(paginateTerm, page, error);
        }),
    );
  }
  await Promise.all(promises);
  console.warn();
}
