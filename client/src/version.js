// Single source of truth is client/package.json — Vite inlines this import at
// build time, so bumping the package version is all that's needed.
import { version } from "../package.json";

export const VERSION = version;
