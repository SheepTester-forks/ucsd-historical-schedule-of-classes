/**
 * Copied from github.com/SheepTester/uxdy/blob/main/scheduleofclasses/scrape.ts
 * @module
 */

export function parseJson(json: string): ScrapedResult {
  return JSON.parse(json, (key, value) =>
    key === "section" && value.length > 3
      ? value.split("-").map(Number)
      : key === "capacity" && value === null
      ? Infinity
      : value
  );
}

/**
 * IMPORTANT: `JSON.parse` is not enough. See `parseJson` for necessary reviver
 * operations (for example, unlimited capacity is serialized into JSON as
 * `null`).
 */
export type ScrapedResult = {
  scrapeTime: number;
  /**
   * NOTE: The same course code may appear multiple times (with potentially
   * different `units` and `description`).
   */
  courses: ScrapedCourse[];
};

export type ScrapedCourse = {
  subject: string;
  subjectName: string;
  number: string;
  title: string;
  /** Seminar classes (e.g. CSE 291) list their topic under the course title. */
  description?: string;
  /**
   * The path to the course's entry in the course catalog, e.g.
   * `/courses/CSE.html#cse11`. Some courses, such as S123 ANBI 143GS, link to
   * https://registrar.ucsd.edu/studentlink/cnd.html which says that it is not
   * in the course catalog. Others just don't have links at all (e.g. FA23 ANES
   * 227). FA23 SPPS 201 links to http://pharmacy.ucsd.edu/current, which isn't
   * in the course catalog.
   */
  catalog?: string;
  /** https://students.ucsd.edu/_files/registrar/restriction-codes.html */
  restriction: string[];
  note?: string;
  /**
   * A range of selectable units from `from` to `to` (inclusive) in increments
   * of `inc`.
   *
   * NOTE: `inc` may be 0.5.
   */
  units: UnitRange;
  /**
   * Guaranteed to be populated for summer terms. Each date range corresponds to
   * group.
   */
  dateRanges: [DateTuple, DateTuple][];
  sections: ScrapedSection[];
};

export type UnitRange = { from: number; to: number; inc: number };

/** `month` is 1-indexed. */
export type DateTuple = [year: number, month: number, date: number];

/** Represents a scheduled meeting time for a course. */
export type ScrapedSection =
  | {
      cancelled: false;
      /**
       * Only defined if the section is selectable in WebReg (eg a discussion
       * time as opposed to its lecture).
       *
       * For seats: https://registrar.ucsd.edu/StudentLink/avail_limit.html
       */
      selectable: {
        /**
         * A 6-digit number.
         * https://registrar.ucsd.edu/StudentLink/id_crse_codes.html
         */
        id: number;
        /**
         * If full, a negative number representing the length of the waitlist.
         * If there is no limit, both `available` and `capacity` will be
         * Infinity.
         */
        available: number;
        capacity: number;
      } | null;
      /**
       * Normal meetings e.g. LE, DI, LA or exams e.g. FI, MI.
       * https://registrar.ucsd.edu/StudentLink/instr_codes.html
       */
      type: string;
      /**
       * UTC Date if it's an exam (eg a final) that occurs on one day.
       * Otherwise, it's a section code like A00 or 001.
       */
      section: string | DateTuple;
      /** Null if TBA. */
      time: {
        /**
         * Sorted array of numbers 0-6 representing days of the week. 0 is
         * Sunday.
         */
        days: number[];
        /** In minutes since the start of the day. */
        start: number;
        /** In minutes since the start of the day. */
        end: number;
      } | null;
      /** Null if TBA. */
      location: {
        /** https://registrar.ucsd.edu/StudentLink/bldg_codes.html */
        building: string;
        room: string;
      } | null;
      /**
       * Empty if taught by Staff.
       *
       * Note that for exams and courses with multiple lecture times,
       * ScheduleOfClasses doesn't repeat the instructor, so this array will
       * also be empty.
       */
      instructors: [firstName: string, lastName: string][];
      note?: string;
    }
  | {
      cancelled: true;
      selectable: {
        id: number;
      } | null;
      type: string;
      section: string | DateTuple;
      note?: string;
    };
