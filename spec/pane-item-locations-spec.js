/** @babel */
import GitHubTabItem from "../lib/items/github-tab-item";
import IssueishDetailItem from "../lib/items/issueish-detail-item";
import ReviewsItem from "../lib/items/reviews-item";
import PaneItemHost from "../lib/items/pane-item-host";
import GithubPanelPackage from "../lib/github-package";

describe("GitHub pane item locations", () => {
  it("keeps the main GitHub and review panels in the side docks", () => {
    for (const ItemType of [GitHubTabItem, ReviewsItem]) {
      expect(ItemType.prototype.getDefaultLocation()).toBe("right");
      expect(ItemType.prototype.getAllowedLocations()).toEqual(["right", "left"]);
    }
  });

  it("leaves issue and pull request details on the center-only fallback", () => {
    expect(IssueishDetailItem.prototype.getDefaultLocation).toBeUndefined();
    expect(IssueishDetailItem.prototype.getAllowedLocations).toBeUndefined();
  });

  it("serializes the hydrated GitHub panel with its stable URI", () => {
    const item = new GitHubTabItem({});
    const host = PaneItemHost.create("github", {
      uri: GitHubTabItem.buildURI(),
      serializeFallback: () => ({ deserializer: "GithubDockItem" }),
    });
    host.hydrate(item);

    expect(item.getURI()).toBe("lumine-github://dock-item/github");
    expect(host.serialize()).toEqual({
      deserializer: "GithubDockItem",
      uri: "lumine-github://dock-item/github",
    });
    host.destroy();
  });

  it("keeps deserialized review hosts in the same side docks as the real item", () => {
    const host = GithubPanelPackage.prototype.createReviewsStub.call(
      { controller: null },
      { uri: "lumine-github://reviews/github.com/owner/repo/1?workdir=" },
    );

    expect(host.getDefaultLocation()).toBe(ReviewsItem.prototype.getDefaultLocation());
    expect(host.getAllowedLocations()).toEqual(ReviewsItem.prototype.getAllowedLocations());
    host.destroy();
  });

  it("provides serializable hosts for GitHub pane items", () => {
    const packageInstance = { controller: null };
    const factories = [
      [
        GithubPanelPackage.prototype.createGitHubPaneItem,
        { uri: "lumine-github://dock-item/github" },
        "GithubDockItem",
      ],
      [
        GithubPanelPackage.prototype.createIssueishPaneItem,
        { uri: "lumine-github://issueish/github.com/owner/repo/1?workdir=" },
        "IssueishDetailItem",
      ],
      [
        GithubPanelPackage.prototype.createReviewsPaneItem,
        { uri: "lumine-github://reviews/github.com/owner/repo/1?workdir=" },
        "ReviewsStub",
      ],
    ];

    for (const [factory, options, deserializer] of factories) {
      const host = factory.call(packageInstance, options);
      expect(host.getHydrationState()).toBe("pending");
      expect(host.serialize()).toEqual(jasmine.objectContaining({ deserializer }));
      host.destroy();
    }
  });
});
