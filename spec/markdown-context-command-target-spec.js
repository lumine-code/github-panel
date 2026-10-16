/** @babel */
const { BareGithubDotcomMarkdown } = require("../lib/views/github-dotcom-markdown");

describe("GitHub Markdown context command targets", () => {
  let view;
  const url = "https://github.com/owner/repository/issues/42";

  beforeEach(() => {
    view = new BareGithubDotcomMarkdown({
      html: `<a class="issue-link" data-url="${url}" href="${url}"><strong>Issue</strong></a>`,
      openIssueishLinkInNewTab: jasmine.createSpy("openIssueishLinkInNewTab"),
      openLinkInBrowser: jasmine.createSpy("openLinkInBrowser"),
      switchToIssueish: jasmine.createSpy("switchToIssueish"),
    });
    jasmine.attachToDOM(view.element);
  });

  afterEach(async () => {
    await view.destroy();
  });

  it("opens the link containing the clicked child in a new tab", () => {
    lumine.commands.dispatch(
      view.element.querySelector("strong"),
      "github-panel:open-link-in-new-tab",
    );
    expect(view.props.openIssueishLinkInNewTab).toHaveBeenCalledOnceWith(url);
  });

  it("opens the link containing the clicked child in the same tab", () => {
    lumine.commands.dispatch(
      view.element.querySelector("strong"),
      "github-panel:open-link-in-this-tab",
    );
    expect(view.props.switchToIssueish).toHaveBeenCalledOnceWith("owner", "repository", 42);
  });

  it("opens the link containing the clicked child in the browser", () => {
    lumine.commands.dispatch(
      view.element.querySelector("strong"),
      "github-panel:open-link-in-browser",
    );
    expect(view.props.openLinkInBrowser).toHaveBeenCalledOnceWith(url);
  });
});
