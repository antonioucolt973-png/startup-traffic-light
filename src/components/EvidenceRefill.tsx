import { ArrowRight, Backpack, CalendarCheck2, Check, ChevronDown, CircleX, FileAudio, FileImage, FileText, Flame, Link2, RotateCcw, Save, Sparkles, TimerReset } from "lucide-react";
import { useEffect, useState } from "react";
import { recommendCycleOutcome } from "../lib/cycleEngine";
import { requestAiCoach } from "../lib/aiClient";
import { evidenceTypeLabels, gateLabels, taskStatusLabels } from "../lib/labels";
import type { AiCoachData } from "../lib/aiSchemas";
import type { CalibrationRound, CycleOutcome, DecisionReport, Evidence, EvidenceRecord, JourneyCycle, Project, ValidationTask } from "../types";

interface EvidenceRefillProps {
  report: DecisionReport;
  project: Project;
  evidence: Evidence;
  tasks: ValidationTask[];
  records: EvidenceRecord[];
  rounds: CalibrationRound[];
  activeCycle?: JourneyCycle;
  completedCycles: JourneyCycle[];
  onTaskChange: (task: ValidationTask) => void;
  onOpenBackpack: () => void;
  onRecalibrate: () => void;
  onStartNextCycle: (outcome: CycleOutcome, aiReview: string) => void;
  saveState: string;
}

