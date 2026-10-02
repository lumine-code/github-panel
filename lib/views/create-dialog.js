/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import fs from "fs/promises";
import CreateDialogContainer from "../containers/create-dialog-container";
import createRepositoryMutation from "../mutations/create-repository";
export default class CreateDialog extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    return <CreateDialogContainer {...this.props} environment={this.props.environment} />;
  }
}
export async function createRepository(
  { ownerID, name, visibility, localPath, protocol, sourceRemoteName },
  { clone, relayEnvironment },
) {
  await fs.mkdir(localPath, {
    recursive: true,
    mode: 0o755,
  });
  const result = await createRepositoryMutation(relayEnvironment, {
    name,
    ownerID,
    visibility,
  });
  const sourceURL = result.createRepository.repository[protocol === "ssh" ? "sshUrl" : "url"];
  await clone(sourceURL, localPath, sourceRemoteName);
}
export async function publishRepository(
  { ownerID, name, visibility, protocol, sourceRemoteName },
  { repository, relayEnvironment },
) {
  let defaultBranchName, wasEmpty;
  if (repository.isEmpty()) {
    wasEmpty = true;
    await repository.init();
    defaultBranchName = "master";
  } else {
    wasEmpty = false;
    const branchSet = await repository.getBranches();
    const branchNames = new Set(branchSet.getNames());
    if (branchNames.has("master")) {
      defaultBranchName = "master";
    } else {
      const head = branchSet.getHeadBranch();
      if (head.isPresent()) {
        defaultBranchName = head.getName();
      }
    }
  }
  if (!defaultBranchName) {
    throw new Error("Unable to determine the desired default branch from the repository");
  }
  const result = await createRepositoryMutation(relayEnvironment, {
    name,
    ownerID,
    visibility,
  });
  const sourceURL = result.createRepository.repository[protocol === "ssh" ? "sshUrl" : "url"];
  const remote = await repository.addRemote(sourceRemoteName, sourceURL);
  if (!wasEmpty) {
    await repository.push(defaultBranchName, {
      remote,
      setUpstream: true,
    });
  }
}
