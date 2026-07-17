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
  JourneyCycle,
  Project,
  ProjectLibrary,
  ProjectLibraryEntry,
  ProjectWorkspace,
  RedTeamTurn,
  RoadtestStatus,
  RoadtestPlan,
  ValidationTask,
} from "../types";

const PROJECT_KEY = "startup-traffic-light:project";
const EVIDENCE_KEY = "startup-traffic-light:evidence";
const ROADTEST_PLAN_KEY = "startup-traffic-light:roadtest-plan";
const CALIBRATION_HISTORY_KEY = "startup-traffic-light:calibration-history";
const WORKSPACE_KEY = "startup-traffic-light:workspace:v5";
const PROJECT_LIBRARY_KEY = "startup-traffic-light:projects:v1";
const PREVIOUS_WORKSPACE_KEYS = ["startup-traffic-light:workspace:v4", "startup-traffic-light:workspace:v3", "startup-traffic-light:workspace:v2"];

export function createEmptyWorkspace(project: Project = emptyProject): ProjectWorkspace {
  return {
    schemaVersion: 5,
    project: normalizeProject(project),
    initialProject: null,
    activeCycleId: "",
    cycles: [],
    evidenceRecords: [],
    plans: normalizeGatePlans(emptyGatePlans),
    redTeamTurns: [],
    tasks: [],
    rounds: [],
    surveys: [],
  };
}

export function loadWorkspace(): ProjectWorkspace {
  const saved = readJson<unknown>(WORKSPACE_KEY);
  if (saved && typeof saved === "object" && (saved as Partial<ProjectWorkspace>).schemaVersion === 5) {
    return normalizeWorkspace(saved as Partial<ProjectWorkspace>);
  }

  const previous = PREVIOUS_WORKSPACE_KEYS.map((key) => readJson<unknown>(key)).find(Boolean);
  if (previous && typeof previous === "object") {
    const migrated = normalizeWorkspace(previous as Partial<ProjectWorkspace>);
    saveWorkspace(migrated);
    return migrated;
  }

  const migrated = migrateLegacyWorkspace();
  saveWorkspace(migrated);
  return migrated;
}

export function saveWorkspace(workspace: ProjectWorkspace) {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(normalizeWorkspace(workspace)));
}

export function loadProjectLibrary(): ProjectLibrary {
  const saved = readJson<unknown>(PROJECT_LIBRARY_KEY);
  if (saved && typeof saved === "object") {
    const normalized = normalizeProjectLibrary(saved as Partial<ProjectLibrary>);
    if (normalized.projects.length > 0) return normalized;
  }

  const workspace = loadWorkspace();
  const library: ProjectLibrary = {
    schemaVersion: 1,
    activeProjectId: workspace.project.id,
    projects: [{ id: workspace.project.id, updatedAt: new Date().toISOString(), workspace }],
  };
  saveProjectLibrary(library);
  return library;
}

export function saveProjectLibrary(library: ProjectLibrary) {
  const normalized = normalizeProjectLibrary(library);
  localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(normalized));
  const active = normalized.projects.find((entry) => entry.id === normalized.activeProjectId) ?? normalized.projects[0];
  if (active) saveWorkspace(active.workspace);
}

export function createProjectLibraryEntry(workspace: ProjectWorkspace, updatedAt = new Date().toISOString()): ProjectLibraryEntry {
  const normalized = normalizeWorkspace(workspace);
  return { id: normalized.project.id, updatedAt, workspace: normalized };
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
    schemaVersion: 5,
    project,
    initialProject: project.name || project.description ? project : null,
    activeCycleId: "",
    cycles: [],
    evidenceRecords: evidenceSummaryToRecords(project.id, evidence, now),
    plans: legacyPlanToGatePlans(plan),
    redTeamTurns: [],
    tasks: [],
    rounds: history.map((snapshot) => snapshotToRound(snapshot)),
    surveys: [],
  };
}

