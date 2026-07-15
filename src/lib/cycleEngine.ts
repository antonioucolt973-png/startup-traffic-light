import {
  buildReport,
  deriveEvidenceSummary,
  emptyGatePlans,
  normalizeGatePlans,
  plansToRoadtestPlan,
} from "./decisionEngine.ts";
import { createCalibrationRound, createValidationTasks } from "./calibration.ts";
import type {
  CycleOutcome,
  DecisionReport,
  GateId,
  JourneyCycle,
  ProjectStage,
  ProjectWorkspace,
} from "../types";

const stageOrder: ProjectStage[] = ["idea", "research", "demo", "mvp", "growth"];

export function ensureActiveCycle(workspace: ProjectWorkspace, report: DecisionReport): ProjectWorkspace {
  const active = workspace.cycles.find((cycle) => cycle.id === workspace.activeCycleId && cycle.status === "active");
  if (active) {
    const tasks = workspace.tasks.length === 7
      ? workspace.tasks.map((task) => ({ ...task, cycleId: active.id }))
      : createValidationTasks(workspace.project.id, report, active.id);
    return { ...workspace, tasks };
  }

  const cycle = createJourneyCycle(workspace, report, nextCycleNumber(workspace));
  const next = {
    ...workspace,
    activeCycleId: cycle.id,
    cycles: [cycle, ...workspace.cycles.filter((item) => item.status === "completed")].slice(0, 24),
    tasks: createValidationTasks(workspace.project.id, report, cycle.id),
  };
  return next.rounds.length > 0 ? next : { ...next, rounds: [createCalibrationRound(next, report)] };
}

export function transitionJourneyCycle(
  workspace: ProjectWorkspace,
  report: DecisionReport,
  outcome: CycleOutcome,
  aiReview = buildCycleReview(workspace, report),
): ProjectWorkspace {
  const prepared = ensureActiveCycle(workspace, report);
  const active = prepared.cycles.find((cycle) => cycle.id === prepared.activeCycleId)!;
  const nextProject = {
    ...prepared.project,
    currentStage: transitionStage(prepared.project.currentStage, outcome),
    iterationCount: prepared.project.iterationCount + 1,
  };
  const evidenceIds = prepared.evidenceRecords.map((record) => record.id);
  const completed: JourneyCycle = {
    ...active,
    status: "completed",
    completedAt: new Date().toISOString(),
    stageAtEnd: nextProject.currentStage,
    lightAfter: report.light,
    evidenceScoreAfter: report.evidenceScore,
    evidenceIdsAdded: evidenceIds.filter((id) => !active.evidenceIdsAtStart.includes(id)),
    planSnapshot: structuredClone(prepared.plans),
    taskSnapshot: prepared.tasks.map((task) => ({ ...task, evidenceIds: [...task.evidenceIds] })),
    redTeamSnapshot: prepared.redTeamTurns.map((turn) => ({ ...turn })),
    risksAfter: [...report.mainRisks],
    aiReview,
    recommendation: recommendCycleOutcome(report, prepared.project.currentStage),
    outcome,
  };

  const calibration = createCalibrationRound(prepared, report, prepared.rounds[0]);
  const emptyPlans = normalizeGatePlans(emptyGatePlans);
  const nextReport = buildReport(
    nextProject,
    deriveEvidenceSummary(prepared.evidenceRecords),
    plansToRoadtestPlan(emptyPlans),
  );
  const base = {
    ...prepared,
    project: nextProject,
    plans: emptyPlans,
    redTeamTurns: [],
    tasks: [],
    rounds: roundMatchesReport(prepared.rounds[0], report)
      ? prepared.rounds
      : [calibration, ...prepared.rounds].slice(0, 12),
    cycles: [completed, ...prepared.cycles.filter((cycle) => cycle.id !== active.id)],
    activeCycleId: "",
  };
  return ensureActiveCycle(base, nextReport);
}

export function recommendCycleOutcome(report: DecisionReport, stage: ProjectStage): CycleOutcome {
  if (report.light === "green" && stage !== "growth") return "advance";
  if (report.light === "red" && stage !== "idea") return "return";
  return "hold";
}

export function buildCycleReview(workspace: ProjectWorkspace, report: DecisionReport): string {
  const active = workspace.cycles.find((cycle) => cycle.id === workspace.activeCycleId);
  const newEvidence = active
    ? workspace.evidenceRecords.filter((record) => !active.evidenceIdsAtStart.includes(record.id)).length
    : workspace.evidenceRecords.length;
  const completedTasks = workspace.tasks.filter((task) => task.status === "completed").length;
  const failedTasks = workspace.tasks.filter((task) => task.status === "failed").length;
  return `本轮完成 ${completedTasks} 项现实任务，${failedTasks} 项未通过，新增 ${newEvidence} 条证据。当前为${report.lightLabel}，证据 ${report.evidenceScore}/100。${report.lightReason}`;
}

function createJourneyCycle(workspace: ProjectWorkspace, report: DecisionReport, cycleNumber: number): JourneyCycle {
  const id = `${workspace.project.id}-cycle-${cycleNumber}-${Date.now()}`;
  return {
    id,
    projectId: workspace.project.id,
    cycleNumber,
    status: "active",
    startedAt: new Date().toISOString(),
    stageAtStart: workspace.project.currentStage,
    primaryGoal: report.currentFocus,
    focusGate: selectFocusGate(report),
    lightBefore: report.light,
    evidenceScoreBefore: report.evidenceScore,
    evidenceIdsAtStart: workspace.evidenceRecords.map((record) => record.id),
    evidenceIdsAdded: [],
    planSnapshot: normalizeGatePlans(emptyGatePlans),
    taskSnapshot: [],
    redTeamSnapshot: [],
    risksBefore: [...report.mainRisks],
    risksAfter: [],
    aiReview: "",
    recommendation: recommendCycleOutcome(report, workspace.project.currentStage),
  };
}

function selectFocusGate(report: DecisionReport): GateId {
  const priority = ["立即行动", "先停手", "计划太虚", "可路测", "未检查"];
  for (const status of priority) {
    const gate = report.roadtestChecks.find((item) => item.status === status);
    if (gate) return gate.id;
  }
  return report.roadtestChecks[0]?.id ?? "user";
}

function transitionStage(stage: ProjectStage, outcome: CycleOutcome): ProjectStage {
  const index = stageOrder.indexOf(stage);
  if (outcome === "advance") return stageOrder[Math.min(stageOrder.length - 1, index + 1)];
  if (outcome === "return") return stageOrder[Math.max(0, index - 1)];
  return stage;
}

function nextCycleNumber(workspace: ProjectWorkspace) {
  return Math.max(0, ...workspace.cycles.map((cycle) => cycle.cycleNumber)) + 1;
}

function roundMatchesReport(round: ProjectWorkspace["rounds"][number] | undefined, report: DecisionReport) {
  return Boolean(round &&
    round.light === report.light &&
    round.evidenceScore === report.evidenceScore &&
    round.investmentLimit.days === report.investmentLimit.days &&
    round.investmentLimit.money === report.investmentLimit.money);
}
