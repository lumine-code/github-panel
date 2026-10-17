const path = require("path");

describe("GitHub panel theme roles", () => {
  let stylesheet;
  let container;

  beforeEach(() => {
    stylesheet = lumine.themes.requireStylesheet(path.join(__dirname, "..", "styles", "main.css"));
    container = document.createElement("div");
    container.style.cssText =
      "--accent-indicator-color: rgb(10,20,30); --accent-background-color: rgb(40,50,60); --accent-foreground-color: rgb(230,240,250); --button-background-color-selected: rgb(100,110,120); --text-color: rgb(70,80,90);";
    jasmine.attachToDOM(container);
  });

  afterEach(() => {
    container.remove();
    stylesheet.dispose();
  });

  it("keeps resolved review references readable without fading their child controls", () => {
    container.style.setProperty("--text-color-subtle", "rgb(100,110,120)");
    container.innerHTML =
      '<details class="resolved"><summary class="github-panel-Review-reference"><span class="github-panel-Review-file">source.js</span></summary></details>';
    const reference = container.querySelector("summary");
    expect(getComputedStyle(reference).opacity).toBe("1");
    expect(getComputedStyle(reference).color).toBe("rgb(100, 110, 120)");
  });

  it("colors the GitHub loading mark and its ring from the current theme accent", () => {
    container.innerHTML =
      '<div class="github-panel-Loader"><span class="github-panel-Spinner"></span></div>';
    const spinner = container.querySelector(".github-panel-Spinner");
    const mark = () => getComputedStyle(spinner, "::before");
    const ring = () => getComputedStyle(spinner, "::after");

    expect(mark().color).toBe("rgb(10, 20, 30)");
    expect(ring().borderRightColor).toBe("rgb(10, 20, 30)");

    container.style.setProperty("--accent-indicator-color", "rgb(80, 100, 120)");
    expect(mark().color).toBe("rgb(80, 100, 120)");
    expect(ring().borderRightColor).toBe("rgb(80, 100, 120)");
  });

  it("centers the loader both directly in the pane host and inside the GitHub content", async () => {
    const module = require("../lib/views/loading-view");
    const LoadingView = module.default || module;
    const loader = new LoadingView();
    const host = document.createElement("div");
    host.className = "github-panel-PaneItemHost-github";
    host.style.cssText = "width: 320px; height: 240px";
    container.appendChild(host);
    host.appendChild(loader.element);

    const expectCentered = () => {
      const mark = loader.element.querySelector(".github-panel-Spinner").getBoundingClientRect();
      const pane = host.getBoundingClientRect();
      expect(Math.abs(mark.x + mark.width / 2 - (pane.x + pane.width / 2))).toBeLessThan(1);
      expect(Math.abs(mark.y + mark.height / 2 - (pane.y + pane.height / 2))).toBeLessThan(1);
    };

    try {
      expectCentered();
      const panel = document.createElement("div");
      panel.className = "github-panel-GitHub";
      const content = document.createElement("div");
      content.className = "github-panel-GitHub-content";
      panel.appendChild(content);
      host.appendChild(panel);
      content.appendChild(loader.element);
      expectCentered();
    } finally {
      await loader.destroy();
    }
  });

  it("pairs focused owner options and keeps focus indicators independent of button fills", () => {
    container.innerHTML =
      '<div class="github-panel-RepositoryHome-owner"><div class="Select__option Select__option--is-focused">Owner</div></div><button class="github-panel-Dialog--insetButton">Focus</button><div class="github-panel-Review github-panel-Review--highlight"></div>';
    const option = getComputedStyle(container.querySelector(".Select__option"));
    expect(option.color).toBe("rgb(230, 240, 250)");
    expect(option.backgroundColor).toBe("rgb(40, 50, 60)");
    const button = container.querySelector("button");
    button.focus();
    expect(getComputedStyle(button).borderTopColor).toBe("rgb(10, 20, 30)");
    expect(getComputedStyle(container.querySelector(".github-panel-Review")).borderTopColor).toBe(
      "rgb(10, 20, 30)",
    );
  });

  it("uses a readable foreground on info-colored tooltips", () => {
    container.style.setProperty("--background-color-info", "rgb(40,50,60)");
    container.style.setProperty("--text-color-on-info", "rgb(230,240,250)");
    container.style.setProperty("--base-background-color", "rgb(100,110,120)");
    container.innerHTML =
      '<div class="github-panel-PrComment"><div class="js-suggested-changes-blob"><span class="tooltipped" aria-label="Description"></span></div></div>';
    const tooltip = getComputedStyle(container.querySelector(".tooltipped"), "::after");
    expect(tooltip.color).toBe("rgb(230, 240, 250)");
    expect(tooltip.backgroundColor).toBe("rgb(40, 50, 60)");
  });

  it("uses Git status colors for review diff lines instead of diagnostic colors", () => {
    container.style.setProperty("--text-color-removed", "rgb(140,30,20)");
    container.style.setProperty("--text-color-error", "rgb(10,20,180)");
    container.style.setProperty("--background-color-error", "rgb(20,30,190)");
    container.innerHTML = '<div class="github-panel-Review-diffLine is-deleted">Removed</div>';
    const removed = container.firstElementChild;
    const before = [getComputedStyle(removed).color, getComputedStyle(removed).backgroundColor];
    container.style.setProperty("--text-color-error", "rgb(1,2,3)");
    container.style.setProperty("--background-color-error", "rgb(4,5,6)");
    expect([getComputedStyle(removed).color, getComputedStyle(removed).backgroundColor]).toEqual(
      before,
    );
    container.style.setProperty("--text-color-removed", "rgb(30,140,40)");
    expect(getComputedStyle(removed).color).not.toBe(before[0]);
    expect(getComputedStyle(removed).backgroundColor).not.toBe(before[1]);
  });
});
