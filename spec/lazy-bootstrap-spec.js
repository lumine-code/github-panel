const path = require("node:path");
const { spawnSync } = require("node:child_process");

describe("github-panel lazy bootstrap", () => {
  it("publishes commands and connects services before loading its runtime", () => {
    const root = path.dirname(__dirname);
    const eventKit = require.resolve("@lumine-code/event-kit", {
      paths: [lumine.application.getResourcePath()],
    });
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `
      const assert = require('node:assert/strict');
      const Module = require('node:module');
      const api = require(${JSON.stringify(eventKit)});
      let runtimeLoads = 0, activations = 0, invocations = 0, connected = null, retireOnConnect = false;
      let repositorySetup = null, treeSelection = null;
      class Runtime {
        activate(context) {
          assert.equal(context.entryPointsRegistered, true);
          assert.equal(context.marker, 'context');
          
          this.activated = true;
          activations++;
        }
        consumeBusySignal() { return new api.Disposable(); }
        consumeGitPanel() { return new api.Disposable(); }
        consumeRepositorySetup(service) {
          repositorySetup = service;
          return new api.Disposable(() => { if (repositorySetup === service) repositorySetup = null; });
        }
        consumeTreeViewSelection(service) {
          treeSelection = service;
          return new api.Disposable(() => { if (treeSelection === service) treeSelection = null; });
        }
        consumeDiff(service) {
          connected = service;
          if (retireOnConnect) main.deactivate();
          return new api.Disposable(() => { if (connected === service) connected = null; });
        }
        invokeGitController() { invocations++; }
        invokeRootController() { invocations++; }
        createIssueishPaneItem({uri}) { return {kind: 'issueish', uri}; }
        createReviewsPaneItem({uri}) { return {kind: 'reviews', uri}; }
        deactivate() { this.activated = false; return Promise.resolve(); }
      }
      const originalLoad = Module._load;
      Module._load = function(request, ...args) {
        if(request === 'lumine') return api;
        if(request === './github-package') { runtimeLoads++; return Runtime; }
        if(request === '@lumine-code/etch') return {setScheduler() {}};
        if(request === './diff-service') return {setDiffService(service) {connected = service;}};
        return originalLoad.call(this, request, ...args);
      };
      let commands, opener, registrations = 0;
      global.lumine = {
        views: {}, config: {get: () => false},
        repositories: { getActiveRepositoryContext: () => ({workingDirectory: 'current', pinned: true}) },
        window: {confirm() {}, getInitialPaths() {}},
        getConfigDirPath: () => '/unused',
        commands: {add(_selector, entries) {
          commands = entries; registrations++;
          return new api.Disposable(() => registrations--);
        }},
        workspace: {addOpener(handler) {opener = handler; return new api.Disposable(() => { if (opener === handler) opener = null; });}},
      };
      const main = require(${JSON.stringify(path.join(root, "lib/index.js"))});
      assert.equal(main.__esModule, undefined);
      assert.equal(main.then, undefined);
      assert.equal(main.config, undefined);
      assert.equal(main.restoreState, undefined);
      main.initialize();
      main.activate({marker: 'context'});
      const lease = main.consumeGitPanel({ marker: true }); const diff = main.consumeDiff({ marker: true });
      const setupProvider = {marker: 'setup'}, selectionProvider = {marker: 'selection'};
      const setupLease = main.consumeRepositorySetup(setupProvider);
      const selectionLease = main.consumeTreeViewSelection(selectionProvider);
      assert.equal(runtimeLoads, 0);
      assert.equal(registrations, 1);
      assert.equal(typeof commands['github-panel:publish-repository'].didDispatch, 'function');
      assert.equal(opener('file:///unrelated.txt'), undefined);
      assert.equal(runtimeLoads, 0);
      const issueUri = 'lumine-github://issueish/github.com/lumine-code/lumine/1?workdir=';
      assert.deepEqual(opener(issueUri), {kind: 'issueish', uri: issueUri});
      assert.equal(runtimeLoads, 1);
      assert.equal(activations, 1);
      const reviewsUri = 'lumine-github://reviews/github.com/lumine-code/lumine/1?workdir=';
      assert.deepEqual(opener(reviewsUri), {kind: 'reviews', uri: reviewsUri});
      assert.equal(activations, 1);
      
      assert.equal(commands['github-panel:show-rate-limit'].description.length > 0, true);
      lease.dispose();
      commands['github-panel:show-rate-limit'].didDispatch();
      assert.equal(runtimeLoads, 1);
      assert.equal(activations, 1);
      assert.equal(invocations, 1);
      assert.equal(registrations, 1);
      assert.equal(repositorySetup, setupProvider);
      assert.equal(treeSelection, selectionProvider);
      setupLease.dispose(); selectionLease.dispose();
      assert.equal(repositorySetup, null);
      assert.equal(treeSelection, null);
      retireOnConnect = true; main.consumeDiff({marker: 'retired'}); assert.equal(connected, null); retireOnConnect = false;
      (async () => {
        await main.deactivate();
        assert.equal(registrations, 0);
        assert.equal(opener, null);
        main.activate({marker: 'context'});
        assert.equal(runtimeLoads, 1);
        assert.equal(activations, 2);
        await main.deactivate();
        assert.equal(registrations, 0);
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `,
      ],
      {
        encoding: "utf8",
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        timeout: 20000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status)
      .withContext(result.stderr || result.stdout)
      .toBe(0);
  });
});
