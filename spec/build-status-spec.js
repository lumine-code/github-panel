/** @babel */
/* global describe, it, expect */
// Ported from pulsar-edit/github test/models/build-status.test.js (chai → Jasmine).
import {
  buildStatusFromStatusContext,
  buildStatusFromCheckResult,
  combineBuildStatuses,
} from "../lib/models/build-status";

describe("BuildStatus", () => {
  it("interprets an EXPECTED status context", () => {
    expect(buildStatusFromStatusContext({ state: "EXPECTED" })).toEqual({
      icon: "primitive-dot",
      classSuffix: "pending",
    });
  });

  it("interprets a PENDING status context", () => {
    expect(buildStatusFromStatusContext({ state: "PENDING" })).toEqual({
      icon: "primitive-dot",
      classSuffix: "pending",
    });
  });

  it("interprets a SUCCESS status context", () => {
    expect(buildStatusFromStatusContext({ state: "SUCCESS" })).toEqual({
      icon: "check",
      classSuffix: "success",
    });
  });

  it("interprets an ERROR status context", () => {
    expect(buildStatusFromStatusContext({ state: "ERROR" })).toEqual({
      icon: "alert",
      classSuffix: "failure",
    });
  });

  it("interprets a FAILURE status context", () => {
    expect(buildStatusFromStatusContext({ state: "FAILURE" })).toEqual({
      icon: "x",
      classSuffix: "failure",
    });
  });

  it("interprets an unexpected status context", () => {
    expect(buildStatusFromStatusContext({ state: "UNEXPECTED" })).toEqual({
      icon: "unverified",
      classSuffix: "pending",
    });
  });

  it("interprets a QUEUED check result", () => {
    expect(buildStatusFromCheckResult({ status: "QUEUED" })).toEqual({
      icon: "primitive-dot",
      classSuffix: "pending",
    });
  });

  it("interprets a REQUESTED check result", () => {
    expect(buildStatusFromCheckResult({ status: "REQUESTED" })).toEqual({
      icon: "primitive-dot",
      classSuffix: "pending",
    });
  });

  it("interprets an IN_PROGRESS check result", () => {
    expect(buildStatusFromCheckResult({ status: "IN_PROGRESS" })).toEqual({
      icon: "primitive-dot",
      classSuffix: "pending",
    });
  });

  it("interprets a SUCCESS check conclusion", () => {
    expect(buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "SUCCESS" })).toEqual({
      icon: "check",
      classSuffix: "success",
    });
  });

  it("interprets a FAILURE check conclusion", () => {
    expect(buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "FAILURE" })).toEqual({
      icon: "x",
      classSuffix: "failure",
    });
  });

  it("interprets a TIMED_OUT check conclusion", () => {
    expect(buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "TIMED_OUT" })).toEqual({
      icon: "alert",
      classSuffix: "failure",
    });
  });

  it("interprets a CANCELLED check conclusion", () => {
    expect(buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "CANCELLED" })).toEqual({
      icon: "alert",
      classSuffix: "failure",
    });
  });

  it("interprets an ACTION_REQUIRED check conclusion", () => {
    expect(
      buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "ACTION_REQUIRED" }),
    ).toEqual({
      icon: "bell",
      classSuffix: "failure",
    });
  });

  it("interprets a NEUTRAL check conclusion", () => {
    expect(buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "NEUTRAL" })).toEqual({
      icon: "dash",
      classSuffix: "neutral",
    });
  });

  it("interprets an unexpected check status", () => {
    expect(buildStatusFromCheckResult({ status: "WAT" })).toEqual({
      icon: "unverified",
      classSuffix: "pending",
    });
  });

  it("interprets an unexpected check conclusion", () => {
    expect(buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "HUH" })).toEqual({
      icon: "unverified",
      classSuffix: "pending",
    });
  });

  describe("combine", () => {
    const actionRequireds = [
      buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "ACTION_REQUIRED" }),
    ];
    const pendings = [
      buildStatusFromCheckResult({ status: "QUEUED" }),
      buildStatusFromCheckResult({ status: "IN_PROGRESS" }),
      buildStatusFromCheckResult({ status: "REQUESTED" }),
      buildStatusFromStatusContext({ state: "EXPECTED" }),
      buildStatusFromStatusContext({ state: "PENDING" }),
    ];
    const errors = [
      buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "TIMED_OUT" }),
      buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "CANCELLED" }),
      buildStatusFromStatusContext({ state: "ERROR" }),
    ];
    const failures = [
      buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "FAILURE" }),
      buildStatusFromStatusContext({ state: "FAILURE" }),
    ];
    const successes = [
      buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "SUCCESS" }),
      buildStatusFromStatusContext({ state: "SUCCESS" }),
    ];
    const neutrals = [buildStatusFromCheckResult({ status: "COMPLETED", conclusion: "NEUTRAL" })];

    it("combines nothing into NEUTRAL", () => {
      expect(combineBuildStatuses()).toEqual({ icon: "dash", classSuffix: "neutral" });
    });

    it("combines anything and ACTION_REQUIRED into ACTION_REQUIRED", () => {
      const all = [
        ...actionRequireds,
        ...pendings,
        ...errors,
        ...failures,
        ...successes,
        ...neutrals,
      ];

      const actionRequired = buildStatusFromCheckResult({
        status: "COMPLETED",
        conclusion: "ACTION_REQUIRED",
      });
      for (const buildStatus of all) {
        expect(combineBuildStatuses(buildStatus, actionRequired)).toEqual({
          icon: "bell",
          classSuffix: "failure",
        });
        expect(combineBuildStatuses(actionRequired, buildStatus)).toEqual({
          icon: "bell",
          classSuffix: "failure",
        });
      }
    });

    it("combines anything but ACTION_REQUIRED and ERROR into ERROR", () => {
      const rest = [...errors, ...pendings, ...failures, ...successes, ...neutrals];

      for (const errorStatus of errors) {
        for (const otherStatus of rest) {
          expect(combineBuildStatuses(otherStatus, errorStatus)).toEqual({
            icon: "alert",
            classSuffix: "failure",
          });
          expect(combineBuildStatuses(errorStatus, otherStatus)).toEqual({
            icon: "alert",
            classSuffix: "failure",
          });
        }
      }
    });

    it("combines anything but ACTION_REQUIRED or ERROR and FAILURE into FAILURE", () => {
      const rest = [...pendings, ...failures, ...successes, ...neutrals];

      for (const failureStatus of failures) {
        for (const otherStatus of rest) {
          expect(combineBuildStatuses(otherStatus, failureStatus)).toEqual({
            icon: "x",
            classSuffix: "failure",
          });
          expect(combineBuildStatuses(failureStatus, otherStatus)).toEqual({
            icon: "x",
            classSuffix: "failure",
          });
        }
      }
    });

    it("combines anything but ACTION_REQUIRED, ERROR, or FAILURE and PENDING into PENDING", () => {
      const rest = [...pendings, ...successes, ...neutrals];

      for (const pendingStatus of pendings) {
        for (const otherStatus of rest) {
          expect(combineBuildStatuses(otherStatus, pendingStatus)).toEqual({
            icon: "primitive-dot",
            classSuffix: "pending",
          });
          expect(combineBuildStatuses(pendingStatus, otherStatus)).toEqual({
            icon: "primitive-dot",
            classSuffix: "pending",
          });
        }
      }
    });

    it("combines SUCCESSes into SUCCESS", () => {
      const rest = [...successes, ...neutrals];

      for (const successStatus of successes) {
        for (const otherStatus of rest) {
          expect(combineBuildStatuses(otherStatus, successStatus)).toEqual({
            icon: "check",
            classSuffix: "success",
          });
          expect(combineBuildStatuses(successStatus, otherStatus)).toEqual({
            icon: "check",
            classSuffix: "success",
          });
        }
      }
    });

    it("ignores NEUTRAL", () => {
      const all = [
        ...actionRequireds,
        ...pendings,
        ...errors,
        ...failures,
        ...successes,
        ...neutrals,
      ];

      for (const neutralStatus of neutrals) {
        for (const otherStatus of all) {
          expect(combineBuildStatuses(otherStatus, neutralStatus)).toEqual(otherStatus);
          expect(combineBuildStatuses(neutralStatus, otherStatus)).toEqual(otherStatus);
        }
      }
    });

    it("combines NEUTRALs into NEUTRAL", () => {
      expect(combineBuildStatuses(neutrals[0], neutrals[0])).toEqual({
        icon: "dash",
        classSuffix: "neutral",
      });
    });
  });
});
