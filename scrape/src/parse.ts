/**
 * @file
 * Usage: node src/parse.ts (inside scrape/)
 *
 * Assumes src/index.ts has already been run
 */

import { readFile } from "node:fs/promises";

type GlobalOptions = {
  termYear: number;
  quarter: "FA" | "WI" | "SP" | "SA";
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
  restriction: string | null;
  number: string;
  catalog: { dept: string; hash: string };
  title: string;
  units: { start: number; end: { step: number; end: number } | null };
  summerRange: {
    term: 1 | 2 | "special" | "med" | null;
    start: { month: string; date: number };
    end: { month: string; date: number };
  } | null;
  resourcesSectionId: number;
  meetings: (Meeting | CancelledMeeting)[];
};
type Meeting = {
  cancelled: false;
  instructionType: keyof typeof instructionTypes;
  sectionCode: string;
  location: {
    // TODO: narrow
    days: string;
    time: string;
    building: string;
    room: string;
  } | null;
  instructor: { name: string; encryptedPid: Buffer } | null;
  enrollable: {
    sectionId: number;
    limit:
      | {
          type: "waitlist";
          waitlist: number;
          limit: number;
        }
      | { type: "unlimited" }
      | {
          type: "available";
          available: number;
          limit: number;
        };
  } | null;
  comment: string;
};
type CancelledMeeting = {
  cancelled: true;
  sectionId: number;
  instructionType: keyof typeof instructionTypes;
  sectionCode: string;
  comment: string;
};

