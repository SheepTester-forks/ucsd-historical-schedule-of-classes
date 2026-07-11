/**
 * @file
 * Usage: node src/parse.ts (inside scrape/)
 *
 * Assumes src/index.ts has already been run
 */

import { readFile } from "node:fs/promises";
import { terms, type Quarter } from "./lib.ts";
import { getDepartments, getResultPath } from "./get.ts";

type GlobalOptions = {
  termYear: number;
  quarter: Quarter;
};

type Department = {
  name: string;
  subjects: Subject[];
};
type Subject = {
  name: string;
  code: string;
  comment: string;
  asOf: {
    month: number;
    date: number;
    year: number;
    hour: number;
    minute: number;
  };
  courses: Course[];
  courseComments: CourseComment[];
};
type ExpectedCourseInfo = { number: string; title: string };
type CourseComment = {
  number: string;
  comment: string;
};
type Course = {
  restrictions: (keyof typeof restrictionTypes)[];
  number: string;
  catalog: { dept: string; hash: string } | "EAP" | "pharmacy" | null;
  title: string;
  units: { start: number; end: { step: number | null; end: number } | null };
  topic: string | null;
  summerRange: {
    term: 1 | 2 | "special" | "med" | null;
    start: { month: string; date: number };
    end: { month: string; date: number };
  } | null;
  resourcesSectionId: number;
  // on rare occassions there can be multiple, like SA04 page 31 PHYS 1B & 1C
  preAdditionalMeetings: ((
    | UnenrollableMeeting
    | CancelledUnnrollableMeeting
  ) & {
    // FA05 page 359, MATH 3C has an extra meeting time for its pre-additional
    // meeting
    extra: ExtraMeeting | null;
  })[];
  enrollables: ((EnrollableMeeting | CancelledEnrollableMeeting) & {
    // SPPS 201, FA05 page 124 has two extra times for its lecture, but it's got
    // to be a mistake because why do they have two friday sessions ??
    // whatever..
    extras: ExtraMeeting[];
  })[];
  additionalMeetings: ((UnenrollableMeeting | CancelledUnnrollableMeeting) & {
    // yeah apparently additional meetings can have extras too, like ECE 103,
    // SA04 page 10
    // SP13 page 100 CAT 124 has three extra meetings, though it seems to be a
    // duplicate pair
    extras: ExtraMeeting[];
  })[];
  exams: (Exam | CancelledExam)[];
};
type EnrollmentInfo = {
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
};
type MeetingBase = {
  cancelled: false;
  isExam: false;
  instructionType: keyof typeof instructionTypes;
  sectionCode: string;
  location: {
    days: string;
    time: string;
    location: { building: string; room: string } | null;
  } | null;
  instructors: { name: string; encryptedPid: Buffer }[];
  comment: string;
};
type ExtraMeeting = {
  location: {
    days: string;
    time: string;
    location: { building: string; room: string } | null;
  };
};
type EnrollableMeeting = MeetingBase & {
  enrollable: EnrollmentInfo;
};
type UnenrollableMeeting = MeetingBase & {
  enrollable: null;
  isExtra: boolean;
};
type Meeting = EnrollableMeeting | UnenrollableMeeting;
type CancelledMeetingBase = {
  cancelled: true;
  isExam: false;
  instructionType: keyof typeof instructionTypes;
  sectionCode: string;
  comment: string;
};
type CancelledEnrollableMeeting = CancelledMeetingBase & {
  enrollable: { sectionId: number };
};
type CancelledUnnrollableMeeting = CancelledMeetingBase & {
  enrollable: null;
};
type Exam = {
  cancelled: false;
  isExam: true;
  examType: keyof typeof examTypes;
  date: {
    month: number;
    date: number;
    // almost always the term year, except when there's a typo, like FA06 page
    // 164, CSE 290, F00 MU, which is scheduled in 2009
    year: number;
  };
  time: string;
  location: { building: string; room: string } | null;
  comment: string;
};
type CancelledExam = {
  cancelled: true;
  isExam: true;
  examType: keyof typeof examTypes;
  date: { month: number; date: number };
  comment: string;
};

const restrictionTypes = {
  D: "Department Approval Required",
  O: "Open to Majors Only (Non-majors require department approval)",
  JR: "Open to Juniors Only",
  SR: "Open to Seniors Only",
  N: "Not Open to Majors",
  RE: "Open to Revelle College Students Only",
  ER: "Open to Eleanor Roosevelt College Students Only",
  FR: "Open to Freshmen Only",
  SO: "Open to Sophomores Only",
  SI: "Open to Sixth College Students Only",
  TH: "Open to Thurgood Marshall College Students Only",
  WA: "Open to Warren College Students Only",
  GR: "",
  MD: "",
  XFR: "Not Open to Freshmen",
  XJR: "Not Open to Juniors",
  M1: "",
  M2: "",
  XM3: "",
  M4: "",
  PH: "",
  M3: "",
  XSO: "Not Open to Sophomores",
  D1: "",
  D2: "",
  D3: "",
  P4: "",
  MU: "Open to Muir College Students Only",
};
function getRestrictionType(
  type: string,
  title: string,
): keyof typeof restrictionTypes | null {
  if (
    type === "D" ||
    type === "O" ||
    type === "JR" ||
    type === "SR" ||
    type === "N" ||
    type === "RE" ||
    type === "ER" ||
    type === "FR" ||
    type === "SO" ||
    type === "SI" ||
    type === "TH" ||
    type === "WA" ||
    type === "GR" ||
    type === "MD" ||
    type === "XFR" ||
    type === "XJR" ||
    type === "M1" ||
    type === "M2" ||
    type === "XM3" ||
    type === "M4" ||
    type === "PH" ||
    type === "M3" ||
    type === "XSO" ||
    type === "D1" ||
    type === "D2" ||
    type === "D3" ||
    type === "P4" ||
    type === "MU"
  ) {
    if (restrictionTypes[type] === title) {
      return type;
    }
  }
  return null;
}
const instructionTypes = {
  LE: "Lecture",
  DI: "Discussion",
  LA: "Laboratory",
  IN: "Independent Study",
  SE: "Seminar",
  FW: "Fieldwork",
  CL: "Clinical Clerkship",
  TU: "Tutorial",
  SI: "",
  PR: "Practicum",
  ST: "Studio",
  SA: "",
  CO: "Conference",
  OP: "",
  IT: "",
  OT: "Other Additional Meeting",
};
function getInstructionType(
  type: string,
  title: string,
): keyof typeof instructionTypes | null {
  if (
    type === "LA" ||
    type === "LE" ||
    type === "IN" ||
    type === "DI" ||
    type === "SE" ||
    type === "FW" ||
    type === "CL" ||
    type === "TU" ||
    type === "SI" ||
    type === "PR" ||
    type === "ST" ||
    type === "SA" ||
    type === "CO" ||
    type === "OP" ||
    type === "IT" ||
    type === "OT"
  ) {
    if (instructionTypes[type] === title) {
      return type;
    }
  }
  return null;
}
const examTypes = {
  MI: "Midterm",
  FI: "Final",
  MU: "Make-up Session",
  PB: "Problem Session",
  RE: "Review Session",
  OT: "Other Additional Meeting",
  FM: "Film",
};
function getExamType(
  type: string,
  title: string,
): keyof typeof examTypes | null {
  if (
    type === "FI" ||
    type === "MI" ||
    type === "MU" ||
    type === "PB" ||
    type === "RE" ||
    type === "OT" ||
    type === "FM"
  ) {
    if (examTypes[type] === title) {
      return type;
    }
  }
  return null;
}

