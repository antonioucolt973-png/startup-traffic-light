import { Backpack, Check, CircleX, Link2, RotateCcw, Save, TimerReset } from "lucide-react";
import { evidenceTypeLabels, gateLabels, taskStatusLabels } from "../lib/labels";
import type { CalibrationRound, DecisionReport, EvidenceRecord, ValidationTask } from "../types";

interface EvidenceRefillProps {
  report: DecisionReport;
  tasks: ValidationTask[];
  records: EvidenceRecord[];
  rounds: CalibrationRound[];
  onTaskChange: (task: ValidationTask) => void;
  onOpenBackpack: () => void;
  onRecalibrate: () => void;
  saveState: string;
}

export function EvidenceRefill({
  report,
  tasks,
  records,
  rounds,
  onTaskChange,
  onOpenBackpack,
  onRecalibrate,
  saveState,
}: EvidenceRefillProps) {
  const latestRound = rounds[0];
  const savedMatchesLive = latestRound ? roundMatchesReport(latestRound, report, records) : false;
  const previous = savedMatchesLive && rounds[1] ? rounds[1] : latestRound;
  const current = savedMatchesLive ? latestRound : undefined;
  const evidenceDelta = previous ? report.evidenceScore - previous.evidenceScore : report.evidenceScore;
  const newEvidenceCount = previous ? records.filter((record) => !previous.evidenceRecordIds.includes(record.id)).length : records.length;
  const changedGates = previous ? report.roadtestChecks.filter((gate) => previous.gateStatuses[gate.id] !== gate.status) : report.roadtestChecks;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const failed = tasks.filter((task) => task.status === "failed").length;

  function updateTask(task: ValidationTask, patch: Partial<ValidationTask>) {
    onTaskChange({ ...task, ...patch });
  }

  function toggleEvidence(task: ValidationTask, recordId: string) {
    const evidenceIds = task.evidenceIds.includes(recordId)
      ? task.evidenceIds.filter((id) => id !== recordId)
      : [...task.evidenceIds, recordId];
    updateTask(task, { evidenceIds });
  }

  return (
    <div className="evidenceRefillScreen">
      <header className="refillHeader">
        <div><span className="routeEyebrow">证据回填</span><h1>不是汇报做了多少，而是记录现实发生了什么。</h1><p>勾选任务、写下结果、关联证据。重新校准后，系统只按真实证据更新灯号和投入上限。</p></div>
        <div className="refillProgress"><strong>{completed}</strong><span>完成</span><strong>{failed}</strong><span>未通过</span></div>
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
            <article key={task.id} className={`taskExecutionItem status-${task.status}`}>
              <header><div className="taskDay">{String(task.day).padStart(2, "0")}</div><div><span>{taskStatusLabels[task.status]}</span><strong>{task.title}</strong><p>{task.detail}</p></div></header>
              <div className="taskStandards"><p><span>通过标准</span>{task.passCriteria}</p><p><span>停止或调整</span>{task.stopCriteria}</p></div>
              <div className="taskStatusControl" aria-label={`第 ${task.day} 天任务状态`}>
                <button className={task.status === "pending" ? "active" : ""} type="button" onClick={() => updateTask(task, { status: "pending" })}><RotateCcw size={14} />待执行</button>
                <button className={task.status === "completed" ? "active success" : ""} type="button" onClick={() => updateTask(task, { status: "completed" })}><Check size={14} />已完成</button>
                <button className={task.status === "failed" ? "active failed" : ""} type="button" onClick={() => updateTask(task, { status: "failed" })}><CircleX size={14} />未通过</button>
              </div>
              <label className="taskResultField"><span>现实结果</span><textarea value={task.result} onChange={(event) => updateTask(task, { result: event.target.value })} placeholder="写实际行为、数量和拒绝原因，不写‘感觉不错’。" /></label>
              <div className="taskEvidenceLinks"><span><Link2 size={13} />关联背包证据</span><div>{records.length === 0 ? <small>背包中还没有证据</small> : records.slice(0, 8).map((record) => <button key={record.id} className={task.evidenceIds.includes(record.id) ? "linked" : ""} type="button" onClick={() => toggleEvidence(task, record.id)}>{evidenceTypeLabels[record.type]} · {record.quantity}</button>)}</div></div>
            </article>
          ))}
        </div>
      </section>

      <section className="recalibrateBar">
        <div><Save size={20} /><p><strong>重新校准只读取背包证据</strong><span>任务勾选和文字说明不会直接提高证据分。</span></p></div>
        <button className="primaryButton" type="button" onClick={onRecalibrate}><RotateCcw size={16} />{saveState}</button>
      </section>

      <section className="calibrationHistoryBoard">
        <div><TimerReset size={18} /><strong>长期校准历程</strong></div>
        {rounds.length === 0 ? <p>还没有校准记录。</p> : <ol>{rounds.map((round) => <li key={round.id}><span>{formatDate(round.createdAt)}</span><strong>{round.lightLabel}</strong><em>证据 {round.evidenceScore}/100</em><p>{round.changeSummary}</p></li>)}</ol>}
      </section>
    </div>
  );
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
