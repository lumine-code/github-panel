/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import { getDiffService } from "../diff-service";

// Review context uses the same read-only renderer and layout controls as the
// complete PR diff. The preview owns its clipped snapshot independently.
export default class PatchPreviewView extends View {
  constructor(props, children) {
    super(props, children);
    this.sourcePatchLease = this.props.multiFilePatch.retain();
    this.previewPatches = new Set();
    this.initialize();
  }

  update(props, children) {
    if (this.destroyed) return Promise.resolve();
    if (props.multiFilePatch === this.props.multiFilePatch) return super.update(props, children);
    const previousLease = this.sourcePatchLease;
    this.sourcePatchLease = props.multiFilePatch.retain();
    try {
      return Promise.resolve(super.update(props, children)).finally(() => previousLease.dispose());
    } catch (error) {
      previousLease.dispose();
      throw error;
    }
  }

  state = {
    lastPatch: null,
    lastFileName: null,
    lastDiffRow: null,
    lastMaxRowCount: null,
    previewPatch: null,
  };

  static deriveState(props, state) {
    if (
      props.multiFilePatch === state.lastPatch &&
      props.fileName === state.lastFileName &&
      props.diffRow === state.lastDiffRow &&
      props.maxRowCount === state.lastMaxRowCount
    ) {
      return null;
    }
    const previewPatch = props.multiFilePatch.createPreviewPatch(
      props.fileName,
      props.diffRow,
      props.maxRowCount,
    );
    return {
      lastPatch: props.multiFilePatch,
      lastFileName: props.fileName,
      lastDiffRow: props.diffRow,
      lastMaxRowCount: props.maxRowCount,
      previewPatch,
    };
  }

  deriveState() {
    super.deriveState();
    this.previewPatches.add(this.state.previewPatch);
  }

  didUpdate() {
    for (const patch of this.previewPatches) {
      if (patch === this.state.previewPatch) continue;
      patch.dispose();
      this.previewPatches.delete(patch);
    }
  }

  willDestroy() {
    for (const patch of this.previewPatches) patch.dispose();
    this.previewPatches.clear();
    this.sourcePatchLease.dispose();
  }

  render() {
    const ChangesView = getDiffService()?.ChangesView;
    if (!ChangesView)
      return <div className="text-subtle">The git-panel.diff service is inactive.</div>;
    return (
      <div
        className="github-panel-PatchPreviewView"
        attributes={{ "data-context-menu-boundary": "" }}
        style={{ height: `${Math.max(12, Math.min(26, 10 + this.props.maxRowCount * 1.5))}em` }}
      >
        <ChangesView
          title="Review Context"
          compact={true}
          multiFilePatch={this.state.previewPatch}
          readOnly={true}
          config={this.props.config || lumine.config}
          workspace={this.props.workspace || lumine.workspace}
          commands={this.props.commands || lumine.commands}
          keymaps={this.props.keymaps || lumine.keymaps}
          tooltips={this.props.tooltips || lumine.tooltips}
        />
      </div>
    );
  }
}
