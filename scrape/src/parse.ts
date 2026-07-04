/**
 * @file
 * Usage: node src/parse.ts (inside scrape/)
 *
 * Assumes src/index.ts has already been run
 */

import { readFile } from "node:fs/promises";

type GlobalOptions = {
  isSummer: boolean;
  termYear: number;
};

type Department = {
  name: string;
  subjects: Subject[];
};
type Subject = {
  name: string;
  code: string;
  asOf: {
    month: number;
    date: number;
    year: number;
    hour: number;
    minute: number;
  };
  courses: Course[];
};
type Course = {
  restriction: { title: string; letter: string } | null;
  catalogHash: string;
  title: string;
  units: { start: number; end: { step: number; end: number } | null };
  summerRange: {
    term: 1 | 2 | "special" | "med" | null;
    start: { month: string; date: number };
    end: { month: string; date: number };
  } | null;
};

type State = (
  | {
      type: "before-heading";
      next: "tr" | "td" | "br" | "h2";
      department: Department | null;
    }
  | {
      type: "as-of";
      department: Department;
      subject: string;
      subjectCode: string;
    }
  | { type: "as-of-br-br"; department: Department; subject: Subject }
  | {
      type: "after-heading";
      next: "td" | "tr" | "idk";
      wasFrom:
        | { type: "dept"; name: string }
        | { type: "subject"; department: Department; subject: Subject };
    }
  | {
      type: "table-header";
      next:
        | "r"
        | "br"
        | "r-link"
        | "course-num"
        | "section-id"
        | "meeting-type"
        | "section"
        | "days"
        | "time"
        | "building-room"
        | "instructor"
        | "seats"
        | "empty"
        | "close-first"
        | "open-second"
        | "available"
        | "limit"
        | "close-final";
      department: Department;
      subject: Subject;
    }
  | {
      type: "after-course-tr";
      canEnd: boolean;
      department: Department;
      subject: Subject;
    }
  | {
      type: "start-course-td";
      department: Department;
      subject: Subject;
      canEndSubject: boolean;
    }
  | {
      type: "restrictions-title-next";
      department: Department;
      subject: Subject;
    }
  | {
      type: "restrictions-letter-next";
      department: Department;
      subject: Subject;
      title: string;
    }
  | {
      type: "restrictions-td-close-next" | "course-number-next";
      department: Department;
      subject: Subject;
      restriction: { title: string; letter: string } | null;
    }
  | {
      type: "course-num-end-next" | "course-name-next";
      department: Department;
      subject: Subject;
      restriction: { title: string; letter: string } | null;
      number: string;
    }
  | {
      type: "unit-start-next";
      department: Department;
      subject: Subject;
      restriction: { title: string; letter: string } | null;
      catalogDept: string;
      catalogHash: string;
      title: string;
    }
  | {
      type: "unit-end-next" | "unit-end-br-next" | "unit-end-summer-next";
      department: Department;
      subject: Subject;
      restriction: { title: string; letter: string } | null;
      catalogHash: string;
      title: string;
      start: number;
      end: { step: number; end: number } | null;
    }
  | {
      type: "course-header-end-next";
      department: Department;
      subject: Subject;
      course: Course;
    }
  | {
      type: "ready-for-meeting";
      department: Department;
      subject: Subject;
      course: Course;
      canEnd: boolean;
    }
  | { type: "done" }
) & {
  departments: Department[];
};

const initState: State = {
  type: "before-heading",
  next: "tr",
  department: null,
  departments: [],
};

