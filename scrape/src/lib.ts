export function* terms(): Generator<{
  deptTerms: string[];
  paginateTerm: string;
}> {
  for (let year = 1995; year <= 2026; year++) {
    for (const term of ["WI", "SP", "SA", "FA"]) {
      const yearShort = (year % 100).toString().padStart(2, "0");
      const termCode = `${term}${yearShort}`;
      if (termCode === "FA26") {
        continue;
      }
      if (term === "SA") {
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
        };
      } else {
        yield { deptTerms: [termCode], paginateTerm: termCode };
      }
    }
  }
}
