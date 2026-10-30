const registerGlobalCommands = require("../lib/bootstrap-commands");

describe("GitHub command availability without local repositories", () => {
  let commands, cached, loadRuntime;
  beforeEach(() => {
    cached = null;
    loadRuntime = jasmine.createSpy("load runtime");
    registerGlobalCommands(
      {
        add(_selector, entries) {
          commands = entries;
        },
      },
      loadRuntime,
      () => cached,
    );
  });

  it("keeps browsing and setup entry points independent of local Git", () => {
    expect(commands["github-panel:toggle"].isAvailable).toBeUndefined();
    expect(commands["github-panel:open-issue-or-pull-request"].isAvailable).toBeUndefined();
    expect(commands["github-panel:create-repository"].isAvailable({})).toBe(true);
    expect(commands["github-panel:publish-repository"].isAvailable({})).toBe(true);
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it("checks known credential presence without opening the keychain or cold runtime", () => {
    cached = {
      loginModel: { hasCredential: jasmine.createSpy("cached credential").and.returnValue(false) },
    };
    expect(commands["github-panel:logout"].isAvailable({})).toBe(false);
    expect(commands["github-panel:publish-repository"].isAvailable({})).toBe(false);
    cached.loginModel.hasCredential.and.returnValue(true);
    expect(commands["github-panel:logout"].isAvailable({})).toBe(true);
    expect(loadRuntime).not.toHaveBeenCalled();
  });
});