function normalizeWorkspace(workspace: Partial<ProjectWorkspace>): ProjectWorkspace {
  const project = normalizeProject(workspace.project ?? emptyProject);
  const cycles = Array.isArray(workspace.cycles)
    ? workspace.cycles.filter(isJourneyCycle).map((cycle) => normalizeJourneyCycle(cycle, project)).slice(0, 24)
    : [];
  const activeCycleId = typeof workspace.activeCycleId === "string" && cycles.some((cycle) => cycle.id === workspace.activeCycleId && cycle.status === "active")
    ? workspace.activeCycleId
    : cycles.find((cycle) => cycle.status === "active")?.id ?? "";
  return {
    schemaVersion: 5,
    project,
    initialProject: workspace.initialProject ? normalizeProject(workspace.initialProject) : null,
    activeCycleId,
    cycles,
    evidenceRecords: Array.isArray(workspace.evidenceRecords)
      ? workspace.evidenceRecords.filter(isEvidenceRecord).map((record) => normalizeEvidenceRecord(record, project.id))
      : [],
    plans: normalizeGatePlans(workspace.plans),
    redTeamTurns: Array.isArray(workspace.redTeamTurns)
      ? workspace.redTeamTurns.filter(isRedTeamTurn).map((turn) => ({ ...turn, cycleId: turn.cycleId || activeCycleId || undefined })).slice(-24)
      : [],
    tasks: Array.isArray(workspace.tasks)
      ? workspace.tasks.filter(isValidationTask).map((task) => normalizeValidationTask(task, project.id, activeCycleId)).slice(0, 16)
      : [],
    rounds: Array.isArray(workspace.rounds)
      ? workspace.rounds.filter(isCalibrationRound).map((round) => normalizeCalibrationRound(round, project)).slice(0, 12)
      : [],
    surveys: Array.isArray(workspace.surveys) ? workspace.surveys.filter((survey) => survey && typeof survey.id === "string") : [],
  };
}

function normalizeProjectLibrary(library: Partial<ProjectLibrary>): ProjectLibrary {
  const seen = new Set<string>();
  const projects = Array.isArray(library.projects)
    ? library.projects.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const entry = candidate as Partial<ProjectLibraryEntry>;
      if (!entry.workspace || typeof entry.workspace !== "object") return [];
      const workspace = normalizeWorkspace(entry.workspace);
      const id = workspace.project.id;
      if (!id || seen.has(id)) return [];
      seen.add(id);
      return [{
        id,
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
        workspace,
      }];
    }).slice(0, 24)
    : [];
  const activeProjectId = typeof library.activeProjectId === "string" && projects.some((entry) => entry.id === library.activeProjectId)
    ? library.activeProjectId
    : projects[0]?.id ?? "";
  return { schemaVersion: 1, activeProjectId, projects };
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
      reviewStatus: "confirmed",
      origin: "legacy",
      rawRecordIds: [],
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

