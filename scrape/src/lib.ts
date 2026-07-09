const quarters = ["WI", "SP", "SA", "FA"] as const;
export type Quarter = (typeof quarters)[number];
export function* terms(): Generator<{
  deptTerms: string[];
  paginateTerm: string;
  quarter: Quarter;
  year: number;
}> {
  for (let year = 1995; year <= 2026; year++) {
    for (const quarter of quarters) {
      const yearShort = (year % 100).toString().padStart(2, "0");
      const termCode = `${quarter}${yearShort}` as const;
      if (termCode === "FA26") {
        continue;
      }
      if (quarter === "SA") {
        yield {
          // It seems that while SAxx terms exist for pagination,
          // departments.json is only defined for the specific term codes
          deptTerms: [
            `S1${yearShort}`,
            `S2${yearShort}`,
            `S3${yearShort}`,
            `SU${yearShort}`,
          ],
          paginateTerm: termCode,
          quarter,
          year,
        };
      } else {
        yield { deptTerms: [termCode], paginateTerm: termCode, quarter, year };
      }
    }
  }
}