const instructionTypes = {
  LE: "Lecture",
  DI: "Discussion",
  LA: "Laboratory",
  IN: "Independent Study",
  SE: "Seminar",
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
        | { type: "dept"; name: string; comment: string }
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
      course: Pick<Course, "restriction">;
    }
  | {
      type: "course-num-end-next" | "course-name-next";
      department: Department;
      subject: Subject;
      course: Pick<Course, "restriction" | "number">;
    }
  | {
      type: "unit-start-next";
      department: Department;
      subject: Subject;
      course: Pick<Course, "restriction" | "number" | "catalog" | "title">;
    }
  | {
      type: "unit-end-next" | "unit-end-br-next" | "unit-end-summer-next";
      department: Department;
      subject: Subject;
      course: Pick<
        Course,
        "restriction" | "number" | "catalog" | "title" | "units"
      >;
    }
  | {
      type:
        | "course-header-end-next"
        | "ready-for-course-number-links"
        | "prereq-next"
        | "resources-next";
      department: Department;
      subject: Subject;
      course: Pick<
        Course,
        "restriction" | "number" | "catalog" | "title" | "units" | "summerRange"
      >;
    }
  | {
      type: "evals-next" | "close-course-links-next";
      department: Department;
      subject: Subject;
      course: Pick<
        Course,
        | "restriction"
        | "number"
        | "catalog"
        | "title"
        | "units"
        | "summerRange"
        | "resourcesSectionId"
      >;
    }
  | {
      type: "meeting-row-begin-next";
      department: Department;
      subject: Subject;
      course: Course;
      prevMeeting: Meeting | CancelledMeeting | null;
    }
  | {
      type:
        | "borderless-brdr-next"
        | "brdr-begin-next"
        | "brdr-end-next"
        | "brdr-section-id-begin-next";
      department: Department;
      subject: Subject;
      course: Course;
    }
  | {
      type: "brdr-section-id-end-next" | "instruction-type-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null;
    }
  | {
      type: "section-code-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null;
      meeting: Pick<Meeting, "instructionType">;
    }
  | {
      type: "days-or-tba-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null;
      meeting: Pick<Meeting, "instructionType" | "sectionCode">;
    }
  | {
      type: "time-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null;
      meeting: Pick<Meeting, "instructionType" | "sectionCode">;
      days: string;
    }
  | {
      type: "building-start-next" | "building-link-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null;
      meeting: Pick<Meeting, "instructionType" | "sectionCode">;
      days: string;
      time: string;
    }
  | {
      type: "building-code-next" | "room-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null;
      meeting: Pick<Meeting, "instructionType" | "sectionCode">;
      days: string;
      time: string;
      building: string;
    }
  | {
      type: "instructor-begin-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null;
      meeting: Pick<Meeting, "instructionType" | "sectionCode" | "location">;
    }
  | {
      type: "instructor-end-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null;
      meeting: Pick<
        Meeting,
        "instructionType" | "sectionCode" | "location" | "instructor"
      >;
      shouldSeeBr: boolean;
    }
  | {
      type: "non-enrollable-skip";
      skip: 3 | 2 | 1;
      department: Department;
      subject: Subject;
      course: Course;
      meeting: Meeting;
    }
  | {
      type: "available-next" | "waitlist-count-next" | "unlim-empty-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number;
      meeting: Pick<
        Meeting,
        "instructionType" | "sectionCode" | "location" | "instructor"
      >;
    }
  | {
      type: "limit-next" | "waitlist-end-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number;
      meeting: Pick<
        Meeting,
        "instructionType" | "sectionCode" | "location" | "instructor"
      >;
      count: number;
      isWaitlist: boolean;
    }
  | {
      type:
        | "book-link-next"
        | "book-gif-next"
        | "book-span-next"
        | "book-close-next";
      department: Department;
      subject: Subject;
      course: Course;
      meeting: Meeting;
    }
  | {
      type:
        | "meeting-row-end-next"
        | "white-meeting-start-or-meeting-comment"
        | "meeting-comment-begin-next"
        | "meeting-comment-next";
      department: Department;
      subject: Subject;
      course: Course;
      meeting: Meeting | CancelledMeeting;
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
  const isSummer = options.quarter === "SA";
  const year2Digit = (options.termYear % 100).toString().padStart(2, "0");
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
      const matchSubject = line
        .replaceAll("&amp;", "&")
        .match(
          /^<h2>  <span class="centeralign">([A-Za-z&/ ]{30}) \(([A-Z ]{5})\)<\/span> <\/h2>$/,
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
          wasFrom: { type: "dept", name: matchDept[1].trimEnd(), comment: "" },
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
    if (state.next === "td") {
      if (state.wasFrom.type === "dept") {
        if (line === "<br>") {
          if (!state.wasFrom.comment) {
            return state;
          }
        } else if (line !== "</td>") {
          return {
            ...state,
            wasFrom: {
              ...state.wasFrom,
              comment:
                (state.wasFrom.comment ? state.wasFrom.comment + "\n" : "") +
                line,
            },
          };
        }
      }
      if (state.next === "td" && line === "</td>") {
        return { ...state, next: "tr" };
      }
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
      return {
        ...state,
        type: "course-number-next",
        course: { restriction: null },
      };
    }
  }
  if (state.type === "restrictions-title-next") {
    const match = line.match(
      /^<span id="crsRestCd" title="([A-Za-z\-() ]+)">$/,
    );
    if (match) {
      return { ...state, type: "restrictions-letter-next", title: match[1] };
    }
  }
  if (state.type === "restrictions-letter-next") {
    const match = line.match(/^([DO])<\/span><br>$/);
    if (match) {
      // TODO: check against state.title
      // - D: Department Approval Required
      // - O: Open to Majors Only (Non-majors require department approval)
      return {
        ...state,
        type: "restrictions-td-close-next",
        course: {
          restriction: match[1],
        },
      };
    }
  }
  if (state.type === "restrictions-td-close-next" && line === "</td>") {
    return { ...state, type: "course-number-next" };
  }
  if (state.type === "course-number-next") {
    // that second space seems to depend on whether there was a restriction
    const match = line.match(
      /^<td ( )?class="crsheader">(\d{1,3}[A-Z]{0,2})<\/td>$/,
    );
    if (match) {
      const extraSpace = !!match[1];
      const restrictionless = state.course.restriction === null;
      if (extraSpace === restrictionless) {
        return {
          ...state,
          type: "course-num-end-next",
          course: { ...state.course, number: match[2] },
        };
      }
    }
  }
  if (
    state.type === "course-num-end-next" &&
    line === '<td  class="crsheader" colspan="5">'
  ) {
    return { ...state, type: "course-name-next" };
  }
  if (state.type === "course-name-next") {
    const match = line
      .replaceAll("&amp;", "&")
      .match(
        /^<a href="javascript:openNewWindow\('http:\/\/www\.ucsd\.edu\/catalog\/courses\/([A-Z]{2,5})\.html#([a-z]{2,5}\d{1,3}[a-z]{0,2})'\)"><span class="boldtxt">([A-Za-z& ]{30})<\/span> <\/a>$/,
      );
    if (match) {
      return {
        ...state,
        type: "unit-start-next",
        course: {
          ...state.course,
          catalog: { dept: match[1], hash: match[2] },
          title: match[3].trim(),
        },
      };
    }
  }
  if (state.type === "unit-start-next") {
    const match = line.match(/^\( (\d)$/);
    if (match) {
      return {
        ...state,
        type: "unit-end-next",
        course: { ...state.course, units: { start: +match[1], end: null } },
      };
    }
  }
  if (state.type === "unit-end-next") {
    const match = line.match(/^\/(4) by (2)$/);
    if (match && !state.course.units.end) {
      return {
        ...state,
        course: {
          ...state.course,
          units: {
            start: state.course.units.start,
            end: { step: +match[1], end: +match[2] },
          },
        },
      };
    }
    if (line === "Units)") {
      return { ...state, type: "unit-end-br-next" };
    }
  }
  if (state.type === "unit-end-br-next" && line === "<br>") {
    if (isSummer) {
      return { ...state, type: "unit-end-summer-next" };
    } else {
      return {
        ...state,
        type: "course-header-end-next",
        course: { ...state.course, summerRange: null },
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
          ...state,
          type: "course-header-end-next",
          course: {
            ...state.course,
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
    return { ...state, type: "ready-for-course-number-links" };
  }
  if (
    state.type === "ready-for-course-number-links" &&
    line === '<td  class="crsheader" colspan="6" align="right">'
  ) {
    return { ...state, type: "prereq-next" };
  }
  if (state.type === "prereq-next") {
    const match = line.match(
      /^<span class="boldtxt" onmouseover="" style="cursor: pointer;" onclick="JavaScript:openNewWindow\('\/scheduleOfClasses\/scheduleOfClassesPreReq\.htm\?termCode=([FSW][API123U]\d\d)&courseId=([\dA-Z ]{9})'\);"> Prerequisites  <\/span> &nbsp;\|&nbsp;$/,
    );
    if (match) {
      let matches = match[1].slice(2) === year2Digit;
      if (isSummer) {
        matches &&= ["SU", "S1", "S2", "S3"].includes(match[1].slice(0, 2));
      } else {
        matches &&= match[1].slice(0, 2) === options.quarter;
      }
      matches &&= match[2].trim() === state.subject.code + state.course.number;
      if (matches) {
        return { ...state, type: "resources-next" };
      }
    }
  }
  if (state.type === "resources-next") {
    const match = line.match(
      /^<span class="boldtxt" onmouseover="" style="cursor: pointer;" onclick="javascript:openNewWindow\('http:\/\/courses\.ucsd\.edu\/coursemain\.asp\?section=(\d{6})'\)">Resources<\/span>&nbsp;\|&nbsp;$/,
    );
    if (match) {
      return {
        ...state,
        type: "evals-next",
        course: { ...state.course, resourcesSectionId: +match[1] },
      };
    }
  }
  if (state.type === "evals-next") {
    // I assume it won't be CAPE for more recent quarters
    const match = line.match(
      /^<span class="boldtxt" onmouseover="" style="cursor: pointer;" onclick="javascript:openNewTab\('https:\/\/academicaffairs\.ucsd\.edu\/Modules\/Evals\/SET\/Reports\/Search\.aspx\?courseNumber=([A-Z]{2,4})\+(\d{1,3}[A-Z]{0,2})','CAPE'\)"><span title="CAPE - Course and Professor Evaluations">Evaluations<\/span><\/span><\/td>$/,
    );
    if (
      match &&
      match[1] === state.subject.code &&
      match[2] === state.course.number
    ) {
      return { ...state, type: "close-course-links-next" };
    }
  }
  if (state.type === "close-course-links-next" && line === "</tr>") {
    return {
      type: "meeting-row-begin-next",
      departments: state.departments,
      department: state.department,
      subject: state.subject,
      course: { ...state.course, meetings: [] },
      prevMeeting: null,
    };
  }
  if (state.type === "meeting-row-begin-next") {
    if (line === "<tr>" && state.prevMeeting) {
      // could either be beginning of course or subject or department, which is
      // handled by this state i think
      return {
        type: "start-course-td",
        departments: state.departments,
        department: state.department,
        subject: {
          ...state.subject,
          courses: [...state.subject.courses, state.course],
        },
        canEndSubject: true,
      };
    }
    if (line === '<tr class="sectxt">') {
      return {
        ...state,
        type: "borderless-brdr-next",
        course: state.prevMeeting
          ? {
              ...state.course,
              meetings: [...state.course.meetings, state.prevMeeting],
            }
          : state.course,
      };
    }
    if (line === '<tr class="nonenrtxt">' && state.prevMeeting) {
      return {
        ...state,
        type: "white-meeting-start-or-meeting-comment",
        meeting: state.prevMeeting,
      };
    }
  }
  if (
    state.type === "borderless-brdr-next" &&
    line === '<td class="brdr" border="0"></td>'
  ) {
    return { ...state, type: "brdr-begin-next" };
  }
  if (state.type === "brdr-begin-next" && line === '<td class="brdr">') {
    return { ...state, type: "brdr-end-next" };
  }
  if (state.type === "brdr-end-next" && line === "</td>") {
    return { ...state, type: "brdr-section-id-begin-next" };
  }
  if (
    state.type === "brdr-section-id-begin-next" &&
    line === '<td class="brdr">'
  ) {
    return {
      ...state,
      type: "brdr-section-id-end-next",
      sectionId: null,
    };
  }
  if (state.type === "brdr-section-id-end-next") {
    const match = line.match(/^\d{5,6}$/);
    if (match && state.sectionId === null) {
      return { ...state, sectionId: +match[0] };
    }
    if (line === "</td>") {
      return { ...state, type: "instruction-type-next" };
    }
  }
  if (state.type === "instruction-type-next") {
    const match = line.match(
      /^<td class="brdr"><span id="insTyp" title="([A-Za-z ]+)">([A-Z]{2})<\/span><\/td>$/,
    );
    if (match) {
      const type = match[2];
      if (
        type === "LA" ||
        type === "LE" ||
        type === "IN" ||
        type === "DI" ||
        type === "SE"
      ) {
        if (match[1] === instructionTypes[type]) {
          return {
            ...state,
            type: "section-code-next",
            meeting: { instructionType: type },
          };
        }
      }
    }
  }
  if (state.type === "section-code-next") {
    const match = line.match(/^<td class="brdr">([A-Z]\d\d)<\/td>$/);
    if (match) {
      return {
        ...state,
        type: "days-or-tba-next",
        meeting: { ...state.meeting, sectionCode: match[1] },
      };
    }
  }
  if (state.type === "days-or-tba-next") {
    if (
      line ===
        '<td  class="brdr" colspan="8" align="center"><span class="ertext">Cancelled</span></td>' &&
      state.sectionId !== null
    ) {
      return {
        ...state,
        type: "meeting-row-end-next",
        meeting: {
          ...state.meeting,
          cancelled: true,
          sectionId: state.sectionId,
          comment: "",
        },
      };
    }
    if (line === '<td class="brdr" colspan="4" align="center">TBA</td>') {
      return {
        ...state,
        type: "instructor-begin-next",
        meeting: { ...state.meeting, location: null },
      };
    }
    const match = line.match(/^<td class="brdr">([A-Za-z ]{9})<\/td>$/);
    if (match) {
      return { ...state, type: "time-next", days: match[1] };
    }
  }
  if (state.type === "time-next") {
    const match = line.match(
      /^<td class="brdr">(1?\d:[03]0[ap]-1?\d:[25][09][ap])<\/td>$/,
    );
    if (match) {
      return { ...state, type: "building-start-next", time: match[1] };
    }
  }
  if (state.type === "building-start-next" && line === '<td class="brdr">') {
    return { ...state, type: "building-link-next" };
  }
  if (state.type === "building-link-next") {
    const match = line.match(
      /^<a href="https:\/\/maps\.ucsd\.edu\/\?id=1005#!s\/([A-Z]{3,5})_Main\?ct\/18312" target="_blank">$/,
    );
    if (match) {
      return { ...state, type: "building-code-next", building: match[1] };
    }
  }
  if (state.type === "building-code-next") {
    const match = line.match(/^([A-Z]{3}[A-Z ]{0,2})<\/a><\/td>$/);
    if (match && match[1] === state.building) {
      return { ...state, type: "room-next" };
    }
  }
  if (state.type === "room-next") {
    const match = line.match(/^<td class="brdr">([A-Z\d ]{5})<\/td>$/);
    if (match) {
      return {
        ...state,
        type: "instructor-begin-next",
        meeting: {
          ...state.meeting,
          location: {
            days: state.days,
            time: state.time,
            building: state.building,
            room: match[1],
          },
        },
      };
    }
  }
  if (state.type === "instructor-begin-next") {
    return {
      ...state,
      type: "instructor-end-next",
      shouldSeeBr: false,
      meeting: { ...state.meeting, instructor: null },
    };
  }
  if (state.type === "instructor-end-next") {
    if (state.shouldSeeBr) {
      if (line === "<br>") {
        return { ...state, shouldSeeBr: false };
      }
    } else {
      if (line === "</td>") {
        if (state.sectionId !== null) {
          return {
            ...state,
            type: "available-next",
            sectionId: state.sectionId,
          };
        } else {
          return {
            ...state,
            type: "non-enrollable-skip",
            skip: 3,
            meeting: {
              ...state.meeting,
              enrollable: null,
              cancelled: false,
              comment: "",
            },
          };
        }
      }
      const match = line.match(
        /^<a href="#!" onclick="javascript:sendMail\('\/scheduleOfClasses\/scheduleOfClassesFacultyEmailResult\.htm\?pid=([A-Za-z\d+/]+==)'\)">([A-Za-z,. ]{35})<\/a>$/,
      );
      if (match) {
        return {
          ...state,
          shouldSeeBr: true,
          meeting: {
            ...state.meeting,
            instructor: {
              encryptedPid: Buffer.from(match[1], "base64"),
              name: match[2].trim(),
            },
          },
        };
      }
    }
  }
  if (state.type === "non-enrollable-skip") {
    if (line === '<td  class="brdr"><span class="ertext">&nbsp;</span></td>') {
      if (state.skip === 1) {
        return { ...state, type: "meeting-row-end-next" };
      } else {
        return { ...state, skip: state.skip === 3 ? 2 : 1 };
      }
    }
  }
  if (state.type === "available-next") {
    if (line === '<td  class="brdr"><span class="ertext">FULL<br>') {
      return { ...state, type: "waitlist-count-next" };
    }
    if (line === '<td class="brdr">Unlim</td>') {
      return { ...state, type: "unlim-empty-next" };
    }
    const matchAvailable = line.match(/^<td class="brdr">(\d+)<\/td>$/);
    if (matchAvailable) {
      return {
        ...state,
        type: "limit-next",
        count: +matchAvailable[1],
        isWaitlist: false,
      };
    }
  }
  if (state.type === "waitlist-count-next") {
    const match = line.match(/^Waitlist\((\d+)\)$/);
    if (match) {
      return {
        ...state,
        type: "waitlist-end-next",
        count: +match[1],
        isWaitlist: true,
      };
    }
  }
  if (state.type === "waitlist-end-next" && line === "</span></td>") {
    return { ...state, type: "limit-next" };
  }
  if (state.type === "unlim-empty-next" && line === '<td class="brdr"></td>') {
    return {
      ...state,
      type: "book-link-next",
      meeting: {
        ...state.meeting,
        cancelled: false,
        enrollable: {
          limit: { type: "unlimited" },
          sectionId: state.sectionId,
        },
        comment: "",
      },
    };
  }
  if (state.type === "limit-next") {
    const match = line.match(/^<td class="brdr">(\d+)<\/td>$/);
    if (match) {
      const limit = +match[1];
      return {
        ...state,
        type: "book-link-next",
        meeting: {
          ...state.meeting,
          cancelled: false,
          enrollable: {
            limit: state.isWaitlist
              ? { type: "waitlist", waitlist: state.count, limit }
              : { type: "available", available: state.count, limit },
            sectionId: state.sectionId,
          },
          comment: "",
        },
      };
    }
  }
  if (
    state.type === "book-link-next" &&
    line ===
      '<td class="brdr"><span onmouseover="" style="cursor: pointer;" onclick="JavaScript:openNewWindow(\'https://www.bkstr.com/ucsdtextstore/shop/textbooks-and-course-materials\',\'bookstore\');">'
  ) {
    return { ...state, type: "book-gif-next" };
  }
  if (
    state.type === "book-gif-next" &&
    line ===
      '<img src="/scheduleOfClasses/images/book.gif" height="20" width="20"/>'
  ) {
    return { ...state, type: "book-span-next" };
  }
  if (state.type === "book-span-next" && line === "</span>") {
    return { ...state, type: "book-close-next" };
  }
  if (state.type === "book-close-next" && line === "</td>") {
    return { ...state, type: "meeting-row-end-next" };
  }
  if (state.type === "white-meeting-start-or-meeting-comment") {
    if (
      (line === '<td  class="brdr" colspan="2"></td>' ||
        line === '<td  class="brdr" colspan="2"></td>') &&
      !state.meeting.comment
    ) {
      return { ...state, type: "meeting-comment-begin-next" };
    }
    if (line === '<td  class="brdr" colspan="2" border="0"></td>') {
      // final exam: has date instead of section code, plus different meeting
      // types i presume (TODO)
    }
  }
  if (
    state.type === "meeting-comment-begin-next" &&
    (line === '<td colspan="11">' || line === '<td  class="brdr" colspan="11">')
  ) {
    return { ...state, type: "meeting-comment-next" };
  }
  if (state.type === "meeting-comment-next") {
    if (line === "</td>") {
      if (state.meeting.comment) {
        return { ...state, type: "meeting-row-end-next" };
      }
    } else {
      return {
        ...state,
        type: "meeting-comment-next",
        meeting: {
          ...state.meeting,
          comment:
            (state.meeting.comment ? state.meeting.comment + "\n" : "") + line,
        },
      };
    }
  }
  if (state.type === "meeting-row-end-next" && line === "</tr>") {
    return {
      type: "meeting-row-begin-next",
      departments: state.departments,
      department: state.department,
      subject: state.subject,
      course: state.course,
      prevMeeting: state.meeting,
    };
  }
  return null;
}

const lines = (await readFile(".cache/SA04/_all/39.html", "utf-8"))
  .split(/\r?\n/)
  .slice(1);
let state: State = initState;
for (const [i, line] of lines.entries()) {
  const next = processLine(state, line, {
    termYear: 2004,
    quarter: "SA",
  });
  if (!next) {
    console.error("Unexpected line for state");
    console.error(state);
    console.error(`${i + 2}: ${line}`);
    process.exit(1);
  }
  state = next;
}
