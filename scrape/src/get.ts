import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import z from "zod";

async function cachedFetch(
  displayName: string,
  url: string,
  cachePath: string,
): Promise<string> {
  const cached = await readFile(cachePath, "utf-8").catch((cause) =>
    cause instanceof Error && "code" in cause && cause.code === "ENOENT"
      ? null
      : Promise.reject(
          new Error(`Failed to read cached ${displayName} (${cachePath})`, {
            cause,
          }),
        ),
  );
  if (cached !== null) {
    return cached;
  }
  const response = await fetch(url)
    .catch((cause) =>
      Promise.reject(
        new Error(`Failed to fetch ${displayName} (${url})`, { cause }),
      ),
    )
    .then((r) =>
      r.ok
        ? r.text()
        : Promise.reject(
            new Error(
              `Received HTTP ${r.status}: ${r.statusText} at ${displayName} (${url})`,
            ),
          ),
    );
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, response);
  return response;
}

const BASE = "https://act.ucsd.edu/scheduleOfClasses";

/**
 * Example:
 * https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=SP26&tabNum=tabs-dept&selectedDepartments=ANTH&page=13
 */
const getResultPath = (term: string, departments: string[], page: number) =>
  `${BASE}/scheduleOfClassesStudentResult.htm?${new URLSearchParams([
    ["selectedTerm", term],
    ["tabNum", "tabs-dept"],
    ...departments.map((department) => ["selectedDepartments", department]),
    ["page", String(page)],
  ])}`;

export function getResultsHtml(
  term: string,
  departments: string[],
  page: number,
): Promise<string> {
  return cachedFetch(
    `${term} ${departments.join(", ")} page ${page}`,
    getResultPath(term, departments, page),
    join(
      ".cache",
      term,
      departments.length > 1 ? "_all" : departments[0],
      `${page}.html`,
    ),
  );
}

/**
 * Example:
 * https://act.ucsd.edu/scheduleOfClasses/department-list.json?selectedTerm=SP26
 */
const getDepartmentsUrl = (selectedTerm: string) =>
  `${BASE}/department-list.json?${new URLSearchParams({ selectedTerm })}`;

const departmentItemSchema = z.strictObject({
  /** Department code */
  code: z.string(),
  /** Department name */
  value: z.string(),
});
const departmentItemListSchema = z.array(departmentItemSchema);

export async function getDepartments(
  term: string,
): Promise<z.infer<typeof departmentItemListSchema>> {
  const name = `${term} departments`;
  const json = await cachedFetch(
    name,
    getDepartmentsUrl(term),
    join(".cache", term, `_departments.json`),
  );
  try {
    return departmentItemListSchema.parse(JSON.parse(json));
  } catch (cause) {
    throw new Error(`Failed to parse response of ${name}`, { cause });
  }
}
