/** @babel */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import LocalRepository from "../lib/local-repository.js";
import { publishRepository } from "../lib/views/create-dialog.js";
import { expectGraphQLQuery, clearGraphQLExpectations } from "../lib/graphql/client.js";

describe("GitHub publishing with and without commits", () => {
  let directory, temporaryRoot, repository;
  const input = {
    ownerID: "owner-id",
    name: "published",
    visibility: "PRIVATE",
    protocol: "https",
    sourceRemoteName: "origin",
  };

  beforeEach(async () => {
    temporaryRoot = await fs.realpath(os.tmpdir());
    directory = await fs.realpath(await fs.mkdtemp(path.join(temporaryRoot, "github-publish-")));
    repository = new LocalRepository(directory);
    expectGraphQLQuery(
      {
        name: "createRepositoryMutation",
        variables: {
          input: { name: input.name, ownerId: input.ownerID, visibility: input.visibility },
        },
      },
      { createRepository: { repository: { url: "https://github.com/example/published" } } },
    ).resolve();
  });

  afterEach(async () => {
    clearGraphQLExpectations();
    repository.destroy();
    if (repository.core) lumine.repositories.forget(repository.core);
    const resolved = await fs.realpath(directory);
    const relative = path.relative(temporaryRoot, resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Publication fixture escaped its temporary root.");
    await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  function publish() {
    return publishRepository(input, {
      repository,
      relayEnvironment: { endpoint: {}, token: "fixture-token" },
    });
  }

  for (const existing of [false, true]) {
    it(`configures a GitHub remote without pushing ${existing ? "an existing unborn repository" : "a folder without Git"}`, async () => {
      if (existing)
        repository.setCore(
          await lumine.repositories.initialize(directory, { initialBranch: "main" }),
        );
      const push = spyOn(repository, "push").and.resolveTo();
      await publish();
      expect(push).not.toHaveBeenCalled();
      expect(await repository.hasCommits()).toBe(false);
      expect((await repository.getRemotes({ fresh: true })).withName("origin").getUrl()).toBe(
        "https://github.com/example/published",
      );
    });
  }

  it("pushes existing history and sets its upstream", async () => {
    const core = await lumine.repositories.initialize(directory, { initialBranch: "main" });
    repository.setCore(core);
    const operations = core.getOperations();
    const hooks = path.join(directory, "empty-hooks");
    await fs.mkdir(hooks);
    await operations.setConfig("core.hooksPath", hooks);
    await operations.setConfig("commit.gpgSign", "false");
    await operations.setConfig("user.name", "Publication Fixture");
    await operations.setConfig("user.email", "publication@example.invalid");
    await fs.writeFile(path.join(directory, "README.md"), "Fixture.\n");
    await operations.stageFiles(["README.md"]);
    await operations.commit("Create publication fixture");
    const push = spyOn(repository, "push").and.resolveTo();
    await publish();
    expect(push).toHaveBeenCalledTimes(1);
    const [branch, { remote, setUpstream }] = push.calls.mostRecent().args;
    expect(branch).toBe("main");
    expect(remote.getName()).toBe("origin");
    expect(setUpstream).toBe(true);
  });
});
