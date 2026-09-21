/** @babel */

import openExternal from "../lib/open-external";

describe("openExternal", () => {
  it("uses the constrained Lumine shell service", async () => {
    spyOn(lumine.shell, "openExternal").and.resolveTo();

    expect(await openExternal("https://github.com/lumine-code/lumine")).toBe(true);
    expect(lumine.shell.openExternal).toHaveBeenCalledWith("https://github.com/lumine-code/lumine");
  });

  it("reports rejected GitHub links without leaking a promise rejection", async () => {
    const error = new Error("unsupported protocol");
    spyOn(lumine.shell, "openExternal").and.rejectWith(error);
    spyOn(lumine.notifications, "addWarning");

    expect(await openExternal("error: bad response")).toBe(false);
    expect(lumine.notifications.addWarning).toHaveBeenCalledWith(
      "Unable to open the GitHub link.",
      { detail: error.message, dismissable: true },
    );
  });
});
