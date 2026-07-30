// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup, act } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    checkPermissions: mocks.checkPermissions,
    requestPermissions: mocks.requestPermissions,
    getCurrentPosition: mocks.getCurrentPosition,
  },
}));
vi.mock("@capacitor/app", () => ({
  App: { addListener: mocks.addListener },
}));

import ProximityPing from "./ProximityPing";
import ArrivalCheckInSheet from "./ArrivalCheckInSheet";

const CONTEXT_OK = { eligible: true, gymName: "Test BJJ", radiusM: 200, membershipContext: "ctx-member-a" };
const CONTEXT_OTHER_MEMBER = { eligible: true, gymName: "Test BJJ", radiusM: 200, membershipContext: "ctx-member-b" };
const ARRIVAL_KEY_A = "matflow-arrival-sheet-dismissed-at:ctx-member-a";
const ARRIVAL_KEY_B = "matflow-arrival-sheet-dismissed-at:ctx-member-b";
const EXPLAINER_KEY_A = "matflow-arrival-explainer-dismissed-at:ctx-member-a";
const INSIDE = {
  result: "inside_with_classes",
  gymName: "Test BJJ",
  arrivalToken: "token-abc",
  classes: [
    { scheduleId: "s1", classType: "gi", instructor: "Coach", locationSlug: "main", startTime: "18:00", endTime: "19:00", minutesFromStart: -10 },
    { scheduleId: "s2", classType: "nogi", instructor: "", locationSlug: "main", startTime: "19:00", endTime: "20:00", minutesFromStart: 50 },
  ],
};

function mockFetchQueue(responses: Record<string, unknown>[]) {
  const queue = [...responses];
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => queue.shift() ?? {},
  })));
}

function setNative(isNative: boolean) {
  (window as unknown as { Capacitor?: unknown }).Capacitor = isNative
    ? { isNativePlatform: () => true }
    : undefined;
}

