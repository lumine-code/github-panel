/** @babel */
import RepositoryPool from "../lib/repository-pool";

function deferred() {
  let resolve;
  const promise = new Promise((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function coreRepository(directory, url) {
  const snapshot = {
    head: { name: "main", oid: null },
    branches: [],
    remotes: [{ name: "origin", fetchUrl: url }],
  };
  return {
    getWorkingDirectory: () => directory,
    isDestroyed: () => false,
    refreshStatusSnapshot: jasmine
      .createSpy("refreshStatusSnapshot")
      .and.resolveTo({ initialized: true }),
    refreshRefsSnapshot: jasmine.createSpy("refreshRefsSnapshot").and.resolveTo(snapshot),
    ensureRefsSnapshot: jasmine.createSpy("ensureRefsSnapshot").and.resolveTo(snapshot),
    snapshot,
  };
}

describe("GitHub core repository projections", () => {
  let pool;
  beforeEach(() => {
    pool = new RepositoryPool();
  });
  afterEach(() => pool.clear());

  it("selects a unique matching core repository while ignoring different hosts", async () => {
    const match = coreRepository("/matching", "git@github.com:owner/repo.git");
    const other = coreRepository("/elsewhere", "https://gitlab.com/owner/repo.git");
    spyOn(lumine.repositories, "getRepositories").and.returnValue([match, other]);
    spyOn(lumine.repositories, "getForPath").and.returnValue(null);
    const context = await pool.getMatchingContext("github.com", "owner", "repo");
    expect(context.getRepository().core).toBe(match);
  });

  it("returns an absent projection when several repositories match the remote", async () => {
    spyOn(lumine.repositories, "getRepositories").and.returnValue([
      coreRepository("/first", "https://github.com/owner/repo.git"),
      coreRepository("/second", "git@github.com:owner/repo.git"),
    ]);
    spyOn(lumine.repositories, "getForPath").and.returnValue(null);
    const context = await pool.getMatchingContext("github.com", "owner", "repo");
    expect(context.getRepository()).toBe(pool.getAbsentRepository());
  });

  it("drops a matching result that completes after the projection pool is cleared", async () => {
    const core = coreRepository("/repository", "https://github.com/owner/repo.git");
    const read = deferred();
    core.refreshRefsSnapshot.and.returnValue(read.promise);
    spyOn(lumine.repositories, "getRepositories").and.returnValue([core]);
    spyOn(lumine.repositories, "getForPath").and.returnValue(null);
    const matching = pool.getMatchingContext("github.com", "owner", "repo");
    pool.clear();
    read.resolve(core.snapshot);
    const context = await matching;
    expect(context.getRepository()).toBe(pool.getAbsentRepository());
    expect(pool.contexts.size).toBe(0);
  });

  it("releases both acquired and late-acquired core leases when the pool is cleared", async () => {
    const core = coreRepository("/repository", "https://github.com/owner/repo.git");
    const late = deferred();
    const disposeCurrent = jasmine.createSpy("dispose current lease");
    const disposeLate = jasmine.createSpy("dispose late lease");
    spyOn(lumine.repositories, "getForPath").and.returnValue(core);
    spyOn(lumine.repositories, "add").and.returnValues(
      Promise.resolve({ repository: core, dispose: disposeCurrent }),
      late.promise,
    );
    const current = pool.retain("/repository");
    await current.ready;
    const pending = pool.retain("/late-repository");
    pool.clear();
    expect(disposeCurrent).toHaveBeenCalledTimes(1);
    late.resolve({ repository: core, dispose: disposeLate });
    await pending.ready;
    expect(disposeLate).toHaveBeenCalledTimes(1);
    current.dispose();
    pending.dispose();
    expect(disposeCurrent).toHaveBeenCalledTimes(1);
    expect(disposeLate).toHaveBeenCalledTimes(1);
  });
});
