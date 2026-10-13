/** @babel */

import { createRequire } from "node:module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

describe("github-panel after the Relay removal", () => {
  it("requires every lib module without error", () => {
    const libDir = path.join(import.meta.dirname, "..", "lib");
    const failures = [];
    for (const file of walk(libDir, [])) {
      try {
        require(file);
      } catch (e) {
        failures.push(`${path.relative(libDir, file)}: ${e.message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