type State = (
  | {
      type: "before-heading";
      next: "tr" | "td" | "br" | "h2";
      department: Department | null;
    }
  | {
      type: "as-of" | "subject-comment";
      department: Department;
      subject: string;
      subjectCode: string;
      comment: string;
    }
  | {
      type: "subj-comment-h3";
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
      type: "course-comment-empty-td-next" | "course-comment-number-next";
      department: Department;
      subject: Subject;
    }
  | {
      type: "course-comment-title-begin-next" | "course-comment-title-next";
      department: Department;
      subject: Subject;
      number: string;
    }
  | {
      type:
        | "course-comment-td-end-next"
        | "course-comment-tr-end-next"
        | "course-comment-content-tr-begin-next"
        | "course-comment-content-empty-td-next"
        | "course-comment-content-td-begin-next";
      department: Department;
      subject: Subject;
      course: ExpectedCourseInfo;
    }
  | {
      type:
        | "course-comment-content"
        | "course-comment-content-td-end-next"
        | "course-comment-content-tr-end-next"
        | "non-course-tr-begin-next";
      department: Department;
      subject: Subject;
      course: ExpectedCourseInfo;
      comment: string;
      started: boolean;
    }
  | {
      type: "start-course-td";
      department: Department;
      subject: Subject;
      canEndSubject: boolean;
      expected: ExpectedCourseInfo | null;
    }
  | {
      type: "restrictions-title-next";
      department: Department;
      subject: Subject;
      course: Pick<Course, "restrictions">;
      expected: ExpectedCourseInfo | null;
    }
  | {
      type: "restrictions-letter-next";
      department: Department;
      subject: Subject;
      title: string;
      course: Pick<Course, "restrictions">;
      expected: ExpectedCourseInfo | null;
    }
  | {
      type: "course-number-next";
      department: Department;
      subject: Subject;
      course: Pick<Course, "restrictions">;
      expected: ExpectedCourseInfo | null;
    }
  | {
      type: "course-num-end-next" | "course-name-next";
      department: Department;
      subject: Subject;
      course: Pick<Course, "restrictions" | "number">;
      expected: ExpectedCourseInfo | null;
    }
  | {
      type: "unit-start-next";
      department: Department;
      subject: Subject;
      course: Pick<Course, "restrictions" | "number" | "catalog" | "title">;
    }
  | {
      type: "unit-end-next" | "unit-end-br-next";
      department: Department;
      subject: Subject;
      course: Pick<
        Course,
        "restrictions" | "number" | "catalog" | "title" | "units"
      >;
    }
  | {
      type: "unit-end-summer-next";
      department: Department;
      subject: Subject;
      course: Pick<
        Course,
        "restrictions" | "number" | "catalog" | "title" | "units" | "topic"
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
        | "restrictions"
        | "number"
        | "catalog"
        | "title"
        | "units"
        | "topic"
        | "summerRange"
      >;
    }
  | {
      type: "evals-next" | "close-course-links-next";
      department: Department;
      subject: Subject;
      course: Pick<
        Course,
        | "restrictions"
        | "number"
        | "catalog"
        | "title"
        | "units"
        | "topic"
        | "summerRange"
        | "resourcesSectionId"
      >;
    }
  | {
      type: "meeting-row-begin-next";
      department: Department;
      subject: Subject;
      course: Course;
      prevMeeting:
        | Meeting
        | CancelledEnrollableMeeting
        | Exam
        | CancelledExam
        | CancelledUnnrollableMeeting
        | null;
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
      expectCancelled: boolean;
    }
  | {
      type: "section-code-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null;
      meeting: Pick<Meeting, "instructionType">;
      expectCancelled: boolean;
    }
  | {
      type: "days-or-tba-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null | "extra";
      meeting: Pick<Meeting, "instructionType" | "sectionCode">;
    }
  | {
      type: "time-next";
      department: Department;
      subject: Subject;
      course: Course;
      sectionId: number | null | "extra";
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
      sectionId: number | null | "extra";
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
        "instructionType" | "sectionCode" | "location" | "instructors"
      >;
      shouldSeeBr: boolean;
      sawStaff: boolean;
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
        "instructionType" | "sectionCode" | "location" | "instructors"
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
        "instructionType" | "sectionCode" | "location" | "instructors"
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
      meeting:
        | Meeting
        | CancelledEnrollableMeeting
        | Exam
        | CancelledExam
        | CancelledUnnrollableMeeting;
    }
  | {
      type: "exam-brdr-begin-next" | "exam-brdr-end-next" | "exam-type-next";
      department: Department;
      subject: Subject;
      course: Course;
    }
  | {
      type: "exam-date-next";
      department: Department;
      subject: Subject;
      course: Course;
      // at this point it is unclear to the state machine whether this is an
      // extra meeting time for a normal meeting or an actual exam
      instructionType: keyof typeof instructionTypes | null;
      examType: keyof typeof examTypes | null;
    }
  | {
      type: "exam-days-next" | "exam-time-next";
      department: Department;
      subject: Subject;
      course: Course;
      exam: Pick<Exam, "examType" | "date">;
    }
  | {
      type: "exam-building-next";
      department: Department;
      subject: Subject;
      course: Course;
      exam: Pick<Exam, "examType" | "date" | "time">;
    }
  | {
      type: "exam-room-next";
      department: Department;
      subject: Subject;
      course: Course;
      exam: Pick<Exam, "examType" | "date" | "time">;
      building: string;
    }
  | {
      type: "exam-brdr2-begin-next" | "exam-brdr2-end-next" | "exam-brdr3-next";
      department: Department;
      subject: Subject;
      course: Course;
      exam: Exam | UnenrollableMeeting;
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

function addToMeeting(
  course: Course,
  prevMeeting:
    | Meeting
    | CancelledEnrollableMeeting
    | Exam
    | CancelledExam
    | CancelledUnnrollableMeeting,
): Course | null {
  // TODO: may also want to assert based on section code format (e.g. A01 vs
  // 001)
  if (prevMeeting.isExam) {
    return prevMeeting
      ? {
          ...course,
          exams: [...course.exams, prevMeeting],
        }
      : course;
  } else if (
    !prevMeeting.cancelled &&
    prevMeeting.enrollable === null &&
    prevMeeting.isExtra
  ) {
    // assume location of extra meeting will never be TBA
    // nvm they apparently can be, SA05 page 46, MGT 111. but the time should
    // always be determined, surely
    if (prevMeeting.location) {
      const extra: ExtraMeeting = { location: prevMeeting.location };
      const lastAdditional = course.additionalMeetings.at(-1);
      if (lastAdditional) {
        if (
          lastAdditional.instructionType === prevMeeting.instructionType &&
          lastAdditional.sectionCode === prevMeeting.sectionCode &&
          lastAdditional.comment === prevMeeting.comment
        ) {
          return {
            ...course,
            additionalMeetings: course.additionalMeetings.with(-1, {
              ...lastAdditional,
              extras: [...lastAdditional.extras, extra],
            }),
          };
        }
      } else {
        const lastEnrollable = course.enrollables.at(-1);
        if (lastEnrollable) {
          if (
            lastEnrollable.instructionType === prevMeeting.instructionType &&
            lastEnrollable.sectionCode === prevMeeting.sectionCode &&
            lastEnrollable.comment === prevMeeting.comment
          ) {
            return {
              ...course,
              enrollables: course.enrollables.with(-1, {
                ...lastEnrollable,
                extras: [...lastEnrollable.extras, extra],
              }),
            };
          }
        } else {
          const lastPreAdditional = course.preAdditionalMeetings.at(-1);
          if (
            lastPreAdditional &&
            lastPreAdditional.extra === null &&
            lastPreAdditional.instructionType === prevMeeting.instructionType &&
            lastPreAdditional.sectionCode === prevMeeting.sectionCode &&
            lastPreAdditional.comment === prevMeeting.comment
          ) {
            return {
              ...course,
              preAdditionalMeetings: course.preAdditionalMeetings.with(-1, {
                ...lastPreAdditional,
                extra,
              }),
            };
          }
        }
      }
    }
  } else if (course.exams.length === 0) {
    if (prevMeeting.enrollable !== null) {
      // const lastAdditonalMeeting = course.additionalMeetings.at(-1);
      // if (!lastAdditonalMeeting || lastAdditonalMeeting.cancelled) {
      // once we have started an additional meeting, the remaining ones must
      // also be unenrollable
      // well, an enrollable meeting can show up after a cancelled second
      // unenrollable meeting (but it'll be out of order so idk; see SA04 page
      // 31 PHYS 1B)
      // well actually enrollable meetings can be whenever, see FA05 page 68,
      // BIBC 102, where they for whatever reason made an enrollable lecture and
      // a bunch of unenrollable discussions, except one that no one enrolled in
      // is enrollable
      return prevMeeting
        ? {
            ...course,
            enrollables: [
              ...course.enrollables,
              { ...prevMeeting, extras: [] },
            ],
          }
        : course;
    } else if (course.enrollables.length === 0) {
      // first meeting (A00) can be unenrollable yet followed by enrollable
      // meetings
      // idk if the first meeting can be cancelled
      // actually yes they can (SA04 page 9 CSE 132A)
      return prevMeeting
        ? {
            ...course,
            preAdditionalMeetings: [
              ...course.preAdditionalMeetings,
              { ...prevMeeting, extra: null },
            ],
          }
        : course;
    } else {
      // there must be at least one enrollable
      // nvm, see CSE 12, SA04 page 8. they converted CSE 12 from a DI-based A01
      // to LE-based A02, resulting in a crazy situation:
      // - 12: LE A00 (enrollable)
      // - 12: DI A01
      //       LA A50 (cancelleed)
      return prevMeeting
        ? {
            ...course,
            additionalMeetings: [
              ...course.additionalMeetings,
              { ...prevMeeting, extras: [] },
            ],
          }
        : course;
    }
  }
  return null;
}

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
      const matchDept = line
        .replaceAll("&amp;", "&")
        .match(
          /^<h2> <span class="centeralign">([A-Za-z&,/ ]{35})<\/span> <\/h2>$/,
        );
      const matchSubject = line
        .replaceAll("&amp;", "&")
        .match(
          /^<h2>  <span class="centeralign">([A-Za-z&/, -]{30}) \(([A-Z ]{5})\)<\/span> <\/h2>$/,
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
          comment: "",
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
          comment: state.comment,
          asOf: { month, date, year, hour, minute },
          courses: [],
          courseComments: [],
        },
      };
    }
    if (line === "<br>" && !state.comment) {
      return { ...state, type: "subj-comment-h3" };
    } else {
      return { ...state, comment: state.comment + "\n<br>" };
    }
  }
  if (
    state.type === "subj-comment-h3" // &&
    // line === '<h3><span class="ertext">See Class Sections Below</span></h3>'
  ) {
    // Apparently it can just start with anything
    return { ...state, type: "subject-comment", comment: line };
  }
  if (state.type === "subject-comment") {
    if (line === "<br>") {
      return { ...state, type: "as-of" };
    } else {
      return {
        ...state,
        comment: (state.comment ? state.comment + "\n" : "") + line,
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
        if (line === "<br>" && !state.wasFrom.comment) {
          return state;
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
      return {
        ...state,
        type: "start-course-td",
        canEndSubject: state.canEnd,
        expected: null,
      };
    }
    if (line === "<tr >") {
      return { ...state, type: "course-comment-empty-td-next" };
    }
  }
  if (
    state.type === "course-comment-empty-td-next" &&
    line === '<td class="crsheader"></td>'
  ) {
    return { ...state, type: "course-comment-number-next" };
  }
  if (state.type === "course-comment-number-next") {
    const match = line.match(
      /^<td class="crsheader" align="">(\d{1,3}[A-Z]{0,2})<\/td>$/,
    );
    if (match) {
      return {
        ...state,
        type: "course-comment-title-begin-next",
        number: match[1],
      };
    }
  }
  if (
    state.type === "course-comment-title-begin-next" &&
    line === '<td colspan="11" class="crsheader">'
  ) {
    return { ...state, type: "course-comment-title-next" };
  }
  if (state.type === "course-comment-title-next") {
    const match = line
      .replaceAll("&#039;", "'")
      .replaceAll("&amp;", "&")
      .match(/^([A-Za-z&'/.,:\d()!? -]{1,30})$/);
    if (match) {
      return {
        ...state,
        type: "course-comment-td-end-next",
        course: { number: state.number, title: match[1] },
      };
    }
  }
  if (state.type === "course-comment-td-end-next" && line === "</td>") {
    return { ...state, type: "course-comment-tr-end-next" };
  }
  if (state.type === "course-comment-tr-end-next" && line === "</tr>") {
    return { ...state, type: "course-comment-content-tr-begin-next" };
  }
  if (
    state.type === "course-comment-content-tr-begin-next" &&
    line === "<tr>"
  ) {
    return { ...state, type: "course-comment-content-empty-td-next" };
  }
  if (
    state.type === "course-comment-content-empty-td-next" &&
    line === '<td  class="nonenrtxt" colspan="2" align="right"></td>'
  ) {
    return { ...state, type: "course-comment-content-td-begin-next" };
  }
  if (
    state.type === "course-comment-content-td-begin-next" &&
    line === '<td  class="nonenrtxt" colspan="11">'
  ) {
    return {
      ...state,
      type: "course-comment-content",
      comment: "",
      started: false,
    };
  }
  if (state.type === "course-comment-content") {
    if (!state.started) {
      if (line === '<span class="ertext">') {
        return { ...state, started: true };
      }
      const match = line.match(/^<span class="ertext"> (.+)$/);
      if (match) {
        return { ...state, comment: match[1], started: true };
      }
    } else {
      const match = line.match(/(.*)<\/span>$/);
      if (match) {
        return {
          ...state,
          type: "course-comment-content-td-end-next",
          comment: state.comment + "\n" + match[1],
        };
      } else {
        return { ...state, comment: state.comment + "\n" + line };
      }
    }
  }
  if (state.type === "course-comment-content-td-end-next" && line === "</td>") {
    return { ...state, type: "course-comment-content-tr-end-next" };
  }
  if (state.type === "course-comment-content-tr-end-next" && line === "</tr>") {
    return { ...state, type: "non-course-tr-begin-next" };
  }
  if (state.type === "non-course-tr-begin-next" && line === "<tr>") {
    return {
      ...state,
      type: "start-course-td",
      subject: {
        ...state.subject,
        courseComments: [
          { number: state.course.number, comment: state.comment },
        ],
      },
      canEndSubject: state.subject.courses.length > 0,
      expected: state.course,
    };
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
      return {
        ...state,
        type: "restrictions-title-next",
        course: { restrictions: [] },
      };
    }
    if (line === '<td class="crsheader"></td>') {
      // no requirements
      return {
        ...state,
        type: "course-number-next",
        course: { restrictions: [] },
      };
    }
  }
  if (state.type === "restrictions-title-next") {
    const match = line.match(
      /^<span id="crsRestCd" title="([A-Za-z\-() ]*)">$/,
    );
    if (match) {
      return { ...state, type: "restrictions-letter-next", title: match[1] };
    }
    if (line === "</td>" && state.course.restrictions.length > 0) {
      return { ...state, type: "course-number-next" };
    }
  }
  if (state.type === "restrictions-letter-next") {
    const match = line.match(/^([A-Z\d]{1,3})<\/span><br>$/);
    if (match) {
      const type = getRestrictionType(match[1], state.title);
      if (type) {
        return {
          ...state,
          type: "restrictions-title-next",
          course: {
            restrictions: [...state.course.restrictions, type],
          },
        };
      }
    }
  }
  if (state.type === "course-number-next") {
    // that second space seems to depend on whether there was a restriction
    const match = line.match(
      /^<td ( )?class="crsheader">(\d{1,3}[A-Z]{0,2})<\/td>$/,
    );
    if (match) {
      const extraSpace = !!match[1];
      const restrictionless = state.course.restrictions.length === 0;
      if (
        extraSpace === restrictionless &&
        (state.expected === null || state.expected.number === match[2])
      ) {
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
      .replaceAll("&#039;", "'")
      .replaceAll("&#034;", '"')
      .replaceAll("&amp;", "&")
      .match(
        // SA10 page 46 HIEU 106GS links to SP18.html and idk if that's intentional
        // idk why they only misspell "EXCLUDE" but SP19 page 500 RMAS 199 links to 'EXCULDE' and one before did 'EXLUDE'
        /^(?:<a href="javascript:openNewWindow\('http:\/\/(registrar\.ucsd\.edu\/studentlink\/cnd\.html|www\.ucsd\.edu\/catalog\/courses\/([A-Z]{2,5}|SP18|CSE-AESE|EXLUDE|EXCULDE)\.html#([a-z]{2,5}\d{1,3}[a-z]{0,2})|www\.ucsd\.edu\/catalog\/curric\/EAP\.html|pharmacy\.ucsd\.edu\/current)'\)">)?<span class="boldtxt">([A-Za-z&'/:,.\d()+";?!@# -]{30})<\/span>(?: <\/a>)?$/,
      );
    if (match && line.startsWith("<a") === line.endsWith("a>")) {
      const title = match[4].trimEnd();
      if (
        !!match[2] === !!match[3] &&
        (state.expected === null || state.expected.title === title)
      ) {
        return {
          ...state,
          type: "unit-start-next",
          course: {
            ...state.course,
            catalog:
              match[1] === "www.ucsd.edu/catalog/curric/EAP.html"
                ? "EAP"
                : match[1] === "pharmacy.ucsd.edu/current"
                  ? "pharmacy"
                  : match[2]
                    ? { dept: match[2], hash: match[3] }
                    : null,
            title,
          },
        };
      }
    }
  }
  if (state.type === "unit-start-next") {
    const match = line.match(/^\( ([12]?\d(?:\.5)?)$/);
    if (match) {
      return {
        ...state,
        type: "unit-end-next",
        course: { ...state.course, units: { start: +match[1], end: null } },
      };
    }
  }
  if (state.type === "unit-end-next") {
    const match = line.match(/^\/([12]?\d) by (2|3|4|7|0\.5)$/);
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
    const matchNoStep = line.match(/^-([12]?\d)$/);
    if (matchNoStep && !state.course.units.end) {
      return {
        ...state,
        course: {
          ...state.course,
          units: {
            start: state.course.units.start,
            end: { step: null, end: +matchNoStep[1] },
          },
        },
      };
    }
    if (line === "Units)") {
      return { ...state, type: "unit-end-br-next" };
    }
  }
  if (state.type === "unit-end-br-next" && line === "<br>") {
    return {
      ...state,
      type: "unit-end-summer-next",
      course: { ...state.course, topic: null },
    };
  }
  if (state.type === "unit-end-summer-next") {
    if (isSummer) {
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
    const topicMatch = line
      .replaceAll("&amp;", "&")
      .replaceAll("&#039;", "'")
      .replaceAll("&#034;", '"')
      // 'What=Algebra, What=Analysis' SP09 page 340 MATH 87
      // 'MoliÛre et les conflits' WI11 page 318 LTFR 122
      // - pretty sure this is mojibake. but looking at the untrimmed HTML, the
      //   full string is still 30 chars even with the mojibake. so ig they're
      //   stored as 30 bytes not chars, which makes sense
      // - because they send their HTML with 'Content-Type: text/html;charset=UTF-8'
      // 'El cine de Pedro Almodìvar' WI11 page 322 LTSP 129
      // - should be Almodóvar
      // 'Poes¥a reciente' WI11 page 322 LTSP 141
      // '*LA*' SP11 page 322 LTSP 174
      // 'God,Satan,& the Desert *$95fee' FA12 page 238 ERC 87
      // - yes they put the dollar fee into the topic. it is for an anza borrego trip
      // 'Du Moyen-Age ë 1789' FA12 page 316 LTFR 115
      // 'La Litt©rature fantastique' WI13 page 317 LTFR 141
      // 'Hyperk\"ahler manifolds' MATH 206A, FA18 page 363
      .match(/^([A-Za-z&.,?/\d:'!(")#;=@Ûì¥*+$ë©\\ -]+)$/);
    if (topicMatch && state.course.topic === null) {
      if (isSummer) {
        // summer range may follow
        return { ...state, course: { ...state.course, topic: topicMatch[1] } };
      } else {
        return {
          ...state,
          type: "course-header-end-next",
          course: { ...state.course, topic: topicMatch[1], summerRange: null },
        };
      }
    }
    if (line === "</td>" && !isSummer) {
      return {
        ...state,
        type: "ready-for-course-number-links",
        course: { ...state.course, summerRange: null },
      };
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
      // FA19 page 6 ANTH 199 has a 4-digit section id here
      // FA19 page 121 CHEM 99H has '74'
      /^<span class="boldtxt" onmouseover="" style="cursor: pointer;" onclick="javascript:openNewWindow\('http:\/\/courses\.ucsd\.edu\/coursemain\.asp\?section=(\d{6}|6922|74)'\)">Resources<\/span>&nbsp;\|&nbsp;$/,
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
      course: {
        ...state.course,
        preAdditionalMeetings: [],
        enrollables: [],
        additionalMeetings: [],
        exams: [],
      },
      prevMeeting: null,
    };
  }
  if (state.type === "meeting-row-begin-next") {
    if ((line === "<tr>" || line === "<tr >") && state.prevMeeting) {
      const newCourse = addToMeeting(state.course, state.prevMeeting);
      // could either be beginning of course or subject or department, which is
      // handled by this state i think
      if (newCourse) {
        return {
          type:
            line === "<tr >"
              ? "course-comment-empty-td-next"
              : "start-course-td",
          departments: state.departments,
          department: state.department,
          subject: {
            ...state.subject,
            courses: [...state.subject.courses, newCourse],
          },
          canEndSubject: true,
          expected: null,
        };
      }
    }
    if (line === '<tr class="sectxt">') {
      if (!state.prevMeeting) {
        // first meeting
        return { ...state, type: "borderless-brdr-next" };
      }
      const newCourse = addToMeeting(state.course, state.prevMeeting);
      if (newCourse) {
        return { ...state, type: "borderless-brdr-next", course: newCourse };
      }
    }
    if (line === '<tr class="nonenrtxt">' && state.prevMeeting) {
      return {
        ...state,
        type: "white-meeting-start-or-meeting-comment",
        meeting: state.prevMeeting,
      };
    }
    if (line === "" && state.prevMeeting) {
      const newCourse = addToMeeting(state.course, state.prevMeeting);
      if (newCourse) {
        return {
          type: "done",
          departments: [
            ...state.departments,
            {
              ...state.department,
              subjects: [
                ...state.department.subjects,
                {
                  ...state.subject,
                  courses: [...state.subject.courses, newCourse],
                },
              ],
            },
          ],
        };
      }
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
      expectCancelled: false,
    };
  }
  if (state.type === "brdr-section-id-end-next") {
    // FA19 page 6 ANTH 199 has a 4-digit section id here
    // FA19 page 121 CHEM 99H has '74'
    const match = line.match(/^(?:\d{6}|6922|74)$/);
    if (match && state.sectionId === null) {
      return { ...state, sectionId: +match[0] };
    }
    if (line === "</td>") {
      return { ...state, type: "instruction-type-next" };
    }
    if (line === "&nbsp;" && !state.expectCancelled) {
      return { ...state, expectCancelled: true };
    }
  }
  if (state.type === "instruction-type-next") {
    const match = line.match(
      /^<td class="brdr"><span id="insTyp" title="([A-Za-z ]*)">([A-Z]{2})<\/span><\/td>$/,
    );
    if (match) {
      const type = getInstructionType(match[2], match[1]);
      if (type) {
        return {
          ...state,
          type: "section-code-next",
          meeting: { instructionType: type },
        };
      }
    }
  }
  if (state.type === "section-code-next") {
    // two-digit second codes are usually typos i think
    // SP06 page 274 IRGN section '23 ', which follows 022, 024, 025
    // or FA08 page 65 BISP 190 cancelled section 'A0 '
    // FA08 page 332 MAE 299 '50 ' (it is a bit more frequent than once in a blue moon)
    // there's also FA08 page 359 MED 296 where they used O instead of 0
    // ^ same with CSE 197 WI14 page 172 'GOO'
    // FA14 page 397 NANO 299 has ' 10' which puts it before '001'
    // FA16 page 295 HIUS 183, 'BOO' was cancelled and presumably replaced with 'B00'
    // guess it's also not super rare
    // SP19 page 412 NEU 296 has '00?' (cancelled), i guess they held shift or something ??
    const match = line.match(
      /^<td class="brdr">([A-Z\d]\d\d|\d\d |A0 |[A-Z]OO| 10|00\?)<\/td>$/,
    );
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
      // let's just assume extra meeting times cannot be cancelled
      state.sectionId !== "extra"
    ) {
      return {
        ...state,
        type: "meeting-row-end-next",
        meeting: {
          ...state.meeting,
          cancelled: true,
          isExam: false,
          enrollable: state.sectionId ? { sectionId: state.sectionId } : null,
          comment: "",
        },
      };
    }
    if (
      line === '<td class="brdr" colspan="4" align="center">TBA</td>' &&
      state.sectionId !== "extra"
    ) {
      return {
        ...state,
        type: "instructor-begin-next",
        sectionId: state.sectionId,
        meeting: { ...state.meeting, location: null },
      };
    }
    // idk what they internally use for sunday but i do know they use R for
    // thursday
    const match = line
      .replace("Sun", "X")
      .replace("Th", "R")
      .replace("Tu", "T")
      .match(
        // TR|T|MW|MWF|M|R|W|F|MTWR|MTWRF|MF|MR|TWR|WRF|WR|MWR|WF|MTWF|TW|MTW|MTR|RF|S
        /^<td class="brdr">(M?T?W?R?F?S?X? {0,6})<\/td>$/,
      );
    if (match && match[1].length === 7) {
      return { ...state, type: "time-next", days: match[1].trimEnd() };
    }
  }
  if (state.type === "time-next") {
    const match = line.match(
      // (?:00|10|15|20|30|45|50)
      // (?:00|05|10|15|20|25|30|40|45|50|55|59)
      /^<td class="brdr">(1?\d:[0-5]\d[ap]-1?\d:[0-5]\d[ap])<\/td>$/,
    );
    if (match) {
      if (state.sectionId === "extra") {
        return {
          ...state,
          type: "building-code-next",
          building: "unused",
          time: match[1],
        };
      } else {
        return {
          ...state,
          type: "building-start-next",
          sectionId: state.sectionId,
          time: match[1],
        };
      }
    }
  }
  if (state.type === "building-start-next" && line === '<td class="brdr">') {
    return { ...state, type: "building-link-next" };
  }
  if (state.type === "building-link-next") {
    if (line === "TBA</td>") {
      return { ...state, type: "room-next", building: "TBA" };
    }
    const match = line.match(
      /^<a href="https:\/\/maps\.ucsd\.edu\/\?id=1005#!s\/([A-Z][A-Z\d-]{1,4})_Main\?ct\/18312" target="_blank">$/,
    );
    if (match) {
      return { ...state, type: "building-code-next", building: match[1] };
    }
  }
  if (state.type === "building-code-next") {
    if (state.sectionId === "extra" && line === '<td class="brdr">TBA</td>') {
      return { ...state, type: "room-next", building: "TBA" };
    }
    const match = line.match(
      /^(<td class="brdr">)?([A-Z][A-Z\d]{1}[A-Z\d -]{3})(<\/a>)?<\/td>$/,
    );
    if (match) {
      const building = match[2].trimEnd();
      if (
        (state.sectionId === "extra" || building === state.building) &&
        ((state.sectionId === "extra") === !!match[1] &&
          state.sectionId !== "extra") === !!match[3]
      ) {
        return { ...state, type: "room-next", building };
      }
    }
  }
  if (state.type === "room-next") {
    if (state.building === "TBA") {
      if (line === '<td class="brdr">TBA</td>') {
        if (state.sectionId !== "extra") {
          return {
            ...state,
            type: "instructor-begin-next",
            sectionId: state.sectionId,
            meeting: {
              ...state.meeting,
              location: { days: state.days, time: state.time, location: null },
            },
          };
        } else {
          return {
            ...state,
            type: "exam-brdr2-begin-next",
            exam: {
              ...state.meeting,
              location: { days: state.days, time: state.time, location: null },
              cancelled: false,
              isExam: false,
              instructors: [],
              comment: "",
              enrollable: null,
              isExtra: true,
            },
          };
        }
      }
    }
    const match = line.match(/^<td class="brdr">([A-Z\d][A-Z\d -]{4})<\/td>$/);
    if (match) {
      const room = match[1].trimEnd();
      const location = {
        days: state.days,
        time: state.time,
        location: { building: state.building, room },
      };
      if (state.sectionId === "extra") {
        return {
          ...state,
          type: "exam-brdr2-begin-next",
          exam: {
            ...state.meeting,
            location,
            cancelled: false,
            isExam: false,
            instructors: [],
            comment: "",
            enrollable: null,
            isExtra: true,
          },
        };
      } else {
        return {
          ...state,
          type: "instructor-begin-next",
          sectionId: state.sectionId,
          meeting: { ...state.meeting, location },
        };
      }
    }
  }
  if (state.type === "instructor-begin-next" && line === '<td class="brdr">') {
    return {
      ...state,
      type: "instructor-end-next",
      shouldSeeBr: false,
      sawStaff: false,
      meeting: { ...state.meeting, instructors: [] },
    };
  }
  if (state.type === "instructor-end-next") {
    if (state.shouldSeeBr) {
      if (line === "<br>") {
        return { ...state, shouldSeeBr: false };
      }
    } else {
      if (
        line === "</td>"
        // instructors may or may not be mentioned for unenrollable sections
        // or enrollable, see PHYS 1AL, SA04 page 31

        // (state.sawStaff ||
        //   state.meeting.instructors.length > 0 ||
        //   state.sectionId === null)
      ) {
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
              isExam: false,
              comment: "",
              isExtra: false,
            },
          };
        }
      }
      if (
        line === "Staff" &&
        !state.sawStaff &&
        state.meeting.instructors.length === 0
        // FA05 page 525, ENG 100L has staff pre-additional course
      ) {
        return { ...state, shouldSeeBr: true, sawStaff: true };
      }
      const match = line.replaceAll("&#039;", "'").match(
        // instructor named 'Error, 243' in FA06 page 235 ERTH 40
        /^<a href="#!" onclick="javascript:sendMail\('\/scheduleOfClasses\/scheduleOfClassesFacultyEmailResult\.htm\?pid=([A-Za-z\d+/]+==)'\)">([A-Za-z,.'\d() -]{35})<\/a>$/,
      );
      if (match && !state.sawStaff) {
        return {
          ...state,
          shouldSeeBr: true,
          meeting: {
            ...state.meeting,
            instructors: [
              ...state.meeting.instructors,
              {
                encryptedPid: Buffer.from(match[1], "base64"),
                name: match[2].trim(),
              },
            ],
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
        isExam: false,
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
          isExam: false,
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
    if (!state.meeting.comment) {
      if (
        line ===
        (state.meeting.isExam ||
        (!state.meeting.cancelled &&
          !state.meeting.enrollable &&
          state.meeting.isExtra)
          ? '<td colspan="2"></td>'
          : '<td  class="brdr" colspan="2"></td>')
      ) {
        return { ...state, type: "meeting-comment-begin-next" };
      }
    }
    if (line === '<td  class="brdr" colspan="2" border="0"></td>') {
      const newCourse = addToMeeting(state.course, state.meeting);
      if (newCourse) {
        // final exam: has date instead of section code, plus different meeting
        // types i presume
        return {
          type: "exam-brdr-begin-next",
          departments: state.departments,
          department: state.department,
          subject: state.subject,
          course: newCourse,
        };
      }
    }
  }
  if (state.type === "exam-brdr-begin-next" && line === '<td class="brdr">') {
    return { ...state, type: "exam-brdr-end-next" };
  }
  if (state.type === "exam-brdr-end-next" && line === "</td>") {
    return { ...state, type: "exam-type-next" };
  }
  if (state.type === "exam-type-next") {
    const match = line.match(
      /^<td class="brdr"><span id="insTyp" title="([A-Za-z- ]+)">([A-Z]{2})<\/span><\/td>$/,
    );
    if (match) {
      return {
        ...state,
        type: "exam-date-next",
        examType: getExamType(match[2], match[1]),
        instructionType: getInstructionType(match[2], match[1]),
      };
    }
  }
  if (state.type === "exam-date-next") {
    const match = line.match(
      /^<td class="brdr">([01]\d)\/([0-3]\d)\/(\d{4})<\/td>$/,
    );
    // FA06 page 164, CSE 290, F00 MU is scheduled in 2009
    // at least the day of week (M) is accurate
    // +match[3] === options.termYear &&
    if (match && state.examType) {
      return {
        ...state,
        type: "exam-days-next",
        exam: {
          examType: state.examType,
          date: { month: +match[1], date: +match[2], year: +match[3] },
        },
      };
    }
    const matchSecCode = line.match(/^<td class="brdr">([A-Z\d]\d\d)<\/td>$/);
    if (matchSecCode && state.instructionType) {
      return {
        ...state,
        type: "days-or-tba-next",
        meeting: {
          instructionType: state.instructionType,
          sectionCode: matchSecCode[1],
        },
        sectionId: "extra",
      };
    }
  }
  if (state.type === "exam-days-next") {
    if (
      line ===
      '<td class="brdr" colspan="8" align="center"><span class="ertext">Cancelled</span></td>'
    ) {
      return {
        ...state,
        type: "meeting-row-end-next",
        meeting: {
          ...state.exam,
          cancelled: true,
          isExam: true,
          comment: "",
        },
      };
    }
    const match = line
      .replace("Sun", "X")
      .replace("Th", "R")
      .replace("Tu", "T")
      // (?:T|R|S|M|W|F|X)
      .match(/^<td class="brdr">(M?T?W?R?F?S?X? {0,6})<\/td>$/);
    // TODO: validate exam date and day match
    if (match && match[1].length === 7) {
      return { ...state, type: "exam-time-next" };
    }
  }
  if (state.type === "exam-time-next") {
    const match = line.match(
      // (?:00|01|05|10|15|30|45|51)
      // (?:00|20|29|30|40|45|50|59)
      /^<td class="brdr">(1?\d:[0-5]\d[ap]-1?\d:[0-5]\d[ap])<\/td>$/,
    );
    if (match) {
      return {
        ...state,
        type: "exam-building-next",
        exam: { ...state.exam, time: match[1] },
      };
    }
  }
  if (state.type === "exam-building-next") {
    if (line === '<td class="brdr">TBA</td>') {
      return { ...state, type: "exam-room-next", building: "TBA" };
    }
    const match = line.match(
      /^<td class="brdr">([A-Z][A-Z\d]{1}[A-Z\d -]{3})<\/td>$/,
    );
    if (match) {
      return { ...state, type: "exam-room-next", building: match[1].trimEnd() };
    }
  }
  if (state.type === "exam-room-next") {
    if (line === '<td class="brdr">TBA</td>' && state.building === "TBA") {
      return {
        ...state,
        type: "exam-brdr2-begin-next",
        exam: {
          ...state.exam,
          location: null,
          cancelled: false,
          isExam: true,
          comment: "",
        },
      };
    }
    const match = line.match(/^<td class="brdr">([A-Z\d][A-Z\d -]{4})<\/td>$/);
    if (match) {
      return {
        ...state,
        type: "exam-brdr2-begin-next",
        exam: {
          ...state.exam,
          location: { building: state.building, room: match[1].trimEnd() },
          cancelled: false,
          isExam: true,
          comment: "",
        },
      };
    }
  }
  if (state.type === "exam-brdr2-begin-next" && line === '<td class="brdr">') {
    return { ...state, type: "exam-brdr2-end-next" };
  }
  if (state.type === "exam-brdr2-end-next" && line === "</td>") {
    return { ...state, type: "exam-brdr3-next" };
  }
  if (
    state.type === "exam-brdr3-next" &&
    line === '<td  class="brdr" colspan="3">&nbsp;</td>'
  ) {
    return { ...state, type: "meeting-row-end-next", meeting: state.exam };
  }
  if (
    state.type === "meeting-comment-begin-next" &&
    (state.meeting.isExam ||
    (!state.meeting.cancelled &&
      !state.meeting.enrollable &&
      state.meeting.isExtra)
      ? '<td colspan="11"></td>'
      : '<td  class="brdr" colspan="11"></td>')
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

async function printDebug(
  paginateTerm: string,
  deptTerms: string[],
  page: number,
) {
  const departments = Array.from(
    new Set(
      await Promise.all(deptTerms.map((term) => getDepartments(term))).then(
        (departments) =>
          departments
            .values()
            .flatMap((departments) => departments)
            .map(({ code }) => code),
      ),
    ),
  );
  // https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda#quick-example
  console.error(
    `debug: \x1b]8;;${getResultPath(
      paginateTerm,
      departments,
      page,
    )}\x1b\\scheduleOfClassesStudentResult.htm?selectedTerm=${
      paginateTerm
    }&page=${page}\x1b]8;;\x1b\\`,
  );
}

for (const {
  deptTerms,
  paginateTerm: term,
  year: termYear,
  quarter,
} of terms()) {
  if (termYear < 2005) {
    continue;
  }
  let totalPages = 1;
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    const path = `.cache/${term}/_all/${pageNumber}.html`;
    const allLines = (
      await readFile(path, "utf-8").catch((error) =>
        error instanceof Error && "code" in error && error.code === "ENOENT"
          ? null
          : Promise.reject(error),
      )
    )?.split(/\r?\n/);
    if (!allLines) {
      // some pages are missing and thats ok
      continue;
    }
    const [firstLine, ...lines] = allLines;
    const match = firstLine.match(
      /^Page  \((\d+)&nbsp;of&nbsp;(\d+)\) &nbsp;$/,
    );
    if (
      !match ||
      +match[1] !== pageNumber ||
      (totalPages !== 1 && +match[2] !== totalPages)
    ) {
      console.error(`${path}:1: page mismatch`);
      console.error(firstLine);
      await printDebug(term, deptTerms, pageNumber);
      process.exit(1);
    }
    totalPages = +match[2];

    const mgtIndex = lines.findIndex((line) =>
      line.includes("http://courses.ucsd.edu/coursemain.asp?section=0"),
    );
    if (mgtIndex !== -1) {
      // TODO: MGT is too weird, it only has exams
      console.error(`${path}:${mgtIndex + 1}: skipping MGT 221`);
      continue;
    }

    let state: State = initState;
    for (const [i, line] of lines.entries()) {
      const next = processLine(state, line, {
        termYear,
        quarter,
      });
      if (!next) {
        console.dir(state, { depth: null });
        console.error(
          `${path}:${i + 2}: unexpected line for state '\x1b[1;36m${state.type}\x1b[0m'`,
        );
        console.error(line);
        await printDebug(term, deptTerms, pageNumber);
        process.exit(1);
      }
      state = next;
    }
    if (state.type !== "done") {
      console.dir(state, { depth: null });
      console.error(
        `${path}:${lines.length + 1}: state machine incomplete :( ended at '\x1b[1;36m${state.type}\x1b[0m'`,
      );
      await printDebug(term, deptTerms, pageNumber);
      process.exit(1);
    }
  }
}
console.error("success!");
