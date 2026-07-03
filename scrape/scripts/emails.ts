/**
 * @file
 * Usage: node scripts/emails.ts (inside scrape/)
 *
 * Need to run src/index.ts first. May need to run this script a few times
 * because of ratelimits.
 */

import { join } from "node:path";
import { terms } from "../src/lib.ts";
import { readFile } from "node:fs/promises";
import { getEmail } from "../src/get.ts";
import { createWriteStream } from "node:fs";

const encryptedPids = new Set<string>();

for (const { paginateTerm } of terms()) {
  const html = await readFile(
    join(".cache", paginateTerm, "_all", "1.html"),
    "utf-8",
  );
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
      readFile(join(".cache", paginateTerm, "_all", page + ".html"), "utf-8")
        .then((html) => {
          for (const [, encryptedPid] of html.matchAll(
            /onclick="javascript:sendMail\('\/scheduleOfClasses\/scheduleOfClassesFacultyEmailResult\.htm\?pid=([a-zA-Z0-9+/]*=*)'\)"/g,
          )) {
            encryptedPids.add(encryptedPid);
          }
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

let hasEmail = 0;
let done = 0;
const pairs = await Promise.all(
  encryptedPids.values().map((encryptedPid) =>
    getEmail(encryptedPid)
      .then((email) => {
        hasEmail += +!!email;
        done++;
        process.stderr.write(
          `\r[email] ${hasEmail}/${done}/${encryptedPids.size}`.padEnd(30),
        );
        return { encryptedPid, email: email ?? "" };
      })
      .catch(console.error),
  ),
);
if (!pairs.every((pair) => pair !== undefined)) {
  process.exit(1);
}
pairs.sort(
  (a, b) =>
    a.email.localeCompare(b.email) ||
    a.encryptedPid.localeCompare(b.encryptedPid),
);
const file = createWriteStream("scripts/emails.yml");
file.write(
  `# stats: successfully found ${hasEmail} of ${encryptedPids.size} emails\n`,
);
for (const { email, encryptedPid } of pairs) {
  if (email) {
    file.write(
      `${email}: ${Buffer.from(encryptedPid, "base64").toString("hex")}\n`,
    );
  }
}
file.end();

console.error(
  Object.fromEntries(
    Map.groupBy(pairs, (pair) => pair.email.split("@")[1])
      .entries()
      .map(([address, pairs]) => [address, pairs.length]),
  ),
);
