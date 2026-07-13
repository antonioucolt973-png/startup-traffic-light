import type {
  CalibrationDiff,
  CalibrationRound,
  DecisionReport,
  GateId,
  ProjectWorkspace,
  ValidationTask,
} from "../types";

const dayPattern = /^第\s*(\d+)\s*天[：:]\s*/;
const gateIds: GateId[] = ["user", "pain", "alternative", "acquisition", "payment", "delivery"];

export function createValidationTasks(projectId: string, report: DecisionReport): ValidationTask[] {
  return report.sevenDayTasks.slice(0, 7).map((rawTask, index) => {
    const day = Number(rawTask.match(dayPattern)?.[1]) || index + 1;
    const detail = rawTask.replace(dayPattern, "").trim();
    return {
      id: `${projectId}-day-${day}`,
      projectId,
      day,
      title: getTaskTitle(day, detail),
      detail,
      passCriteria: getPassCriteria(day),
      stopCriteria: report.stopConditions[Math.min(index, report.stopConditions.length - 1)] ?? "没有产生任何外部行为时，不追加开发投入。",
      status: "pending",
      result: "",
      evidenceIds: [],
    };
  });
}

export function createCalibrationRound(
  workspace: ProjectWorkspace,
  report: DecisionReport,
  previous?: CalibrationRound,
): CalibrationRound {
  const now = new Date();
  const round: CalibrationRound = {
    id: `${now.getTime()}-${report.light}`,
    projectId: workspace.project.id,
    projectName: workspace.project.name || "未命名项目",
    createdAt: now.toISOString(),
    stage: workspace.project.currentStage,
    light: report.light,
    lightLabel: report.lightLabel,
    evidenceScore: report.evidenceScore,
    evidenceLevel: report.evidenceLevel,
    projectStructureScore: report.projectStructureScore,
    planScore: report.planScore,
    lightReason: report.lightReason,
    changeSummary: "已锁定本轮起点，等待新的现实行动与证据。",
    currentFocus: report.currentFocus,
    nextReviewTrigger: report.nextReviewTrigger,
    reviewAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    gateStatuses: Object.fromEntries(report.roadtestChecks.map((item) => [item.id, item.status])) as CalibrationRound["gateStatuses"],
    investmentLimit: { days: report.investmentLimit.days, money: report.investmentLimit.money },
    evidenceRecordIds: workspace.evidenceRecords.map((record) => record.id),
  };
  if (previous) round.changeSummary = summarizeChange(compareCalibration(previous, round));
  return round;
}

export function compareCalibration(previous: CalibrationRound, current: CalibrationRound): CalibrationDiff {
  return {
    lightChanged: previous.light !== current.light,
    evidenceDelta: current.evidenceScore - previous.evidenceScore,
    investmentDaysDelta: current.investmentLimit.days - previous.investmentLimit.days,
    investmentMoneyDelta: current.investmentLimit.money - previous.investmentLimit.money,
    changedGates: gateIds.flatMap((id) => previous.gateStatuses[id] === current.gateStatuses[id]
      ? []
      : [{ id, before: previous.gateStatuses[id], after: current.gateStatuses[id] }]),
    newEvidenceCount: current.evidenceRecordIds.filter((id) => !previous.evidenceRecordIds.includes(id)).length,
  };
}

export function summarizeChange(diff: CalibrationDiff): string {
  const changes: string[] = [];
  if (diff.lightChanged) changes.push("灯号发生变化");
  if (diff.evidenceDelta !== 0) changes.push(`证据分${diff.evidenceDelta > 0 ? "增加" : "减少"} ${Math.abs(diff.evidenceDelta)} 分`);
  if (diff.changedGates.length > 0) changes.push(`${diff.changedGates.length} 个路口状态变化`);
  if (diff.newEvidenceCount > 0) changes.push(`新增 ${diff.newEvidenceCount} 条证据`);
  return changes.length > 0 ? changes.join("，") : "本轮尚未出现足以改变项目节奏的新证据。";
}

function getTaskTitle(day: number, detail: string): string {
  const short = detail.split(/[，。；]/)[0].trim();
  return `第 ${day} 天 · ${short || "现实验证"}`;
}

function getPassCriteria(day: number): string {
  if (day <= 2) return "完成任务要求的触达或访谈数量，并记录对象、行为与原话。";
  if (day <= 4) return "产生至少一条可复核的公开反馈、试用或明确拒绝记录。";
  if (day <= 6) return "产生报价、继续使用、复访或拒绝中的明确下一步。";
  return "完成证据回填并重新校准，不用个人感受代替行为结果。";
}
