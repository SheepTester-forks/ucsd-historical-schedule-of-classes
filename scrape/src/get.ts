import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import z from "zod";
import { ConcurrencyLimiter } from "./util.ts";

/**
 * Signals that I was ratelimited or something and it should be good to retry
 */
export class FetchError extends Error {
  name = this.constructor.name;
}

const fetchConcurrencyLimit = new ConcurrencyLimiter(32);

async function cachedFetch(
  displayName: string,
  url: string,
  cachePath: string,
  preprocess?: (original: string) => string,
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

  let response;
  {
    using stack = new DisposableStack();
    stack.use(await fetchConcurrencyLimit.acquire());
    response = await fetch(url)
      .catch((cause) =>
        Promise.reject(
          new FetchError(`Failed to fetch ${displayName} (${url})`, { cause }),
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
  }
  await mkdir(dirname(cachePath), { recursive: true });
  if (preprocess) {
    try {
      response = preprocess(response);
    } catch (cause) {
      throw new Error(
        `Error happened during preprocessing of ${displayName} (${url})`,
        { cause },
      );
    }
  }
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
  if (departments.length === 0) {
    throw new Error("Departments is empty");
  }
  return cachedFetch(
    `${term} ${departments.join(", ")} page ${page}`,
    getResultPath(term, departments, page),
    join(
      ".cache",
      term,
      departments.length > 1 ? "_all" : departments[0],
      `${page}.html`,
    ),
    (html) => {
      const pageCountMatch = html.match(
        /\bPage  \(\d+&nbsp;of&nbsp;\d+\) &nbsp;/,
      );
      if (!pageCountMatch) {
        throw new Error("Can't find paginator");
      }
      const tableMatch = html.match(
        /<table  width="100%" class="tbrdr">\s*<thead>\s*<\/thead>([^]*?)<\/table>/,
      );
      if (!tableMatch) {
        throw new Error("Can't find table");
      }
      if (/<\/?table[\s>]/.test(tableMatch[1])) {
        throw new Error("I seem to have found a nested table");
      }
      return (
        pageCountMatch[0] +
        "\n" +
        tableMatch[1]
          .replace(/^[ \t\u00a0]+|[ \t\u00a0]+$/gm, "")
          .replace(/(?:\r?\n)+/g, "\n")
          .trim() +
        "\n"
      );
    },
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
    throw new Error(`Failed to parse response of ${name}`, {
      cause,
    });
  }
}