export function EvidenceRefill({
  report,
  project,
  evidence,
  tasks,
  records,
  rounds,
  activeCycle,
  completedCycles,
  onTaskChange,
  onOpenBackpack,
  onRecalibrate,
  onStartNextCycle,
  saveState,
}: EvidenceRefillProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(() => tasks.find((task) => task.status === "pending")?.id ?? tasks[0]?.id ?? null);
  const latestRound = rounds[0];
  const savedMatchesLive = latestRound ? roundMatchesReport(latestRound, report, records) : false;
  const previous = savedMatchesLive && rounds[1] ? rounds[1] : latestRound;
  const current = savedMatchesLive ? latestRound : undefined;
  const evidenceDelta = previous ? report.evidenceScore - previous.evidenceScore : report.evidenceScore;
  const newEvidenceCount = previous ? records.filter((record) => !previous.evidenceRecordIds.includes(record.id)).length : records.length;
  const changedGates = previous ? report.roadtestChecks.filter((gate) => previous.gateStatuses[gate.id] !== gate.status) : report.roadtestChecks;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const failed = tasks.filter((task) => task.status === "failed").length;
  const recommendation = recommendCycleOutcome(report, activeCycle?.stageAtStart ?? "idea");
  const [selectedOutcome, setSelectedOutcome] = useState<CycleOutcome | null>(null);
  const [aiReview, setAiReview] = useState<AiCoachData["cycleReview"]>();
  const [reviewSource, setReviewSource] = useState<"ai" | "fallback">("fallback");
  const [checkin, setCheckin] = useState(() => loadCheckin(project.id));
  const newCycleNumber = (activeCycle?.cycleNumber ?? completedCycles.length + 1) + 1;
  const effectiveOutcome = selectedOutcome === "advance" && recommendation !== "advance"
    ? recommendation
    : selectedOutcome === "return" && (activeCycle?.stageAtStart ?? "idea") === "idea"
      ? recommendation
      : selectedOutcome ?? recommendation;

  useEffect(() => {
    let active = true;
    void requestAiCoach({
      mode: "cycle_review",
      project: {
        name: project.name,
        description: project.description,
        targetUser: project.targetUser,
        painPoint: project.painPoint,
        alternative: project.alternative,
        acquisition: project.acquisition,
        monetization: project.monetization,
        currentStage: project.currentStage,
        existingArtifact: project.existingArtifact,
        biggestUncertainty: project.biggestUncertainty,
      },
      evidence: {
        interviewCount: evidence.interviewCount,
        activeInterestCount: evidence.messageCount + evidence.signupCount,
        trialCount: evidence.demoTrialCount,
        paymentCount: evidence.paymentSignalCount,
        hasRetention: evidence.retentionSignal,
      },
      cycle: {
        cycleNumber: activeCycle?.cycleNumber ?? 1,
        completedTasks: completed,
        failedTasks: failed,
        newEvidenceCount,
        evidenceDelta,
        currentLight: report.light,
        ruleRecommendation: recommendation,
        previousGoal: activeCycle?.primaryGoal ?? report.currentFocus,
      },
    }).then((response) => {
      if (!active) return;
      setAiReview(response.data.cycleReview);
      setReviewSource(response.source);
    });
    return () => { active = false; };
  }, [activeCycle?.cycleNumber, activeCycle?.primaryGoal, completed, evidence.demoTrialCount, evidence.interviewCount, evidence.messageCount, evidence.paymentSignalCount, evidence.retentionSignal, evidence.signupCount, evidenceDelta, failed, newEvidenceCount, project, recommendation, report.currentFocus, report.light]);

  function updateTask(task: ValidationTask, patch: Partial<ValidationTask>) {
    onTaskChange({ ...task, ...patch });
  }

  function toggleEvidence(task: ValidationTask, recordId: string) {
    const evidenceIds = task.evidenceIds.includes(recordId)
      ? task.evidenceIds.filter((id) => id !== recordId)
      : [...task.evidenceIds, recordId];
    updateTask(task, { evidenceIds });
  }

  function completeCheckin() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const next = checkin.lastDate === today
      ? checkin
      : { lastDate: today, streak: checkin.lastDate === yesterday ? checkin.streak + 1 : 1 };
    setCheckin(next);
    window.localStorage.setItem(`opc-checkin-${project.id}`, JSON.stringify(next));
  }

  return (
    <div className="evidenceRefillScreen">
      <header className="refillHeader">
        <div><span className="routeEyebrow">现实任务日志</span><h1>每完成一段路，就把现实结果带回来。</h1><p>任务不是打卡。记录行为、数量和拒绝原因，再关联证据；重新校准后，你会看到项目使用前后的真实变化。</p></div>
        <div className="refillHeaderActions"><div className="refillProgress"><strong>{completed}</strong><span>完成</span><strong>{failed}</strong><span>未通过</span></div><button className={`checkinButton ${checkin.lastDate === new Date().toISOString().slice(0, 10) ? "checked" : ""}`} type="button" onClick={completeCheckin}><Flame size={16} />{checkin.lastDate === new Date().toISOString().slice(0, 10) ? "今日已确认行动" : "确认今天要推进"}<small>连续 {checkin.streak} 天</small></button></div>
      </header>

      <section className="calibrationCompare">
        <div className="compareHeading"><div><TimerReset size={18} /><strong>{savedMatchesLive && rounds[1] ? "最近一次校准变化" : "当前待校准变化"}</strong></div><span>{newEvidenceCount} 条新证据</span></div>
        <div className="compareLane">
          <article><span>上次</span><strong>{previous?.lightLabel ?? "尚未锁定"}</strong><p>证据 {previous?.evidenceScore ?? 0}/100</p><small>投入 {previous?.investmentLimit.days ?? 0} 天 / {previous?.investmentLimit.money ?? 0} 元</small></article>
          <div className="compareArrow"><RotateCcw size={21} /><strong>{formatDelta(evidenceDelta)}</strong><span>证据分变化</span></div>
          <article className={`light-${report.light}`}><span>现在</span><strong>{current?.lightLabel ?? report.lightLabel}</strong><p>证据 {report.evidenceScore}/100</p><small>投入 {report.investmentLimit.days} 天 / {report.investmentLimit.money} 元</small></article>
        </div>
        <div className="gateChangeList">
          {changedGates.length === 0 ? <p>六个路口暂时没有状态变化。</p> : changedGates.map((gate) => <span key={gate.id}><b>{gateLabels[gate.id]}</b><em>{previous?.gateStatuses[gate.id] ?? "未检查"}</em><i>→</i><strong>{gate.status}</strong></span>)}
        </div>
      </section>

      <section className="taskExecutionBoard">
        <div className="executionHeading"><div><span className="routeEyebrow">7 天执行记录</span><h2>每个任务都要留下结果和证据</h2></div><button className="ghostButton" type="button" onClick={onOpenBackpack}><Backpack size={16} />新增证据</button></div>
        <div className="taskExecutionList">
          {tasks.map((task) => (
            <article key={task.id} className={`taskExecutionItem missionLogItem status-${task.status} ${expandedTaskId === task.id ? "expanded" : ""}`}>
              <button className="taskMissionHeader" type="button" onClick={() => setExpandedTaskId((current) => current === task.id ? null : task.id)} aria-expanded={expandedTaskId === task.id}>
                <div className="taskDay">{String(task.day).padStart(2, "0")}</div>
                <div><span>{taskStatusLabels[task.status]}</span><strong>{task.title}</strong><p>{task.detail}</p></div>
                <div className="missionHeaderMeta"><span>{task.evidenceIds.length} 条关联证据</span><ChevronDown size={18} /></div>
              </button>
              {expandedTaskId === task.id && <div className="missionLogBody">
                <div className="taskStandards"><p><span>通过标准</span>{task.passCriteria}</p><p><span>停止或调整</span>{task.stopCriteria}</p></div>
                <div className="taskStatusControl" aria-label={`第 ${task.day} 天任务状态`}>
                  <button className={task.status === "pending" ? "active" : ""} type="button" onClick={() => updateTask(task, { status: "pending" })}><RotateCcw size={14} />待执行</button>
                  <button className={task.status === "completed" ? "active success" : ""} type="button" onClick={() => updateTask(task, { status: "completed" })}><Check size={14} />已完成</button>
                  <button className={task.status === "failed" ? "active failed" : ""} type="button" onClick={() => updateTask(task, { status: "failed" })}><CircleX size={14} />未通过</button>
                </div>
                <label className="taskResultField"><span>现实结果</span><textarea value={task.result} onChange={(event) => updateTask(task, { result: event.target.value })} placeholder="写实际行为、数量和拒绝原因，不写‘感觉不错’。" /></label>
                <div className="taskEvidenceLinks"><span><Link2 size={13} />关联背包证据</span><div>{records.length === 0 ? <small>背包中还没有证据</small> : records.slice(0, 8).map((record) => <button key={record.id} className={task.evidenceIds.includes(record.id) ? "linked" : ""} type="button" onClick={() => toggleEvidence(task, record.id)}>{evidenceTypeLabels[record.type]} · {record.quantity}</button>)}</div></div>
                <div className="futureEvidenceUploads" aria-label="未来支持的证据提交方式"><span><CalendarCheck2 size={13} />补充材料</span><i><FileImage size={14} />上传截图 · 即将开放</i><i><FileText size={14} />上传文件 · 即将开放</i><i><FileAudio size={14} />上传录音 · 即将开放</i></div>
              </div>}
            </article>
          ))}
        </div>
      </section>

      <section className="recalibrateBar">
        <div><Save size={20} /><p><strong>重新校准只读取背包证据</strong><span>任务勾选和文字说明不会直接提高证据分。</span></p></div>
        <button className="primaryButton" type="button" onClick={onRecalibrate}><RotateCcw size={16} />{saveState}</button>
      </section>

      <section className="cycleReviewBoard">
        <header className="cycleReviewHeading">
          <div><Sparkles size={20} /><span><small>AI 阶段回顾</small><strong>这不是终点，而是下一轮创业旅程的入口。</strong></span></div>
          <em>第 {activeCycle?.cycleNumber ?? 1} 轮</em>
        </header>
        <div className="cycleReviewSummary">
          <article><span>现实行动</span><strong>{completed} 项完成</strong><p>{failed > 0 ? `${failed} 项未通过，同样会进入下一轮判断。` : "已完成任务会与现实证据一起归档。"}</p></article>
          <article><span>证据变化</span><strong>{formatDelta(evidenceDelta)} 分</strong><p>新增 {newEvidenceCount} 条证据，当前证据 {report.evidenceScore}/100。</p></article>
          <article><span>AI 结论 · {reviewSource === "ai" ? "模型复盘" : "本地复盘"}</span><strong>{outcomeLabels[recommendation].title}</strong><p>{aiReview?.summary ?? buildReviewSummary(report, completed, failed, newEvidenceCount)}</p></article>
        </div>
        {aiReview && <div className="cycleAiBrief"><div><span>本轮得到</span>{aiReview.achievements.map((item) => <p key={item}>{item}</p>)}</div><div><span>风险变化</span>{aiReview.riskChanges.map((item) => <p key={item}>{item}</p>)}</div><div><span>下一轮唯一目标</span><strong>{aiReview.nextGoal}</strong><p>{aiReview.rationale}</p></div></div>}
        <div className="cycleOutcomeChooser" role="radiogroup" aria-label="选择下一轮方向">
          {(["advance", "hold", "return"] as CycleOutcome[]).map((outcome) => {
            const option = outcomeLabels[outcome];
            const disabled = outcome === "advance" && recommendation !== "advance" || outcome === "return" && (activeCycle?.stageAtStart ?? "idea") === "idea";
            return <button key={outcome} className={effectiveOutcome === outcome ? "selected" : ""} type="button" disabled={disabled} onClick={() => setSelectedOutcome(outcome)} role="radio" aria-checked={effectiveOutcome === outcome}>
              <span>{option.kicker}{recommendation === outcome ? " · AI推荐" : ""}</span><strong>{option.title}</strong><p>{option.description}</p>
            </button>;
          })}
        </div>
        <footer className="cycleLaunchFooter">
          <p><span>下一轮将继承</span>项目资料、全部证据、历史风险、任务结果和 AI 建议。当前任务与路线会归档，不会覆盖。</p>
          <button className="primaryButton" type="button" onClick={() => onStartNextCycle(effectiveOutcome, aiReview?.summary ?? buildReviewSummary(report, completed, failed, newEvidenceCount))}>开启第 {newCycleNumber} 轮<ArrowRight size={17} /></button>
        </footer>
      </section>

      <section className="calibrationHistoryBoard">
        <div><TimerReset size={18} /><strong>长期校准历程</strong></div>
        {rounds.length === 0 ? <p>还没有校准记录。</p> : <ol>{rounds.map((round) => <li key={round.id}><span>{formatDate(round.createdAt)}</span><strong>{round.lightLabel}</strong><em>证据 {round.evidenceScore}/100</em><p>{round.changeSummary}</p></li>)}</ol>}
      </section>
    </div>
  );
}

