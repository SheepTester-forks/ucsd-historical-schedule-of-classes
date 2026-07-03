type State =
  | {
      type: "before-dept";
      next: "tr" | "td" | "br" | "h2";
    }
  | {
      type: "after-dept";
      next: "td" | "tr";
    }
  | { type: "before-subject" };

const initState: State = { type: "before-dept", next: "tr" };

function process(state: State, line: string): State {
  if (state.type === "before-dept" && state.next === "tr" && line === "<tr>") {
    return { ...state, next: "td" };
  }
  if (
    state.type === "before-dept" &&
    state.next === "td" &&
    line === '<td colspan="13">'
  ) {
    return { ...state, next: "br" };
  }
  if (state.type === "before-dept" && state.next === "td" && line === "<br>") {
    return { ...state, next: "h2" };
  }
  if (state.type === "before-dept" && state.next === "h2") {
    const match = line.match(
      /^<h2> <span class="centeralign">([A-Za-z ]{35})<\/span> <\/h2>$/,
    );
    if (match) {
      return { type: "after-dept", next: "td" };
    }
  }
  if (state.type === "after-dept" && state.next === "td" && line === "</td>") {
    return { ...state, next: "tr" };
  }
  if (state.type === "after-dept" && state.next === "tr" && line === "</tr>") {
    return { ...state, next: "subject" };
  }
  throw new Error(
    `unknown state: ${JSON.stringify(state)} ${JSON.stringify(line)}`,
  );
}
