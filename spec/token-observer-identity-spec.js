/** @babel */
import { Emitter } from "lumine";
import GitHubTabContainer from "../lib/containers/github-tab-container";
import CommentDecorationsContainer from "../lib/containers/comment-decorations-container";
import RemoteSet from "../lib/models/remote-set";
import { getEndpoint } from "../lib/models/endpoint";
import { createViewModel, createViewHost, flushViews, h } from "./helpers/etch";

function deferred() {
  let resolve;
  const promise = new Promise((complete) => (resolve = complete));
  return { promise, resolve };
}

function remote(name, endpoint) {
  return {
    getName: () => name,
    getEndpoint: () => endpoint,
    getEndpointOrDotcom: () => endpoint,
    isGithubRepo: () => true,
    isPresent: () => true,
    getProtocol: () => "https",
    getSlug: () => `${name}/repo`,
  };
}

describe("token observer account identity", () => {
  let element, host, container, emitter;
  const firstEndpoint = getEndpoint("first.example");
  const secondEndpoint = getEndpoint("second.example");
  const firstAccount = firstEndpoint.getLoginAccount();
  const secondAccount = secondEndpoint.getLoginAccount();
  const firstRemote = remote("first", firstEndpoint);
  const secondRemote = remote("second", secondEndpoint);
  const allRemotes = new RemoteSet([firstRemote, secondRemote]);
  const branches = {
    getHeadBranch: () => ({ getPush: () => ({ getRemoteName: () => "first" }) }),
  };

  beforeEach(() => {
    emitter = new Emitter();
    element = document.createElement("div");
    jasmine.attachToDOM(element);
    host = createViewHost(element);
  });

  afterEach(async () => {
    await host.destroy();
    await container?.destroy();
    emitter.dispose();
    element.remove();
  });

  for (const kind of ["tab", "comment decorations"]) {
    function makeRenderer(loginModel, renderToken) {
      if (kind === "tab") {
        container = createViewModel(GitHubTabContainer, { loginModel });
        container.renderToken = renderToken;
        return (currentRemote) =>
          container.renderRepositoryData({
            allRemotes: new RemoteSet(
              Array.from(allRemotes, (existing) =>
                existing.getName() === currentRemote.getName() ? currentRemote : existing,
              ),
            ),
            branches,
            selectedRemoteName: currentRemote.getName(),
          });
      }
      container = createViewModel(CommentDecorationsContainer, { loginModel });
      container.renderWithToken = (token, { repoData }) => renderToken(token, repoData);
      return (currentRemote) =>
        container.renderWithLocalRepositoryData({
          branches,
          remotes: allRemotes,
          currentRemote,
        });
    }

    it(`clears the ${kind} token on an account switch and ignores a late previous-account read`, async () => {
      const oldRead = deferred();
      const currentRead = deferred();
      const plans = new Map([
        [firstAccount, [Promise.resolve("first-token"), oldRead.promise]],
        [secondAccount, [currentRead.promise]],
      ]);
      const loginModel = {
        onDidUpdate: (callback) => emitter.on("did-update", callback),
        getToken: jasmine
          .createSpy("account token")
          .and.callFake((account) => plans.get(account).shift()),
      };
      const uses = [];
      const render = makeRenderer(loginModel, (token, repoData) => {
        const account = repoData.currentRemote.getEndpoint().getLoginAccount();
        uses.push({ account, token });
        return h("output", {}, token || "pending");
      });

      await flushViews(() => host.update(render(firstRemote)));
      expect(element.textContent).toBe("first-token");
      await flushViews(() => emitter.emit("did-update"));
      expect(element.textContent).toBe("first-token");

      await flushViews(() => host.update(render(secondRemote)));
      expect(loginModel.getToken).toHaveBeenCalledWith(secondAccount);
      expect(element.textContent).toBe("pending");
      expect(
        uses.some(({ account, token }) => account === secondAccount && token === "first-token"),
      ).toBe(false);

      oldRead.resolve("late-first-token");
      await flushViews(() => {});
      expect(element.textContent).toBe("pending");
      expect(
        uses.some(
          ({ account, token }) => account === secondAccount && token === "late-first-token",
        ),
      ).toBe(false);
      expect(uses.some(({ token }) => token === "late-first-token")).toBe(false);

      currentRead.resolve("second-token");
      await flushViews(() => {});
      expect(element.textContent).toBe("second-token");
      expect(uses.at(-1)).toEqual({ account: secondAccount, token: "second-token" });
    });

    it(`retains the ${kind} token when repository metadata changes within the same account`, async () => {
      const nextRead = deferred();
      const loginModel = {
        onDidUpdate: (callback) => emitter.on("did-update", callback),
        getToken: jasmine
          .createSpy("same account token")
          .and.returnValues(
            Promise.resolve("accepted-token"),
            nextRead.promise,
            Promise.resolve("accepted-token"),
          ),
      };
      const render = makeRenderer(loginModel, (token) => h("output", {}, token || "pending"));
      await flushViews(() => host.update(render(firstRemote)));
      const output = element.querySelector("output");
      await flushViews(() => emitter.emit("did-update"));
      const updatedRemote = remote("first", getEndpoint("first.example"));
      await flushViews(() => host.update(render(updatedRemote)));
      expect(element.querySelector("output")).toBe(output);
      expect(element.textContent).toBe("accepted-token");
      expect(
        loginModel.getToken.calls.allArgs().every(([account]) => account === firstAccount),
      ).toBe(true);
      nextRead.resolve("accepted-token");
      await flushViews(() => {});
      expect(element.textContent).toBe("accepted-token");
    });
  }
});
