import {
  emptyEvidence,
  emptyGatePlans,
  emptyProject,
  emptyRoadtestPlan,
  normalizeGatePlans,
  normalizeProject,
  normalizeRoadtestPlan,
} from "./decisionEngine.ts";
import type {
  CalibrationRound,
  CalibrationSnapshot,
  Evidence,
  EvidenceRecord,
  GatePlans,
  Project,
  ProjectWorkspace,
  RedTeamTurn,
  RoadtestPlan,
  ValidationTask,
} from "../types";

const PROJECT_KEY = "startup-traffic-light:project";
const EVIDENCE_KEY = "startup-traffic-light:evidence";
const ROADTEST_PLAN_KEY = "startup-traffic-light:roadtest-plan";
const CALIBRATION_HISTORY_KEY = "startup-traffic-light:calibration-history";
const WORKSPACE_KEY = "startup-traffic-light:workspace:v2";

export function createEmptyWorkspace(project: Project = emptyProject): ProjectWorkspace {
  return {
    schemaVersion: 2,
    project: normalizeProject(project),
    evidenceRecords: [],
    plans: normalizeGatePlans(emptyGatePlans),
    redTeamTurns: [],
    tasks: [],
    rounds: [],
  };
}

export function loadWorkspace(): ProjectWorkspace {
  const saved = readJson<unknown>(WORKSPACE_KEY);
  if (saved && typeof saved === "object" && (saved as Partial<ProjectWorkspace>).schemaVersion === 2) {
    return normalizeWorkspace(saved as Partial<ProjectWorkspace>);
  }

  const migrated = migrateLegacyWorkspace();
  saveWorkspace(migrated);
  return migrated;
}

export function saveWorkspace(workspace: ProjectWorkspace) {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(normalizeWorkspace(workspace)));
}

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

function migrateLegacyWorkspace(): ProjectWorkspace {
  const project = normalizeProject(loadProject() ?? emptyProject);
  const evidence = loadEvidence() ?? emptyEvidence;
  const plan = normalizeRoadtestPlan(loadRoadtestPlan() ?? emptyRoadtestPlan);
  const history = loadCalibrationHistory();
  const now = new Date().toISOString();

  return {
    schemaVersion: 2,
    project,
    evidenceRecords: evidenceSummaryToRecords(project.id, evidence, now),
    plans: legacyPlanToGatePlans(plan),
    redTeamTurns: [],
    tasks: [],
    rounds: history.map((snapshot) => snapshotToRound(snapshot)),
  };
}

function normalizeWorkspace(workspace: Partial<ProjectWorkspace>): ProjectWorkspace {
  const project = normalizeProject(workspace.project ?? emptyProject);
  return {
    schemaVersion: 2,
    project,
    evidenceRecords: Array.isArray(workspace.evidenceRecords)
      ? workspace.evidenceRecords.filter(isEvidenceRecord).map((record) => ({ ...record, projectId: project.id }))
      : [],
    plans: normalizeGatePlans(workspace.plans),
    redTeamTurns: Array.isArray(workspace.redTeamTurns)
      ? workspace.redTeamTurns.filter(isRedTeamTurn).slice(-24)
      : [],
    tasks: Array.isArray(workspace.tasks) ? workspace.tasks.filter(isValidationTask).slice(0, 7) : [],
    rounds: Array.isArray(workspace.rounds) ? workspace.rounds.filter(isCalibrationRound).slice(0, 12) : [],
  };
}

function legacyPlanToGatePlans(plan: RoadtestPlan): GatePlans {
  return {
    user: { ...emptyGatePlans.user, action: plan.user },
    pain: { ...emptyGatePlans.pain, action: plan.pain },
    alternative: { ...emptyGatePlans.alternative, action: plan.alternative },
    acquisition: { ...emptyGatePlans.acquisition, action: plan.acquisition },
    payment: { ...emptyGatePlans.payment, action: plan.payment },
    delivery: { ...emptyGatePlans.delivery, action: plan.delivery },
  };
}

export function evidenceSummaryToRecords(projectId: string, evidence: Evidence, occurredAt = new Date().toISOString()): EvidenceRecord[] {
  const records: EvidenceRecord[] = [];
  const add = (type: EvidenceRecord["type"], quantity: number, behavior: string) => {
    if (quantity <= 0) return;
    records.push({
      id: `legacy-${type}`,
      projectId,
      type,
      occurredAt,
      actor: "历史汇总",
      behavior,
      quantity,
      source: type === "research" ? "web_research" : "founder_report",
      note: "由旧版汇总数据迁移，建议补充原始记录。",
      url: "",
      verifiable: false,
    });
  };

  add("research", evidence.competitorResearch ? 1 : 0, "完成过竞品或替代方案搜索");
  add("interview", evidence.interviewCount, "目标用户访谈");
  add("test_post", evidence.testPostCount, "公开测试内容");
  add("active_interest", evidence.messageCount, "主动留言或私信");
  add("signup", evidence.signupCount, "加微信或登记");
  add("trial", evidence.demoTrialCount, "原型或人工演示试用");
  add("payment", evidence.paymentSignalCount, "报价接受、预订或付款信号");
  add("repeat", evidence.retentionSignal ? 1 : 0, "复用、留存或转介绍信号");
  return records;
}

function snapshotToRound(snapshot: CalibrationSnapshot): CalibrationRound {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    projectName: snapshot.projectName,
    createdAt: snapshot.createdAt,
    stage: normalizeLegacyStage(snapshot.stage),
    light: snapshot.light,
    lightLabel: snapshot.lightLabel,
    evidenceScore: snapshot.evidenceScore,
    evidenceLevel: snapshot.evidenceLevel,
    projectStructureScore: snapshot.projectStructureScore,
    planScore: 0,
    currentFocus: snapshot.currentFocus,
    nextReviewTrigger: "完成新的外部行动后重新校准。",
    gateStatuses: {
      user: "未检查",
      pain: "未检查",
      alternative: "未检查",
      acquisition: "未检查",
      payment: "未检查",
      delivery: "未检查",
    },
    investmentLimit: { days: 0, money: 0 },
    evidenceRecordIds: [],
  };
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

function isEvidenceRecord(value: unknown): value is EvidenceRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EvidenceRecord>;
  return typeof record.id === "string" &&
    typeof record.projectId === "string" &&
    typeof record.type === "string" &&
    typeof record.occurredAt === "string" &&
    typeof record.actor === "string" &&
    typeof record.behavior === "string" &&
    typeof record.quantity === "number" &&
    typeof record.source === "string" &&
    typeof record.note === "string" &&
    typeof record.url === "string" &&
    typeof record.verifiable === "boolean";
}

function isRedTeamTurn(value: unknown): value is RedTeamTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Partial<RedTeamTurn>;
  return typeof turn.id === "string" && typeof turn.projectId === "string" && typeof turn.gateId === "string";
}

function isValidationTask(value: unknown): value is ValidationTask {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<ValidationTask>;
  return typeof task.id === "string" && typeof task.projectId === "string" && typeof task.day === "number";
}

function isCalibrationRound(value: unknown): value is CalibrationRound {
  if (!value || typeof value !== "object") return false;
  const round = value as Partial<CalibrationRound>;
  return typeof round.id === "string" &&
    typeof round.projectId === "string" &&
    typeof round.createdAt === "string" &&
    typeof round.light === "string" &&
    typeof round.evidenceScore === "number";
}

function normalizeLegacyStage(stage: string): Project["currentStage"] {
  return stage === "research" || stage === "demo" || stage === "mvp" || stage === "growth" ? stage : "idea";
}