function normalizeEvidenceRecord(record: EvidenceRecord, projectId: string): EvidenceRecord {
  return {
    ...record,
    projectId,
    reviewStatus: record.reviewStatus === "pending" || record.reviewStatus === "rejected" ? record.reviewStatus : "confirmed",
    origin: record.origin === "survey" || record.origin === "task" || record.origin === "manual" ? record.origin : "legacy",
    rawRecordIds: Array.isArray(record.rawRecordIds) ? record.rawRecordIds.filter((id): id is string => typeof id === "string") : [],
    taskId: typeof record.taskId === "string" ? record.taskId : undefined,
    milestoneId: typeof record.milestoneId === "string" ? record.milestoneId : undefined,
    attachmentType: record.attachmentType === "screenshot" || record.attachmentType === "file" || record.attachmentType === "data" || record.attachmentType === "audio" ? record.attachmentType : undefined,
    attachmentName: typeof record.attachmentName === "string" ? record.attachmentName : undefined,
    userQuote: typeof record.userQuote === "string" ? record.userQuote : undefined,
    assessment: typeof record.assessment === "string" ? record.assessment : undefined,
  };
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
    lightReason: "由旧版校准记录迁移，未保存当时的详细判定依据。",
    changeSummary: "旧版历史记录",
    currentFocus: snapshot.currentFocus,
    nextReviewTrigger: "完成新的外部行动后重新校准。",
    reviewAt: snapshot.createdAt,
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

function normalizeValidationTask(task: ValidationTask, projectId: string, activeCycleId = ""): ValidationTask {
  return {
    id: task.id,
    projectId,
    cycleId: typeof task.cycleId === "string" ? task.cycleId : activeCycleId || undefined,
    day: Math.min(30, Math.max(1, task.day)),
    title: typeof task.title === "string" ? task.title : `第 ${task.day} 天 · 现实验证`,
    detail: typeof task.detail === "string" ? task.detail : "",
    passCriteria: typeof task.passCriteria === "string" ? task.passCriteria : "产生一条真实外部行为记录。",
    stopCriteria: typeof task.stopCriteria === "string" ? task.stopCriteria : "没有外部反馈时不追加投入。",
    status: task.status === "completed" || task.status === "failed" ? task.status : "pending",
    result: typeof task.result === "string" ? task.result : "",
    evidenceIds: Array.isArray(task.evidenceIds) ? task.evidenceIds.filter((id): id is string => typeof id === "string") : [],
    milestoneId: typeof task.milestoneId === "string" ? task.milestoneId : undefined,
    milestoneTitle: typeof task.milestoneTitle === "string" ? task.milestoneTitle : undefined,
    target: typeof task.target === "string" ? task.target : undefined,
    actions: Array.isArray(task.actions) ? task.actions.filter((item): item is string => typeof item === "string") : undefined,
    tools: Array.isArray(task.tools) ? task.tools.filter((item) => item && typeof item.title === "string" && typeof item.content === "string") : undefined,
    duration: typeof task.duration === "string" ? task.duration : undefined,
    estimatedCost: typeof task.estimatedCost === "string" ? task.estimatedCost : undefined,
    workflowStatus: task.workflowStatus === "locked" || task.workflowStatus === "ready" || task.workflowStatus === "needs_evidence" || task.workflowStatus === "delayed" || task.workflowStatus === "blocked" || task.workflowStatus === "skipped" || task.workflowStatus === "completed"
      ? task.workflowStatus
      : task.status === "completed" ? "completed" : task.status === "failed" ? "blocked" : "ready",
    delayReason: typeof task.delayReason === "string" ? task.delayReason : undefined,
    delayedUntil: typeof task.delayedUntil === "string" ? task.delayedUntil : undefined,
    difficulty: typeof task.difficulty === "string" ? task.difficulty : undefined,
  };
}

function isJourneyCycle(value: unknown): value is JourneyCycle {
  if (!value || typeof value !== "object") return false;
  const cycle = value as Partial<JourneyCycle>;
  return typeof cycle.id === "string" &&
    typeof cycle.projectId === "string" &&
    typeof cycle.cycleNumber === "number" &&
    typeof cycle.startedAt === "string" &&
    (cycle.status === "active" || cycle.status === "completed");
}

function normalizeJourneyCycle(cycle: JourneyCycle, project: Project): JourneyCycle {
  return {
    ...cycle,
    projectId: project.id,
    cycleNumber: Math.max(1, Math.round(cycle.cycleNumber || 1)),
    status: cycle.status === "completed" ? "completed" : "active",
    stageAtStart: normalizeLegacyStage(cycle.stageAtStart),
    stageAtEnd: cycle.stageAtEnd ? normalizeLegacyStage(cycle.stageAtEnd) : undefined,
    primaryGoal: typeof cycle.primaryGoal === "string" ? cycle.primaryGoal : "补齐最关键的现实证据。",
    focusGate: normalizeGateId(cycle.focusGate),
    lightBefore: normalizeLight(cycle.lightBefore),
    lightAfter: cycle.lightAfter ? normalizeLight(cycle.lightAfter) : undefined,
    evidenceScoreBefore: typeof cycle.evidenceScoreBefore === "number" ? cycle.evidenceScoreBefore : 0,
    evidenceScoreAfter: typeof cycle.evidenceScoreAfter === "number" ? cycle.evidenceScoreAfter : undefined,
    evidenceIdsAtStart: normalizeStringArray(cycle.evidenceIdsAtStart),
    evidenceIdsAdded: normalizeStringArray(cycle.evidenceIdsAdded),
    planSnapshot: normalizeGatePlans(cycle.planSnapshot),
    taskSnapshot: Array.isArray(cycle.taskSnapshot)
      ? cycle.taskSnapshot.filter(isValidationTask).map((task) => normalizeValidationTask(task, project.id, cycle.id))
      : [],
    redTeamSnapshot: Array.isArray(cycle.redTeamSnapshot)
      ? cycle.redTeamSnapshot.filter(isRedTeamTurn).map((turn) => ({ ...turn, projectId: project.id, cycleId: cycle.id }))
      : [],
    risksBefore: normalizeStringArray(cycle.risksBefore),
    risksAfter: normalizeStringArray(cycle.risksAfter),
    aiReview: typeof cycle.aiReview === "string" ? cycle.aiReview : "",
    recommendation: normalizeCycleOutcome(cycle.recommendation),
    outcome: cycle.outcome ? normalizeCycleOutcome(cycle.outcome) : undefined,
  };
}

function normalizeCalibrationRound(round: CalibrationRound, project: Project): CalibrationRound {
  const gateStatuses = round.gateStatuses ?? {} as CalibrationRound["gateStatuses"];
  return {
    ...round,
    projectId: project.id,
    projectName: typeof round.projectName === "string" ? round.projectName : project.name,
    stage: normalizeLegacyStage(round.stage),
    planScore: typeof round.planScore === "number" ? round.planScore : 0,
    lightReason: typeof round.lightReason === "string" ? round.lightReason : "历史记录未保存详细判定依据。",
    changeSummary: typeof round.changeSummary === "string" ? round.changeSummary : "历史记录",
    currentFocus: typeof round.currentFocus === "string" ? round.currentFocus : "继续补充现实证据。",
    nextReviewTrigger: typeof round.nextReviewTrigger === "string" ? round.nextReviewTrigger : "完成新的外部行动后重新校准。",
    reviewAt: typeof round.reviewAt === "string" ? round.reviewAt : round.createdAt,
    gateStatuses: {
      user: normalizeRoadtestStatus(gateStatuses.user),
      pain: normalizeRoadtestStatus(gateStatuses.pain),
      alternative: normalizeRoadtestStatus(gateStatuses.alternative),
      acquisition: normalizeRoadtestStatus(gateStatuses.acquisition),
      payment: normalizeRoadtestStatus(gateStatuses.payment),
      delivery: normalizeRoadtestStatus(gateStatuses.delivery),
    },
    investmentLimit: {
      days: typeof round.investmentLimit?.days === "number" ? round.investmentLimit.days : 0,
      money: typeof round.investmentLimit?.money === "number" ? round.investmentLimit.money : 0,
    },
    evidenceRecordIds: Array.isArray(round.evidenceRecordIds)
      ? round.evidenceRecordIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

function normalizeRoadtestStatus(status: unknown): RoadtestStatus {
  return status === "已通过" || status === "可路测" || status === "计划太虚" || status === "先停手" || status === "立即行动"
    ? status
    : "未检查";
}

function normalizeLegacyStage(stage: string): Project["currentStage"] {
  return stage === "research" || stage === "demo" || stage === "mvp" || stage === "growth" ? stage : "idea";
}

function normalizeGateId(value: unknown): JourneyCycle["focusGate"] {
  return value === "pain" || value === "alternative" || value === "acquisition" || value === "payment" || value === "delivery" ? value : "user";
}

function normalizeLight(value: unknown): JourneyCycle["lightBefore"] {
  return value === "red" || value === "green" || value === "blue" ? value : "yellow";
}

function normalizeCycleOutcome(value: unknown): JourneyCycle["recommendation"] {
  return value === "advance" || value === "return" ? value : "hold";
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
