export function displayError(error: Error): string {
  let str = "";
  while (true) {
    if (str) {
      str += ": ";
    }
    str += error.message;
    if (error.cause instanceof Error) {
      error = error.cause;
    } else if (error.cause === undefined) {
      return str;
    } else {
      console.error(error);
      throw new TypeError("Unexpected non-Error error");
    }
  }
}