function loadCheckin(projectId: string) {
  if (typeof window === "undefined") return { lastDate: "", streak: 0 };
  try {
    const raw = window.localStorage.getItem(`opc-checkin-${projectId}`);
    const parsed = raw ? JSON.parse(raw) as { lastDate?: string; streak?: number } : null;
    return { lastDate: parsed?.lastDate ?? "", streak: Math.max(0, Number(parsed?.streak) || 0) };
  } catch {
    return { lastDate: "", streak: 0 };
  }
}

const outcomeLabels: Record<CycleOutcome, { kicker: string; title: string; description: string }> = {
  advance: { kicker: "前进", title: "进入下一创业阶段", description: "关键证据达到门槛，带着当前成果进入更强验证。" },
  hold: { kicker: "保持", title: "留在当前阶段换路线", description: "项目方向暂不升级，下一轮只更换任务和验证方式。" },
  return: { kicker: "返回", title: "退回上一阶段修正假设", description: "关键假设被否定，先缩小范围再重新出发。" },
};

function buildReviewSummary(report: DecisionReport, completed: number, failed: number, newEvidenceCount: number) {
  if (newEvidenceCount === 0) return "本轮没有新增现实证据，不能因为完成任务就提高项目等级。";
  if (report.light === "green") return `新增证据已跨过关键门槛，完成 ${completed} 项任务后可以受控前进。`;
  if (report.light === "red") return `当前投入与证据不匹配，${failed} 项未通过结果说明需要退回修正。`;
  if (report.light === "blue") return "项目主要问题不是方向，而是缺少外部行动；下一轮必须尽快接触真实用户。";
  return "方向仍可继续验证，但证据不足以升级；下一轮应集中补最薄弱的行为信号。";
}

function roundMatchesReport(round: CalibrationRound, report: DecisionReport, records: EvidenceRecord[]) {
  return round.light === report.light &&
    round.evidenceScore === report.evidenceScore &&
    round.investmentLimit.days === report.investmentLimit.days &&
    round.investmentLimit.money === report.investmentLimit.money &&
    round.evidenceRecordIds.length === records.length &&
    round.evidenceRecordIds.every((id) => records.some((record) => record.id === id)) &&
    report.roadtestChecks.every((gate) => round.gateStatuses[gate.id] === gate.status);
}

function formatDelta(value: number) {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : String(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