// Deterministic trigger: capture the appStateChange listener the component
// registers and fire it directly — no reliance on the 2.5s launch timer.
let fireForeground: (() => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  fireForeground = null;
  mocks.addListener.mockImplementation(async (_event: string, cb: (s: { isActive: boolean }) => void) => {
    fireForeground = () => cb({ isActive: true });
    return { remove: () => {} };
  });
  mocks.checkPermissions.mockResolvedValue({ location: "prompt" });
  mocks.getCurrentPosition.mockResolvedValue({ coords: { latitude: 0, longitude: 0, accuracy: 10 } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setNative(false);
});

async function triggerEvaluate() {
  await waitFor(() => expect(fireForeground).toBeTruthy());
  await act(async () => { fireForeground!(); });
}

describe("ProximityPing — platform and permission behavior", () => {
  it("does nothing at all in a normal web browser", async () => {
    setNative(false);
    mockFetchQueue([]);
    render(<ProximityPing />);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(fireForeground).toBeNull(); // no native listeners registered
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.checkPermissions).not.toHaveBeenCalled();
  });

  it("granted permission: runs the foreground check without any prompt", async () => {
    setNative(true);
    mocks.checkPermissions.mockResolvedValue({ location: "granted" });
    mockFetchQueue([CONTEXT_OK, INSIDE]);
    render(<ProximityPing />);
    await triggerEvaluate();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(mocks.requestPermissions).not.toHaveBeenCalled(); // never auto-prompts
    expect(screen.getByText(/You're at Test BJJ/)).toBeTruthy();
    expect(screen.getByText("Are you attending class?")).toBeTruthy();
  });

  it("undetermined permission: shows the explainer and waits; Enable triggers the OS prompt", async () => {
    setNative(true);
    mocks.checkPermissions.mockResolvedValue({ location: "prompt" });
    mocks.requestPermissions.mockResolvedValue({ location: "granted" });
    mockFetchQueue([CONTEXT_OK, INSIDE]);
    render(<ProximityPing />);
    await triggerEvaluate();
    await waitFor(() => expect(screen.getByRole("button", { name: "Enable" })).toBeTruthy());
    expect(mocks.requestPermissions).not.toHaveBeenCalled(); // waited for the user
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    await waitFor(() => expect(mocks.requestPermissions).toHaveBeenCalledTimes(1));
  });

  it("denied permission: no prompt loop, no location call, app unaffected", async () => {
    setNative(true);
    mocks.checkPermissions.mockResolvedValue({ location: "denied" });
    mockFetchQueue([CONTEXT_OK]);
    render(<ProximityPing />);
    await triggerEvaluate();
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explainer 'Not now' persists a membership-scoped cooldown that suppresses the next launch", async () => {
    setNative(true);
    localStorage.setItem("matflow-arrival-explainer-dismissed-at", "123"); // legacy global key
    mockFetchQueue([CONTEXT_OK]);
    render(<ProximityPing />);
    await triggerEvaluate();
    await waitFor(() => expect(screen.getByRole("button", { name: "Not now" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(localStorage.getItem(EXPLAINER_KEY_A)).toBeTruthy();
    // Legacy device-global keys are cleaned up, never consulted.
    expect(localStorage.getItem("matflow-arrival-explainer-dismissed-at")).toBeNull();
    cleanup();
    // Relaunch inside the cooldown: no explainer.
    mockFetchQueue([CONTEXT_OK]);
    render(<ProximityPing />);
    await triggerEvaluate();
    expect(screen.queryByRole("button", { name: "Enable" })).toBeNull();
  });

  it("permission copy is truthful about foreground-only behavior", async () => {
    setNative(true);
    mockFetchQueue([CONTEXT_OK]);
    render(<ProximityPing />);
    await triggerEvaluate();
    await waitFor(() => expect(screen.getByRole("button", { name: "Enable" })).toBeTruthy());
    expect(
      screen.getByText("Turn on location to confirm your check-in when you open MatFlow at Test BJJ."),
    ).toBeTruthy();
    // Never promise background behavior Phase 1 does not have.
    expect(screen.queryByText(/automatically/i)).toBeNull();
    expect(screen.queryByText(/when you arrive/i)).toBeNull();
  });

  it("ineligible context (no coordinates) never touches permissions", async () => {
    setNative(true);
    mockFetchQueue([{ eligible: false, reason: "no_gym_coordinates" }]);
    render(<ProximityPing />);
    await triggerEvaluate();
    expect(mocks.checkPermissions).not.toHaveBeenCalled();
  });
});

describe("ProximityPing — visit cooldown stamping and scoping", () => {
  const CHECKED_IN = { result: "checked_in", classType: "gi", startTime: "18:00", endTime: "19:00" };

  async function arriveWithSheet(context: Record<string, unknown>, extraResponses: Record<string, unknown>[] = []) {
    setNative(true);
    mocks.checkPermissions.mockResolvedValue({ location: "granted" });
    mockFetchQueue([context, INSIDE, ...extraResponses]);
    render(<ProximityPing />);
    await triggerEvaluate();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  }

  it("a COMPLETED check-in stamps the visit cooldown and suppresses re-prompting", async () => {
    await arriveWithSheet(CONTEXT_OK, [CHECKED_IN]);
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    fireEvent.click(screen.getByText("gi"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm check-in" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(localStorage.getItem(ARRIVAL_KEY_A)).toBeTruthy();

    // Re-foreground shortly after: the eligibility GET runs, but no location
    // check and no new prompt happen inside the cooldown.
    const positionCallsBefore = mocks.getCurrentPosition.mock.calls.length;
    mockFetchQueue([CONTEXT_OK]);
    await act(async () => { fireForeground!(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.getCurrentPosition.mock.calls.length).toBe(positionCallsBefore);
  });

  it("a DISMISSED arrival sheet stamps the same visit cooldown", async () => {
    await arriveWithSheet(CONTEXT_OK);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(localStorage.getItem(ARRIVAL_KEY_A)).toBeTruthy();
  });

  it("cooldown is membership-scoped: another signed-in membership is NOT suppressed", async () => {
    // Membership A completes a visit (cooldown stamped for A only).
    await arriveWithSheet(CONTEXT_OK, [CHECKED_IN]);
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    fireEvent.click(screen.getByText("gi"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm check-in" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(localStorage.getItem(ARRIVAL_KEY_A)).toBeTruthy();
    cleanup();

    // Membership B signs in on the same device: fresh prompt, untouched key.
    await arriveWithSheet(CONTEXT_OTHER_MEMBER);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(localStorage.getItem(ARRIVAL_KEY_B)).toBeNull(); // B never dismissed anything
  });
});

describe("ArrivalCheckInSheet — check-in flow", () => {
  function renderSheet(fetchResponses: { ok: boolean; body: Record<string, unknown> }[], props: Partial<Parameters<typeof ArrivalCheckInSheet>[0]> = {}) {
    const queue = [...fetchResponses];
    vi.stubGlobal("fetch", vi.fn(async () => {
      const next = queue.shift() ?? { ok: true, body: {} };
      return { ok: next.ok, json: async () => next.body };
    }));
    const onClose = vi.fn();
    const onTokenExpired = vi.fn();
    render(
      <ArrivalCheckInSheet
        gymName="Test BJJ"
        classes={INSIDE.classes}
        arrivalToken="token-abc"
        onClose={onClose}
        onTokenExpired={onTokenExpired}
        {...props}
      />,
    );
    return { onClose, onTokenExpired };
  }

  it("ask → pick → confirm → success, with double-submit protection", async () => {
    renderSheet([{ ok: true, body: { result: "checked_in", classType: "gi", startTime: "18:00", endTime: "19:00" } }]);
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    fireEvent.click(screen.getByText("gi")); // pick from the two classes
    const confirm = screen.getByRole("button", { name: "Confirm check-in" });
    fireEvent.click(confirm);
    expect((confirm as HTMLButtonElement).disabled).toBe(true); // pending lock
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("checked in for gi"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("already checked in shows the friendly state", async () => {
    renderSheet([{ ok: true, body: { result: "already_checked_in", classType: "gi", startTime: "18:00" } }]);
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    fireEvent.click(screen.getByText("gi"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm check-in" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("already checked in"));
  });

  it("expired attestation asks the parent for a FRESH location decision", async () => {
    const { onTokenExpired } = renderSheet([{ ok: false, body: { result: "token_expired" } }]);
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    fireEvent.click(screen.getByText("gi"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm check-in" }));
    await waitFor(() => expect(onTokenExpired).toHaveBeenCalledTimes(1));
  });

  it("network failure shows a retry that can succeed", async () => {
    const queue = [
      () => Promise.reject(new Error("offline")),
      () => Promise.resolve({ ok: true, json: async () => ({ result: "checked_in", classType: "gi", startTime: "18:00", endTime: "19:00" }) }),
    ];
    vi.stubGlobal("fetch", vi.fn(() => queue.shift()!()));
    const onClose = vi.fn();
    render(
      <ArrivalCheckInSheet gymName="Test BJJ" classes={INSIDE.classes} arrivalToken="t" onClose={onClose} onTokenExpired={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    fireEvent.click(screen.getByText("gi"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm check-in" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
  });

  it("accessibility basics: labeled modal dialog, Escape closes, Not now dismisses", async () => {
    const { onClose } = renderSheet([]);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("arrival-heading");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith("dismissed");
    cleanup();
    const second = renderSheet([]);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(second.onClose).toHaveBeenCalledWith("dismissed");
  });
});
