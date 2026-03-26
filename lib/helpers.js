/** @babel */
import path from "path";

import RefHolder from "./models/ref-holder";

export const PAGE_SIZE = 50;
export const PAGINATION_WAIT_TIME_MS = 100;
export const CHECK_SUITE_PAGE_SIZE = 10;
export const CHECK_RUN_PAGE_SIZE = 20;

export function autobind(self, ...methods) {
  for (const method of methods) {
    if (typeof self[method] !== "function") {
      throw new Error(`Unable to autobind method ${method}`);
    }
    self[method] = self[method].bind(self);
  }
}

// Extract a subset of props whose keys appear in a {key: true} dictionary.
//
// Usage:
//
// ```js
// const apiProps = {zero: true, one: true, two: true};
//
// class Component extends React.Component {
//   action() {
//     const options = extractProps(this.props, apiProps);
//     // options contains zero, one, and two only
//   }
// }
// ```
export function extractProps(props, propTypes, nameMap = {}) {
  return Object.keys(propTypes).reduce((opts, propName) => {
    if (props[propName] !== undefined) {
      const destPropName = nameMap[propName] || propName;
      opts[destPropName] = props[propName];
    }
    return opts;
  }, {});
}

// The opposite of extractProps. Return a subset of props that do *not* appear in a component's prop types.
export function unusedProps(props, propTypes) {
  return Object.keys(props).reduce((opts, propName) => {
    if (propTypes[propName] === undefined) {
      opts[propName] = props[propName];
    }
    return opts;
  }, {});
}

/*
 * On Windows, git commands report paths with / delimiters. Convert them to \-delimited paths
 * so that Atom unifromly treats paths with native path separators.
 */
export function toNativePathSep(rawPath) {
  if (process.platform !== "win32") {
    return rawPath;
  } else {
    return rawPath.split("/").join(path.sep);
  }
}

/**
 * Turns an array of things @kuychaco cannot eat
 * into a sentence containing things @kuychaco cannot eat
 *
 * ['toast'] => 'toast'
 * ['toast', 'eggs'] => 'toast and eggs'
 * ['toast', 'eggs', 'cheese'] => 'toast, eggs, and cheese'
 *
 * Oxford comma included because you're wrong, shut up.
 */
export function toSentence(array) {
  const len = array.length;
  if (len === 1) {
    return `${array[0]}`;
  } else if (len === 2) {
    return `${array[0]} and ${array[1]}`;
  }

  return array.reduce((acc, item, idx) => {
    if (idx === 0) {
      return `${item}`;
    } else if (idx === len - 1) {
      return `${acc}, and ${item}`;
    } else {
      return `${acc}, ${item}`;
    }
  }, "");
}

export function pushAtKey(map, key, value) {
  let existing = map.get(key);
  if (!existing) {
    existing = [];
    map.set(key, existing);
  }
  existing.push(value);
}

export function isCheckedOutPullRequest(
  branches,
  remotes,
  pullRequest,
  repository = pullRequest.repository,
) {
  if (!pullRequest.headRepository) {
    return false;
  }

  const headPush = branches.getHeadBranch().getPush();
  const headRemote = remotes.withName(headPush.getRemoteName());

  const fromPullRefspec =
    headRemote.getOwner() === repository.owner.login &&
    headRemote.getRepo() === repository.name &&
    headPush.getShortRemoteRef() === `pull/${pullRequest.number}/head`;

  const fromHeadRepo =
    headRemote.getOwner() === pullRequest.headRepository.owner.login &&
    headRemote.getRepo() === pullRequest.headRepository.name &&
    headPush.getShortRemoteRef() === pullRequest.headRefName;

  return fromPullRefspec || fromHeadRepo;
}

// Atom API pane item manipulation

export function createItem(node, componentHolder = null, uri = null, extra = {}) {
  const holder = componentHolder || new RefHolder();

  const override = {
    getElement: () => node,

    getRealItem: () => holder.getOr(null),

    getRealItemPromise: () => holder.getPromise(),

    ...extra,
  };

  if (uri) {
    override.getURI = () => uri;
  }

  if (componentHolder) {
    return new Proxy(override, {
      get(target, name) {
        if (Reflect.has(target, name)) {
          return target[name];
        }

        // The {value: ...} wrapper prevents .map() from flattening a returned RefHolder.
        // If component[name] is a RefHolder, we want to return that RefHolder as-is.
        const { value } = holder
          .map((component) => ({ value: component[name] }))
          .getOr({ value: undefined });
        return value;
      },

      set(target, name, value) {
        return holder
          .map((component) => {
            component[name] = value;
            return true;
          })
          .getOr(true);
      },

      has(target, name) {
        return (
          holder.map((component) => Reflect.has(component, name)).getOr(false) ||
          Reflect.has(target, name)
        );
      },
    });
  } else {
    return override;
  }
}

export const reactionTypeToEmoji = {
  THUMBS_UP: "👍",
  THUMBS_DOWN: "👎",
  LAUGH: "😆",
  HOORAY: "🎉",
  CONFUSED: "😕",
  HEART: "❤️",
  ROCKET: "🚀",
  EYES: "👀",
};

// Markdown

let marked = null;
let domPurify = null;

export function renderMarkdown(md) {
  if (marked === null) {
    marked = require("marked");

    if (domPurify === null) {
      domPurify = require("dompurify");
    }

    marked.setOptions({
      silent: true,
    });
  }

  return domPurify.sanitize(marked.parse(md));
}

// Show a native context menu popup using Pulsar's built-in context-menu infrastructure.
// `template` is an array of {label, command, enabled?, visible?} or {type: 'separator'}.
// Commands are dispatched to `target` when clicked.
export function showContextMenu(target, template) {
  atom.contextMenu.activeElement = target;
  atom.getCurrentWindow().emit("context-menu", template);
}

export const GHOST_USER = {
  login: "ghost",
  avatarUrl: "https://avatars1.githubusercontent.com/u/10137?v=4",
  url: "https://github.com/ghost",
};
