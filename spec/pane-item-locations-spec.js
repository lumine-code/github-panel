/** @babel */
import GitHubTabItem from "../lib/items/github-tab-item";
import IssueishDetailItem from "../lib/items/issueish-detail-item";
import ReviewsItem from "../lib/items/reviews-item";

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
});
