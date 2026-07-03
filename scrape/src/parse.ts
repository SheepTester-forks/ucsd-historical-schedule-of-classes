/**
 * @file
 * Usage: node src/parse.ts (inside scrape/)
 *
 * Assumes src/index.ts has already been run
 */

import { readFile } from "node:fs/promises";

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
      type: "after-course";
      canEnd: boolean;
      department: Department;
      subject: Subject;
    }
  | {
      type: "start-course";
      department: Department;
      subject: Subject;
    }
  | {
      type: "";
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

function processLine(state: State, line: string): State | null {
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
      return { ...state, type: "after-course", canEnd: false };
    }
  }
  if (state.type === "after-course") {
    if (line === "<tr>") {
      return { ...state, type: "start-course" };
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
  if (state.type === "start-course") {
    if (line === '<td colspan="13">') {
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
    if (line === '<td class="crsheader">') {
      //
    }
  }
  return null;
}

const lines = (await readFile(".cache/SA04/_all/39.html", "utf-8"))
  .split(/\r?\n/)
  .slice(1);
let state: State = initState;
for (const [i, line] of lines.entries()) {
  const next = processLine(state, line);
  if (!next) {
    console.error("Unexpected line for state");
    console.error(state);
    console.error(`${i + 2}: ${line}`);
    process.exit(1);
  }
  state = next;
}
