/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import cx from "classnames";
import { checkoutStates } from "../controllers/pr-checkout-controller";
export default class CheckoutButton extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const { checkoutOp } = this.props;
    const extraClasses = this.props.classNames || [];
    let buttonText = "Checkout";
    let buttonTitle = null;
    if (!checkoutOp.isEnabled()) {
      buttonTitle = checkoutOp.getMessage();
      const reason = checkoutOp.why();
      if (reason === checkoutStates.HIDDEN) {
        return (
          <span
            style={{
              display: "contents",
            }}
          >
            {null}
          </span>
        );
      }
      buttonText = reason.when({
        current: "Checked out",
        default: "Checkout",
      });
      extraClasses.push(
        this.props.classNamePrefix +
          reason.when({
            disabled: "disabled",
            busy: "busy",
            current: "current",
          }),
      );
    }
    const classNames = cx("btn", "btn-primary", "checkoutButton", ...extraClasses);
    return (
      <button
        className={classNames}
        disabled={!checkoutOp.isEnabled()}
        title={buttonTitle}
        onClick={() => checkoutOp.run()}
      >
        {buttonText}
      </button>
    );
  }
}
