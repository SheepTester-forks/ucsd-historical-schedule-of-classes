/**
 * @file
 * Usage: node src/parse.ts (inside scrape/)
 *
 * Assumes src/index.ts has already been run
 */

import { readFile } from "node:fs/promises";

type State =
  | {
      type: "before-heading";
      next: "tr" | "td" | "br" | "h2";
      cannotBe: "subject" | "dept" | null;
    }
  | { type: "as-of" }
  | { type: "as-of-br-br" }
  | {
      type: "after-heading";
      next: "td" | "tr" | "idk";
      wasFrom: "subject" | "dept";
    }
  | {
      type: "table-header";
      next:
        | "tr"
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
    };

const initState: State = {
  type: "before-heading",
  next: "tr",
  cannotBe: "subject",
};

function processLine(state: State, line: string): State | null {
  if (state.type === "before-heading") {
    if (state.next === "tr" && line === "<tr>") {
      return { ...state, next: "td" };
    }
    if (state.next === "td" && line === '<td colspan="13">') {
      return { ...state, next: "br" };
    }
    if (state.next === "td" && line === "<br>") {
      return { ...state, next: "h2" };
    }
    if (state.next === "h2") {
      const matchDept = line.match(
        /^<h2> <span class="centeralign">([A-Za-z ]{35})<\/span> <\/h2>$/,
      );
      const matchSubject = line.match(
        /^<h2>  <span class="centeralign">([A-Za-z ]{30}) \(([A-Z ]{5})\)<\/span> <\/h2>$/,
      );
      if (matchDept && state.cannotBe !== "dept") {
        return { type: "after-heading", next: "td", wasFrom: "dept" };
      }
      if (matchSubject && state.cannotBe !== "subject") {
        return { type: "as-of" };
      }
    }
  }
  if (state.type === "as-of") {
    const match = line.match(
      /<span class="centeralign"><span class="bold_text">As of: [01]\d\/[0-3]\d\/20[012]\d, [012]\d:[0-5]\d:00<\/span><\/span>/,
    );
    if (match) {
      return { type: "as-of-br-br" };
    }
  }
  if (state.type === "as-of-br-br" && line === "<br><br>") {
    const match = line.match(
      /<span class="centeralign"><span class="bold_text">As of: [01]\d\/[0-3]\d\/20[012]\d, [012]\d:[0-5]\d:00<\/span><\/span>/,
    );
    if (match) {
      return { type: "after-heading", next: "td", wasFrom: "subject" };
    }
  }
  if (state.type === "after-heading") {
    if (state.next === "td" && line === "</td>") {
      return { ...state, next: "tr" };
    }
    if (state.next === "tr" && line === "</tr>") {
      return { ...state, next: "idk" };
    }
    if (state.next === "idk") {
      if (line === "<tr>" && state.wasFrom === "dept") {
        return { type: "before-heading", next: "tr", cannotBe: "dept" };
      }
      if (line === "<tr >" && state.wasFrom === "subject") {
        return { type: "table-header", next: "tr" };
      }
    }
  }
  if (state.type === "table-header") {
    if (state.next === "tr" && line === "<tr >") {
      return { ...state, next: "r" };
    }
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
      return { type: "TODO" };
    }
  }
  return null;
}

const lines = (await readFile(".cache/SA04/_all/1.html", "utf-8"))
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
