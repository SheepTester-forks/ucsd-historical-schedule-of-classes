/**
 * @file
 * usage: node scripts/url.ts <term> <page>
 * usage: node scripts/url.ts <term> page <page>
 * inside scrape/
 */

import { getDepartments } from "../src/get.ts";
import { terms } from "../src/lib.ts";
import { printDebug } from "../src/parse.ts";

const filtered = process.argv.slice(2).filter((arg) => arg !== "page");
if (filtered.length !== 2) {
  console.error("usage: node scripts/url.ts <term> <page>");
  console.error("usage: node scripts/url.ts <term> page <page>");
  process.exit(1);
}

const [term, pageStr] = filtered;
const page = +pageStr;

for (const { deptTerms, paginateTerm } of terms()) {
  if (paginateTerm !== term) {
    continue;
  }
  const departments = await Promise.all(
    deptTerms.map((term) => getDepartments(term)),
  ).then((departments) =>
    departments
      .values()
      .flatMap((departments) => departments)
      .map(({ code }) => code)
      .toArray(),
  );
  await printDebug(term, departments, page);
}
