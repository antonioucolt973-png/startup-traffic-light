import { ArrowRight, Backpack, Bot, CheckCircle2, History, Route, Sparkles } from "lucide-react";
import { gateLabels } from "../lib/labels";
import type { CalibrationRound, DecisionReport, EvidenceRecord, Project, RedTeamTurn, SurveyCampaign } from "../types";

interface GrowthJourneyProps {
  initialProject: Project | null;
  project: Project;
  report: DecisionReport;
  records: EvidenceRecord[];
  surveys: SurveyCampaign[];
  redTeamTurns: RedTeamTurn[];
  rounds: CalibrationRound[];
}

export function GrowthJourney({ initialProject, project, report, records, surveys, redTeamTurns, rounds }: GrowthJourneyProps) {
  const start = initialProject ?? project;
  const confirmed = records.filter((record) => record.reviewStatus === "confirmed");
  const pending = records.filter((record) => record.reviewStatus === "pending");
  const passedGates = report.roadtestChecks.filter((gate) => gate.status === "已通过");
  const changedFields = [
    ["目标用户", start.targetUser, project.targetUser],
    ["现实问题", start.painPoint, project.painPoint],
    ["获客方式", start.acquisition, project.acquisition],
    ["付费假设", start.monetization, project.monetization],
  ].filter(([, before, after]) => before !== after);
  const aiActions = 1 + surveys.length + new Set(redTeamTurns.map((turn) => turn.gateId)).size + (rounds.length > 0 ? 1 : 0);

  return (
    <section className="growthJourney">
      <header><div><span>项目成长轨迹</span><h2>不是拿走一份报告，而是看见项目怎样被现实改变。</h2></div><div className="growthPulse"><Sparkles size={18} /><strong>{aiActions}</strong><span>项AI工作已完成</span></div></header>
      <div className="beforeAfterLane">
        <article><span>最初输入</span><h3>{start.name || "一段还没整理的想法"}</h3><p>{start.description || "还没有形成清晰项目描述"}</p><dl><div><dt>目标用户</dt><dd>{start.targetUser || "未明确"}</dd></div><div><dt>最大不确定性</dt><dd>{start.biggestUncertainty || "未明确"}</dd></div></dl></article>
        <div className="growthArrow"><ArrowRight /><span>AI拆解<br />现实验证<br />重新校准</span></div>
        <article className="after"><span>当前版本</span><h3>{project.name}</h3><p>{report.currentFocus}</p><dl><div><dt>灯号</dt><dd>{report.lightLabel}</dd></div><div><dt>证据</dt><dd>{report.evidenceScore}/100</dd></div></dl></article>
      </div>
      <div className="growthMetrics">
        <div><Backpack size={18} /><strong>{confirmed.length}</strong><span>条已确认现实证据</span><small>{pending.length}条待确认</small></div>
        <div><Route size={18} /><strong>{passedGates.length}/6</strong><span>个路口已通过</span><small>{passedGates.map((gate) => gateLabels[gate.id]).join("、") || "当前仍在补证"}</small></div>
        <div><Bot size={18} /><strong>{surveys.length}</strong><span>份AI行动工具</span><small>{redTeamTurns.length}轮红队对话</small></div>
        <div><History size={18} /><strong>{rounds.length}</strong><span>轮项目校准</span><small>保留每次判断依据</small></div>
      </div>
      <div className="projectChangeLog"><strong><CheckCircle2 size={17} />本轮项目发生了什么变化</strong>{changedFields.length ? <ul>{changedFields.map(([label, before, after]) => <li key={label}><span>{label}</span><del>{before || "未明确"}</del><ArrowRight size={14} /><ins>{after || "未明确"}</ins></li>)}</ul> : <p>当前项目结构尚未修改。完成第一轮现实任务并回填证据后，这里会显示前后差异。</p>}</div>
    </section>
  );
}
