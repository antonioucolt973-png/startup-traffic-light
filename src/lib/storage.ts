import type { CalibrationSnapshot, Evidence, Project, RoadtestPlan } from "../types";

const PROJECT_KEY = "startup-traffic-light:project";
const EVIDENCE_KEY = "startup-traffic-light:evidence";
const ROADTEST_PLAN_KEY = "startup-traffic-light:roadtest-plan";
const CALIBRATION_HISTORY_KEY = "startup-traffic-light:calibration-history";

export function loadProject(): Project | null {
  return readJson<Project>(PROJECT_KEY);
}

export function saveProject(project: Project) {
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
}

export function loadEvidence(): Evidence | null {
  return readJson<Evidence>(EVIDENCE_KEY);
}

export function saveEvidence(evidence: Evidence) {
  localStorage.setItem(EVIDENCE_KEY, JSON.stringify(evidence));
}

export function loadRoadtestPlan(): RoadtestPlan | null {
  return readJson<RoadtestPlan>(ROADTEST_PLAN_KEY);
}

export function saveRoadtestPlan(plan: RoadtestPlan) {
  localStorage.setItem(ROADTEST_PLAN_KEY, JSON.stringify(plan));
}

export function loadCalibrationHistory(): CalibrationSnapshot[] {
  const history = readJson<unknown>(CALIBRATION_HISTORY_KEY);
  if (!Array.isArray(history)) return [];

  return history.filter(isCalibrationSnapshot);
}

export function saveCalibrationHistory(history: CalibrationSnapshot[]) {
  localStorage.setItem(CALIBRATION_HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function isCalibrationSnapshot(value: unknown): value is CalibrationSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<CalibrationSnapshot>;
  return [
    snapshot.id,
    snapshot.projectId,
    snapshot.projectName,
    snapshot.createdAt,
    snapshot.stage,
    snapshot.light,
    snapshot.lightLabel,
    snapshot.currentFocus,
  ].every((field) => typeof field === "string") &&
    typeof snapshot.evidenceScore === "number" &&
    typeof snapshot.evidenceLevel === "number" &&
    typeof snapshot.projectStructureScore === "number";
}
