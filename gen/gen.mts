import * as fs from "node:fs/promises";
import { parseJson, type UnitRange } from "./types.mts";

const uniqueUnits = new Set<number>();
const displayUnits = (units: UnitRange) => {
  uniqueUnits.add(units.from);
  uniqueUnits.add(units.to);
  if (units.from === units.to) {
    if (units.inc !== 1) {
      throw new Error(`displayUnits: expected inc of 1`);
    }
    return `${units.from}`;
  }
  if (units.from > units.to) {
    throw new Error(`displayUnits: from should be <= to`);
  }
  const values = [];
  for (let u = units.from; u <= units.to; u += units.inc) {
    values.push(u);
    uniqueUnits.add(u);
  }
  if (values.at(-1) !== units.to) {
    throw new Error(`displayUnits: inc doesn't include to`);
  }
  if (units.inc === 1) {
    return `"${units.from}-${units.to}"`;
  }
  return `[${values.join(", ")}]`;
};

const MAX_LENGTH = 80;
const tomlSingleLineString = (key: string, value: string) => {
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(
      `tomlSingleLineString: detected invalid character in ${JSON.stringify(
        value
      )}`
    );
  }
  const lines = [`${key} = """`];
  let lastIndex = 0;
  for (const wrapPoint of value
    .matchAll(/\b[a-z]/gi)
    .map((match) => match.index)) {
    const textToAdd = value
      .slice(lastIndex, wrapPoint)
      .replace(/"\\/g, (m) => "\\" + m);
    if (textToAdd === "") {
      continue;
    }
    if ((lines.at(-1) + textToAdd).length > MAX_LENGTH - 1) {
      lines[lines.length - 1] += "\\";
      lines.push("  ");
    }
    lines[lines.length - 1] += textToAdd;
    lastIndex = wrapPoint;
  }
  {
    const textToAdd = value.slice(lastIndex).replace(/"\\/g, (m) => "\\" + m);
    if (textToAdd !== "") {
      // -3 for """
      if ((lines.at(-1) + textToAdd).length > MAX_LENGTH - 3) {
        lines[lines.length - 1] += "\\";
        lines.push("  ");
      }
      lines[lines.length - 1] += textToAdd;
    }
  }
  if (lines.length === 1) {
    return lines[0].replace('""', "") + '"\n';
  }
  lines[lines.length - 1] += '"""';
  return lines.map((line) => line + "\n").join("");
};

const repoDir = new URL("../", import.meta.url);
const termsDir = new URL(
  "../../uxdy/scheduleofclasses/terms/",
  import.meta.url
);
const dir = await fs.readdir(termsDir).catch((error: NodeJS.ErrnoException) => {
  if (error.code === "ENOENT") {
    console.error(`Expected ${termsDir} to exist`);
    process.exit(0);
  } else {
    return Promise.reject(error);
  }
});
const lastScraped: Record<string, number> = {};
for (const jsonName of dir) {
  if (!/^(FA|WI|SP|SU|S[123])\d\d\.json$/.test(jsonName)) {
    continue;
  }
  const term = jsonName.replace(".json", "");
  const { scrapeTime, courses } = parseJson(
    await fs.readFile(new URL(jsonName, termsDir), "utf-8")
  );
  lastScraped[term] = scrapeTime;
  let toml = "";
  for (const subjectCourses of Map.groupBy(courses, (course) => course.subject)
    .values()
    .toArray()
    .toSorted((a, b) => a[0].subject.localeCompare(b[0].subject))) {
    if (toml) {
      toml += "\n";
    }
    toml += `[${subjectCourses[0].subject}]\n`;
    toml += tomlSingleLineString("name", subjectCourses[0].subjectName);
    for (const groupCourses of Map.groupBy(
      subjectCourses,
      (course) => course.number
    )
      .values()
      .toArray()
      .toSorted((a, b) =>
        a[0].number.localeCompare(b[0].number, "en-US", { numeric: true })
      )) {
      const debug = `${term} ${groupCourses[0].subject} ${groupCourses[0].number}`;
      toml += "\n";
      toml += `[${groupCourses[0].subject}.courses.${groupCourses[0].number}]\n`;
      const titles = new Set(
        groupCourses.values().map((course) => course.title)
      );
      if (titles.size > 1) {
        throw new Error(
          `[${debug}] Inconsistent titles: ${Array.from(titles).join(", ")}`
        );
      }
      const title = titles.values().next();
      // idk why title.done alone doesn't narrow the type
      if (title.done === true) {
        throw new Error(`[${debug}] Expected title`);
      }
      const catalogs = new Set(
        groupCourses
          .values()
          // Second `catalog` may be undefined
          .filter((course) => course.catalog !== undefined)
          .map((course) => course.catalog)
      );
      if (catalogs.size > 1) {
        throw new Error(
          `[${debug}] Inconsistent catalogs: ${Array.from(catalogs).join(", ")}`
        );
      }
      // Not true
      // if (
      //   groupCourses.slice(1).some((course) => course.catalog !== undefined)
      // ) {
      //   throw new Error(
      //     `[${debug}] Expected only first course to have catalog`
      //   );
      // }
      const catalog = catalogs.values().next();
      toml += tomlSingleLineString("title", title.value);
      if (catalog.done !== true) {
        toml += tomlSingleLineString("catalog", catalog.value);
      }
      const restrictions = new Set(
        groupCourses
          .values()
          .map((course) => course.restriction.join("+") || "NONE")
      );
      if (restrictions.size > 1) {
        // may differ
        console.warn(
          `[${debug}] Inconsistent restrictions: ${Array.from(
            restrictions
          ).join(", ")}`
        );
      }
      const units = new Set(
        groupCourses.values().map((course) => displayUnits(course.units))
      );
      if (units.size > 1) {
        // may differ
        console.warn(
          `[${debug}] Inconsistent units: ${Array.from(units).join(", ")}`
        );
      }
      if (groupCourses.slice(1).some((course) => course.note !== undefined)) {
        throw new Error(`[${debug}] Expected only first course to have note`);
      }
      if (groupCourses[0].note !== undefined) {
        toml += tomlSingleLineString("note", groupCourses[0].note);
      }
    }
  }
  await fs.writeFile(new URL(`${term}.toml`, repoDir), toml);
}
await fs.writeFile(
  new URL("meta.json", repoDir),
  JSON.stringify(lastScraped, null, 2) + "\n"
);
console.warn(
  "Unique units:",
  Array.from(uniqueUnits).toSorted((a, b) => a - b)
);
