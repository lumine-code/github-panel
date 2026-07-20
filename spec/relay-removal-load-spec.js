/** @babel */
/* global describe, it, expect */
/* eslint-disable no-console */
import fs from "fs";
import path from "path";

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
    const libDir = path.join(__dirname, "..", "lib");
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
