import { readFileSync } from "node:fs";

/** The greeting event names the running app version. */
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
export const APP_VERSION: string = pkg.version;
