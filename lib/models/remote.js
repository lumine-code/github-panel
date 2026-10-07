/** @babel */
import { getEndpoint, DOTCOM } from "./endpoint";
import { parseGitRemote } from "lumine";
export default class Remote {
  constructor(name, url) {
    this.name = name;
    this.url = url;
    const { isGithubRepo, domain, protocol, owner, repo } = githubInfoFromRemote(url);
    this.githubRepo = isGithubRepo;
    this.domain = domain;
    this.protocol = protocol;
    this.owner = owner;
    this.repo = repo;
  }
  getName() {
    return this.name;
  }
  getUrl() {
    return this.url;
  }
  isGithubRepo() {
    return this.githubRepo;
  }
  getProtocol() {
    return this.protocol;
  }
  getDomain() {
    return this.domain;
  }
  getOwner() {
    return this.owner;
  }
  getRepo() {
    return this.repo;
  }
  getNameOr() {
    return this.getName();
  }
  getSlug() {
    if (this.owner === null || this.repo === null) {
      return null;
    }
    return `${this.owner}/${this.repo}`;
  }
  getEndpoint() {
    return this.domain === null ? null : getEndpoint(this.domain);
  }
  getEndpointOrDotcom() {
    return this.getEndpoint() || DOTCOM;
  }
  isPresent() {
    return true;
  }
}
function githubInfoFromRemote(url) {
  const descriptor = parseGitRemote(url);
  const github =
    descriptor?.host === "github.com" &&
    descriptor.namespace &&
    !descriptor.namespace.includes("/");
  return {
    isGithubRepo: Boolean(github),
    protocol: descriptor?.transport || null,
    domain: github ? descriptor.host : null,
    owner: github ? descriptor.namespace : null,
    repo: github ? descriptor.repository : null,
  };
}
export const nullRemote = {
  getName() {
    return "";
  },
  getUrl() {
    return "";
  },
  isGithubRepo() {
    return false;
  },
  getDomain() {
    return null;
  },
  getProtocol() {
    return null;
  },
  getOwner() {
    return null;
  },
  getRepo() {
    return null;
  },
  getNameOr(fallback) {
    return fallback;
  },
  getSlug() {
    return null;
  },
  getEndpoint() {
    return null;
  },
  getEndpointOrDotcom() {
    return DOTCOM;
  },
  isPresent() {
    return false;
  },
};
