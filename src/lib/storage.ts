import type { Evidence, Project, RoadtestPlan } from "../types";

const PROJECT_KEY = "startup-traffic-light:project";
const EVIDENCE_KEY = "startup-traffic-light:evidence";
const ROADTEST_PLAN_KEY = "startup-traffic-light:roadtest-plan";

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

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