function processLine(
  state: State,
  line: string,
  options: GlobalOptions,
): State | null {
  if (state.type === "before-heading") {
    if (state.next === "tr" && line === "<tr>") {
      return { ...state, next: "td" };
    }
    if (state.next === "td" && line === '<td colspan="13">') {
      return { ...state, next: "br" };
    }
    if (state.next === "br" && line === "<br>") {
      return { ...state, next: "h2" };
    }
    if (state.next === "h2") {
      const matchDept = line.match(
        /^<h2> <span class="centeralign">([A-Za-z ]{35})<\/span> <\/h2>$/,
      );
      const matchSubject = line.match(
        /^<h2>  <span class="centeralign">([A-Za-z ]{30}) \(([A-Z ]{5})\)<\/span> <\/h2>$/,
      );
      if (matchDept) {
        return {
          ...state,
          type: "after-heading",
          next: "td",
          departments:
            state.department !== null
              ? [...state.departments, state.department]
              : state.departments,
          wasFrom: { type: "dept", name: matchDept[1].trimEnd() },
        };
      }
      if (matchSubject && state.department !== null) {
        return {
          ...state,
          type: "as-of",
          department: state.department,
          subject: matchSubject[1].trimEnd(),
          subjectCode: matchSubject[2].trimEnd(),
        };
      }
    }
  }
  if (state.type === "as-of") {
    const match = line.match(
      /<span class="centeralign"><span class="bold_text">As of: ([01]\d)\/([0-3]\d)\/(20[012]\d), ([012]\d):([0-5]\d):00<\/span><\/span>/,
    );
    if (match) {
      const [month, date, year, hour, minute] = match.slice(1).map(Number);
      return {
        ...state,
        type: "as-of-br-br",
        subject: {
          name: state.subject,
          code: state.subjectCode,
          asOf: { month, date, year, hour, minute },
          courses: [],
        },
      };
    }
  }
  if (state.type === "as-of-br-br" && line === "<br><br>") {
    return {
      ...state,
      type: "after-heading",
      next: "td",
      wasFrom: {
        type: "subject",
        department: state.department,
        subject: state.subject,
      },
    };
  }
  if (state.type === "after-heading") {
    if (state.next === "td" && line === "</td>") {
      return { ...state, next: "tr" };
    }
    if (state.next === "tr" && line === "</tr>") {
      return { ...state, next: "idk" };
    }
    if (state.next === "idk") {
      if (line === "<tr>" && state.wasFrom.type === "dept") {
        return {
          ...state,
          type: "before-heading",
          next: "td",
          department: { name: state.wasFrom.name, subjects: [] },
        };
      }
      if (line === "<tr >" && state.wasFrom.type === "subject") {
        return {
          type: "table-header",
          next: "r",
          departments: state.departments,
          department: state.wasFrom.department,
          subject: state.wasFrom.subject,
        };
      }
    }
  }
  if (state.type === "table-header") {
    if (state.next === "r" && line === '<td class="ubrdr" rowspan="2" >R') {
      return { ...state, next: "br" };
    }
    if (state.next === "br" && line === "<br>") {
      return { ...state, next: "r-link" };
    }
    if (
      state.next === "r-link" &&
      line ===
        '<span onmouseover="" style="cursor: pointer;" class="icon info" onclick="javascript:openNewWindow(\'http://registrar.ucsd.edu/StudentLink/rstr_codes.html\', \'info\')" title="info"></span></a></td>'
    ) {
      return { ...state, next: "course-num" };
    }
    if (
      state.next === "course-num" &&
      line === '<td class="ubrdr"  rowspan="2" >Course Number</td>'
    ) {
      return { ...state, next: "section-id" };
    }
    if (
      state.next === "section-id" &&
      line ===
        '<td class="ubrdr"  rowspan="2" >Section ID<br><span onmouseover="" style="cursor: pointer;"  class="icon info" onclick="javascript:openNewWindow(\'http://registrar.ucsd.edu/StudentLink/id_crse_codes.html\', \'info\')" title="info"></span></td>'
    ) {
      return { ...state, next: "meeting-type" };
    }
    if (
      state.next === "meeting-type" &&
      line ===
        '<td class="ubrdr"  rowspan="2" >Meeting Type<br><span onmouseover="" style="cursor: pointer;" class="icon info" onclick="javascript:openNewWindow(\'http://registrar.ucsd.edu/StudentLink/instr_codes.html\', \'info\')" title="info"></span></td>'
    ) {
      return { ...state, next: "section" };
    }
    if (
      state.next === "section" &&
      line === '<td class="ubrdr"  rowspan="2" >Section</td>'
    ) {
      return { ...state, next: "days" };
    }
    if (
      state.next === "days" &&
      line === '<td class="ubrdr"  rowspan="2" >Days</td>'
    ) {
      return { ...state, next: "time" };
    }
    if (
      state.next === "time" &&
      line === '<td class="ubrdr"  rowspan="2" >Time</td>'
    ) {
      return { ...state, next: "building-room" };
    }
    if (
      state.next === "building-room" &&
      line ===
        '<td class="ubrdr"  rowspan="2" colspan="2" >Building & Room<br><span onmouseover="" style="cursor: pointer;" class="icon info" onclick="javascript:openNewWindow(\'http://registrar.ucsd.edu/StudentLink/bldg_codes.html\', \'info\')" title="info"></span></td>'
    ) {
      return { ...state, next: "instructor" };
    }
    if (
      state.next === "instructor" &&
      line === '<td class="ubrdr"  rowspan="2" >Instructor</td>'
    ) {
      return { ...state, next: "seats" };
    }
    if (
      state.next === "seats" &&
      line ===
        '<td class="ubrdr"  colspan="2" >Seats<span onmouseover="" style="cursor: pointer;" class="icon info" onclick="javascript:openNewWindow(\'http://registrar.ucsd.edu/StudentLink/avail_limit.html\', \'info\')" title="info"></span></td>'
    ) {
      return { ...state, next: "empty" };
    }
    if (
      state.next === "empty" &&
      line === '<td class="ubrdr"  rowspan="2" >&nbsp;</td>'
    ) {
      return { ...state, next: "close-first" };
    }
    if (state.next === "close-first" && line === "</tr>") {
      return { ...state, next: "open-second" };
    }
    if (state.next === "open-second" && line === "<tr>") {
      return { ...state, next: "available" };
    }
    if (
      state.next === "available" &&
      line === '<td class="ubrdr" >Available</td>'
    ) {
      return { ...state, next: "limit" };
    }
    if (state.next === "limit" && line === '<td class="ubrdr" >Limit</td>') {
      return { ...state, next: "close-final" };
    }
    if (state.next === "close-final" && line === "</tr>") {
      return { ...state, type: "after-course-tr", canEnd: false };
    }
  }
  if (state.type === "after-course-tr") {
    if (line === "<tr>") {
      return { ...state, type: "start-course-td", canEndSubject: state.canEnd };
    }
    if (line === "" && state.canEnd) {
      return {
        type: "done",
        departments: [
          ...state.departments,
          {
            ...state.department,
            subjects: [...state.department.subjects, state.subject],
          },
        ],
      };
    }
  }
  if (state.type === "start-course-td") {
    if (line === '<td colspan="13">' && state.canEndSubject) {
      return {
        ...state,
        type: "before-heading",
        next: "br",
        department: {
          ...state.department,
          subjects: [...state.department.subjects, state.subject],
        },
      };
    }
    // crsheader = dark blue
    if (line === '<td class="crsheader">') {
      return { ...state, type: "restrictions-title-next" };
    }
    if (line === '<td class="crsheader"></td>') {
      // no requirements
      return { ...state, type: "course-number-next", restriction: null };
    }
  }
  if (state.type === "restrictions-title-next") {
    const match = line.match(/^<span id="crsRestCd" title="[A-Za-z ]+">$/);
    if (match) {
      return { ...state, type: "restrictions-letter-next", title: match[1] };
    }
  }
  if (state.type === "restrictions-letter-next") {
    const match = line.match(/^(D)<\/span><br>$/);
    if (match) {
      return {
        ...state,
        type: "restrictions-td-close-next",
        restriction: { title: state.title, letter: match[1] },
      };
    }
  }
  if (state.type === "restrictions-td-close-next" && line === "</td>") {
    return { ...state, type: "course-number-next" };
  }
  if (state.type === "course-number-next") {
    const match = line.match(
      /^<td class="crsheader">(\d{1,3}[A-Z]{0,2})<\/td>$/,
    );
    if (match) {
      return { ...state, type: "course-num-end-next", number: match[1] };
    }
  }
  if (
    state.type === "course-num-end-next" &&
    line === '<td  class="crsheader" colspan="5">'
  ) {
    return { ...state, type: "course-name-next" };
  }
  if (state.type === "course-name-next") {
    const match = line.match(
      /^<a href="javascript:openNewWindow\('http:\/\/www\.ucsd\.edu\/catalog\/courses\/([A-Z]{2,5})\.html#([a-z]{2,5}\d{1,3}[a-z]{0,2})'\)"><span class="boldtxt">([A-Za-z ]{30})<\/span> <\/a>$/,
    );
    if (match) {
      return {
        ...state,
        type: "unit-start-next",
        catalogDept: match[1],
        catalogHash: match[2],
        title: match[3],
      };
    }
  }
  if (state.type === "unit-start-next") {
    const match = line.match(/^\( (\d)$/);
    if (match) {
      return { ...state, type: "unit-end-next", start: +match[1], end: null };
    }
  }
  if (state.type === "unit-end-next") {
    const match = line.match(/^\/(4) by (2)$/);
    if (match && !state.end) {
      return { ...state, end: { step: +match[1], end: +match[2] } };
    }
    if (line === "Units)") {
      return { ...state, type: "unit-end-br-next" };
    }
  }
  if (state.type === "unit-end-br-next" && line === "<br>") {
    if (options.isSummer) {
      return { ...state, type: "unit-end-summer-next" };
    } else {
      return {
        type: "course-header-end-next",
        departments: state.departments,
        department: state.department,
        subject: state.subject,
        course: {
          restriction: state.restriction,
          catalogHash: state.catalogHash,
          title: state.title,
          units: { start: state.start, end: state.end },
          summerRange: null,
        },
      };
    }
  }
  if (state.type === "unit-end-summer-next") {
    const match = line.match(
      /^(Sum Sess I|Sum Ses II|SpecSumSes|Summer Qtr)?:&nbsp;([A-Z][a-z]+) ([0-3]\d) (\d{4})&nbsp;-&nbsp;([A-Z][a-z]+) ([0-3]\d) (\d{4})$/,
    );
    if (match) {
      const [
        ,
        summerType,
        startMonth,
        startDate,
        startYear,
        endMonth,
        endDate,
        endYear,
      ] = match;
      // TODO: can we enforce that this is present after a particular year
      const parsedType =
        summerType === "Sum Sess I"
          ? 1
          : summerType === "Sum Ses II"
            ? 2
            : summerType === "SpecSumSes"
              ? "special"
              : summerType === "Summer Qtr"
                ? "med"
                : summerType === undefined
                  ? null
                  : "idk";
      if (
        parsedType !== "idk" &&
        +startYear === options.termYear &&
        +endYear === options.termYear
      ) {
        return {
          type: "course-header-end-next",
          departments: state.departments,
          department: state.department,
          subject: state.subject,
          course: {
            restriction: state.restriction,
            catalogHash: state.catalogHash,
            title: state.title,
            units: { start: state.start, end: state.end },
            summerRange: {
              term: parsedType,
              start: { month: startMonth, date: +startDate },
              end: { month: endMonth, date: +endDate },
            },
          },
        };
      }
    }
  }
  if (state.type === "course-header-end-next" && line === "</td>") {
    return { ...state, type: "ready-for-meeting", canEnd: false };
  }
  if (
    state.type === "ready-for-meeting" &&
    line === '<td  class="crsheader" colspan="6" align="right">'
  ) {
    //
  }
  return null;
}

const lines = (await readFile(".cache/SA04/_all/39.html", "utf-8"))
  .split(/\r?\n/)
  .slice(1);
let state: State = initState;
for (const [i, line] of lines.entries()) {
  const next = processLine(state, line, { isSummer: true, termYear: 2004 });
  if (!next) {
    console.error("Unexpected line for state");
    console.error(state);
    console.error(`${i + 2}: ${line}`);
    process.exit(1);
  }
  state = next;
}
