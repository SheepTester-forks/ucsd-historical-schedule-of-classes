import z from "zod";

const BASE = "https://act.ucsd.edu/scheduleOfClasses";

// https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudentResult.htm?selectedTerm=SP26&tabNum=tabs-dept&selectedDepartments=ANTH&page=13
const getResultPath = (term: string, departments: string[], page: number) =>
  `${BASE}/scheduleOfClassesStudentResult.htm?${new URLSearchParams([
    ["selectedTerm", term],
    ["tabNum", "tabs-dept"],
    ...departments.map((department) => ["selectedDepartments", department]),
    ["page", String(page)],
  ])}`;

export const getResultsHtml = (
  term: string,
  departments: string[],
  page: number,
) => {
  const url = getResultPath(term, departments, page);
  const name = `${term} ${departments.join(", ")} page ${page} (${url})`;
  return fetch(url)
    .catch((cause) =>
      Promise.reject(new Error(`Failed to fetch ${name}`, { cause })),
    )
    .then((r) =>
      r.ok
        ? r.text()
        : Promise.reject(
            new Error(`Received HTTP ${r.status}: ${r.statusText} at ${name}`),
          ),
    );
};

const getDepartmentsUrl = (selectedTerm: string) =>
  `${BASE}/department-list.json?${new URLSearchParams({ selectedTerm })}`;

const departmentItemSchema = z.strictObject({
  code: z.string(),
  value: z.string(),
});
const departmentItemListSchema = z.array(departmentItemSchema);

export const getDepartments = (term: string) => {
  const url = getDepartmentsUrl(term);
  const name = `${term} departments (${url})`;
  return fetch(url)
    .catch((cause) =>
      Promise.reject(new Error(`Failed to fetch ${name}`, { cause })),
    )
    .then((r) =>
      r.ok
        ? r.json()
        : Promise.reject(
            new Error(
              `Received HTTP ${r.status}: ${r.statusText} from ${name}`,
            ),
          ),
    )
    .then((json) => {
      try {
        return departmentItemListSchema.parse(json);
      } catch (cause) {
        throw new Error(`Failed to parse response of ${name}`, { cause });
      }
    });
};
