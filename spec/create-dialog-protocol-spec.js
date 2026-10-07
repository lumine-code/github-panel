/** @babel */
import path from "path";
import os from "os";
import { createViewModel } from "./helpers/etch";

describe("GitHub create dialog protocol ownership", () => {
  let controller, request, config, packageMetadata;

  beforeEach(() => {
    packageMetadata = lumine.packages.loadPackage("github-panel").metadata;
    config = lumine.config;
    request = {
      getParams: () => ({ localDir: path.join(os.tmpdir(), "github-protocol-fixture") }),
      accept: jasmine.createSpy("accept").and.resolveTo(undefined),
    };
    const loaded = require("../lib/controllers/create-dialog-controller");
    controller = createViewModel(loaded.default || loaded, {
      config,
      request,
      user: { id: "owner" },
    });
  });

  afterEach(() => {
    controller.destroy();
    for (const buffer of [controller.repoName, controller.localPath, controller.sourceRemoteName]) {
      if (!buffer.isDestroyed()) buffer.destroy();
    }
  });

  it("declares and defaults the forge protocol independently of the Git panel", async () => {
    const setting = packageMetadata.configSchema.remoteFetchProtocol;
    expect(setting.default).toBe("https");
    expect(setting.enum).toEqual(["https", "ssh"]);
    config.set("git-panel.remoteFetchProtocol", "ssh");
    expect(controller.state.selectedProtocol).toBe("https");
    await controller.accept();
    expect(request.accept.calls.mostRecent().args[0].protocol).toBe("https");
  });

  it("saves a selected protocol only in the GitHub package and passes it to publishing", async () => {
    config.set("git-panel.remoteFetchProtocol", "https");
    const set = spyOn(config, "set").and.callThrough();
    await controller.didChangeProtocol("ssh");
    expect(config.get("github-panel.remoteFetchProtocol")).toBe("ssh");
    expect(config.get("git-panel.remoteFetchProtocol")).toBe("https");
    expect(set.calls.allArgs().map(([key]) => key)).toEqual(["github-panel.remoteFetchProtocol"]);
    await controller.accept();
    expect(request.accept.calls.mostRecent().args[0].protocol).toBe("ssh");
  });

  it("observes its own setting and removes that edge when the dialog closes", async () => {
    config.set("github-panel.remoteFetchProtocol", "ssh");
    await globalThis.flushMicrotasks();
    expect(controller.state.selectedProtocol).toBe("ssh");
    controller.destroy();
    const update = spyOn(controller, "updateState").and.callThrough();
    config.set("github-panel.remoteFetchProtocol", "https");
    await globalThis.flushMicrotasks();
    expect(update).not.toHaveBeenCalled();
  });
});
