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

let largestSectionNum = 0;

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
      .replace(/["\\]/g, (m) => "\\" + m);
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
    const textToAdd = value.slice(lastIndex).replace(/["\\]/g, (m) => "\\" + m);
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
  for (const subjectCourses of Map.groupBy(
    // Ignore 100x sections for now; will split them into separate courses later
    // Example: https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=FA00&tabNum=tabs-crs&courses=BGGN%20297&page=11
    // Better example: https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=FA00&tabNum=tabs-crs&courses=BISP%20199&page=2
    courses
      .values()
      .filter(
        (course) =>
          course.sections[0].section[0] !== "1" &&
          course.sections[0].section[0] !== "2"
      ),
    (course) => course.subject
  )
    .values()
    .toArray()
    .toSorted((a, b) => a[0].subject.localeCompare(b[0].subject))) {
    // I guess it's because it's going by department that it's not alphabetized
    // if (subjectCourses[0].subject < prevSubject) {
    //   throw new Error(
    //     `course order: ${subjectCourses[0].subject} is not alphabetically after ${prevSubject}`
    //   );
    // }
    // prevSubject = subjectCourses[0].subject;
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
      // Numbers can be out of order too:
      // https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=FA07&tabNum=tabs-crs&courses=SOMI
      // if (
      //   groupCourses[0].number.localeCompare(lastNumber, "en-US", {
      //     numeric: true,
      //   }) < 0
      // ) {
      //   throw new Error(
      //     `[${debug}] number order: ${groupCourses[0].number} should've been before ${lastNumber}`
      //   );
      // }
      // lastNumber = groupCourses[0].number;
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
      if (title.done) {
        throw new Error(`[${debug}] Expected title`);
      }
      const catalogs = new Set(
        groupCourses
          .values()
          .map((course) => course.catalog)
          // Second `catalog` may be undefined
          .filter((catalog) => catalog !== undefined)
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
      if (!catalog.done) {
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
      let lastGroupId: string | number | undefined;
      let cancelled = 0;
      for (let [groupId, courses] of Map.groupBy(groupCourses, (course) => {
        const sectionCodes = new Set(
          course.sections
            .values()
            .map((section) => section.section)
            .filter((code) => typeof code === "string")
            .map((code) => {
              if (/^[A-Z]\d\d$/.test(code)) {
                return code[0];
              }
              if (/^\d\d\d$/.test(code)) {
                return +code;
              }
              // typo? https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=FA08&tabNum=tabs-crs&courses=BISP%20190
              if (term === "FA08" && code === "A0") {
                return "A";
              }
              // another typo? https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=FA08&tabNum=tabs-crs&courses=MAE%20299&page=4
              if (term === "FA08" && code === "50") {
                return 50;
              }
              // more typos: https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=FA08&tabNum=tabs-crs&courses=MED%20296&page=2
              if (term === "FA08" && /^[O-R]OO$/.test(code)) {
                return code[0];
              }
              if (term === "FA09" && code === "30") {
                return 30;
              }
              throw new Error(
                `[${debug}] unexpected section code format: ${code}`
              );
            })
        );
        const sectionCode = sectionCodes.values().next();
        if (sectionCode.done) {
          // https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=FA00&tabNum=tabs-crs&courses=COSF%20175
          // this can happen
          return null;
          // throw new Error(`[${debug}] all of this course's sections are dates`);
        }
        if (sectionCodes.size > 1) {
          throw new Error(
            `[${debug}] multiple group codes: ${Array.from(sectionCodes).join(
              ", "
            )}`
          );
        }
        return sectionCode.value;
      })) {
        if (typeof groupId === "string")
          test: {
            if (typeof lastGroupId === "number") {
              console.warn(
                `[${debug}] code type switch: ${lastGroupId} -> ${groupId}`
              );
              // throw new TypeError(
              //   `[${debug}] code type switch: ${groupId} vs ${lastGroupId}`
              // );
              // Apparently this can happen:
              // https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=FA00&tabNum=tabs-crs&courses=BGGN%20271&page=2
              break test;
            }
            // const expected = String.fromCodePoint(
            //   (lastGroupId.codePointAt(0) ?? 0) + 1
            // );
            if (lastGroupId !== undefined && groupId < lastGroupId) {
              // may skip letters
              // https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=FA00&tabNum=tabs-crs&courses=ERC%2092
              throw new TypeError(
                `[${debug}] out of order: ${groupId} should be before ${lastGroupId}`
              );
            }
            lastGroupId = groupId;
          }
        else if (typeof groupId === "number") {
          if (typeof lastGroupId === "string") {
            throw new TypeError(
              `[${debug}] code type switch: ${groupId} vs ${lastGroupId}`
            );
          }
          // https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=FA00&tabNum=tabs-crs&courses=ANGR%20295
          // may skip numeric section codes
          if (lastGroupId !== undefined && groupId < lastGroupId) {
            // 50 got sorted after 051
            if (term === "FA08" && groupId === 50) {
            } else {
              throw new TypeError(
                `[${debug}] out of order: ${groupId} should be before ${lastGroupId}`
              );
            }
          }
          lastGroupId = groupId;
        } else {
          if (lastGroupId === undefined) {
            cancelled++;
            continue;
          } else {
            groupId =
              typeof lastGroupId === "string"
                ? String.fromCodePoint((lastGroupId.codePointAt(0) ?? 0) + 1)
                : lastGroupId + 1;
          }
        }
        lastGroupId = groupId;
        toml += "\n";
        toml += `[${groupCourses[0].subject}.courses.${groupCourses[0].number}.groups.${groupId}]\n`;
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
console.warn(
  "Largest section group number",
  largestSectionNum.toString().padStart(3, "0")
);
