import * as fs from "node:fs/promises";
import { parseJson } from "./types.mts";

const termsDir = new URL(
  "../../uxdy/scheduleofclasses/terms/",
  import.meta.url
);
const dir = await fs.readdir(termsDir).catch((error: NodeJS.ErrnoException) => {
  if (error.code === "ENOENT") {
    console.error(`Expected ${termsDir} to exist`);
    process.exit(0);
  } else {
    return Promise.reject(error);
  }
});
for (const jsonName of dir) {
  if (!/^(FA|WI|SP|SU|S[123])\d\d\.json$/.test(jsonName)) {
    continue;
  }
  console.log(
    parseJson(await fs.readFile(new URL(jsonName, termsDir), "utf-8"))
  );
  break;
}
