import {
  ArrowRight,
  Backpack,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Flag,
  History,
  Lightbulb,
  LockKeyhole,
  RotateCcw,
  Route,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { recommendCycleOutcome } from "../lib/cycleEngine";
import type { CalibrationRound, CycleOutcome, DecisionReport, EvidenceRecord, JourneyCycle, Project, ValidationTask } from "../types";

interface EvidenceRefillProps {
  report: DecisionReport;
  project: Project;
  initialProject: Project | null;
  tasks: ValidationTask[];
  records: EvidenceRecord[];
  rounds: CalibrationRound[];
  activeCycle?: JourneyCycle;
  completedCycles: JourneyCycle[];
  onOpenBackpack: () => void;
  onStartNextCycle: (outcome: CycleOutcome, aiReview: string, nextGoal: string) => void;
}

type ReviewSection = "result" | "assumptions" | "review" | "decision";

const reviewSections: Array<{ id: ReviewSection; label: string }> = [
  { id: "result", label: "本轮结果" },
  { id: "assumptions", label: "假设结算" },
  { id: "review", label: "AI复盘" },
  { id: "decision", label: "下一轮决策" },
];

export function EvidenceRefill({
  report,
  project,
  initialProject,
  tasks,
  records,
  rounds,
  activeCycle,
  completedCycles,
  onOpenBackpack,
  onStartNextCycle,
}: EvidenceRefillProps) {
  const confirmedRecords = useMemo(() => records.filter((record) => record.reviewStatus === "confirmed"), [records]);
  const pendingRecords = records.filter((record) => record.reviewStatus === "pending");
  const completedTasks = tasks.filter((task) => task.workflowStatus === "completed");
  const baselineScore = activeCycle?.evidenceScoreBefore ?? rounds[rounds.length - 1]?.evidenceScore ?? 0;
  const scoreDelta = report.evidenceScore - baselineScore;
  const recommendation = recommendCycleOutcome(report, activeCycle?.stageAtStart ?? project.currentStage);
  const [selectedOutcome, setSelectedOutcome] = useState<CycleOutcome>(recommendation);
  const [nextGoal, setNextGoal] = useState(() => buildNextGoal(project, confirmedRecords));
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const hypothesisRows = useMemo(() => buildHypothesisRows(project, tasks, confirmedRecords), [confirmedRecords, project, tasks]);
  const review = useMemo(() => buildAiReview(project, confirmedRecords, completedTasks, pendingRecords.length), [completedTasks, confirmedRecords, pendingRecords.length, project]);
  const newCycleNumber = (activeCycle?.cycleNumber ?? completedCycles.length + 1) + 1;
  const canAdvance = recommendation === "advance";
  const canReturn = (activeCycle?.stageAtStart ?? project.currentStage) !== "idea";

  function scrollToSection(id: ReviewSection) {
    document.getElementById(`growth-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function chooseOutcome(outcome: CycleOutcome) {
    if (outcome === "advance" && !canAdvance) return;
    if (outcome === "return" && !canReturn) return;
    setSelectedOutcome(outcome);
  }

  return (
    <div className="evidenceRefillScreen growthReviewScreen">
      <header className="growthReviewHero">
        <div><span>第 {activeCycle?.cycleNumber ?? 1} 轮成长回顾</span><h1>这一轮，现实告诉了我们什么？</h1><p>结算任务、证据和关键假设，再决定下一轮继续、调整还是返回。AI只能基于已确认证据复盘。</p></div>
        <article className={`growthConclusion light-${report.light}`}><small>当前结论</small><strong>{conclusionTitle(report, confirmedRecords.length)}</strong><p>{conclusionSummary(report, confirmedRecords.length)}</p></article>
      </header>

      <nav className="growthReviewNav" aria-label="成长回顾页面导览">
        {reviewSections.map((section, index) => <button key={section.id} type="button" onClick={() => scrollToSection(section.id)}><i>{index + 1}</i><span>{section.label}</span></button>)}
      </nav>

      <section id="growth-result" className="growthReviewSection roundSettlement">
        <header><div><span>本轮结算</span><h2>不是完成了多少页面，而是获得了什么现实结果。</h2></div><Flag size={26} /></header>
        <div className="settlementSummary">
          <article className="settlementNarrative">
            <div className="proved"><CheckCircle2 size={20} /><div><span>这一轮已经得到</span><strong>{review.achievement}</strong></div></div>
            <div className="unproved"><CircleAlert size={20} /><div><span>这一轮还没有证明</span><strong>{review.highestRisk}</strong></div></div>
          </article>
          <div className="settlementMetrics">
            <article><span>已执行任务</span><strong>{completedTasks.length}<small>/{tasks.length}</small></strong></article>
            <article><span>已确认证据</span><strong>{confirmedRecords.length}</strong></article>
            <article><span>需要补证</span><strong>{pendingRecords.length}</strong></article>
            <article className={`light-${report.light}`}><span>当前灯号</span><strong>{report.lightLabel}</strong></article>
          </div>
        </div>
        <div className="evidenceChangeBar"><div><span>证据充分度变化</span><strong>{baselineScore}</strong><i>→</i><strong>{report.evidenceScore}</strong><em>{formatDelta(scoreDelta)}</em></div><div className="evidenceChangeMeter"><i style={{ width: `${baselineScore}%` }} /><b style={{ width: `${report.evidenceScore}%` }} /></div><button type="button" onClick={onOpenBackpack}><Backpack size={15} />查看证据依据</button></div>
      </section>

      <section id="growth-assumptions" className="growthReviewSection assumptionSettlement">
        <header><div><span>假设结算</span><h2>哪些得到支持，哪些仍然只是想法。</h2><p>结论只读取已确认证据；待补证和已排除记录不会支持假设。</p></div><Target size={26} /></header>
        <div className="hypothesisTable" role="table" aria-label="关键假设验证结果">
          <div className="hypothesisTableHead" role="row"><span>关键假设</span><span>结论</span><span>证据依据</span></div>
          {hypothesisRows.map((row) => <article key={row.title} className={`hypothesisRow status-${row.status}`} role="row"><strong>{row.title}</strong><span>{row.status}</span><p>{row.evidence}</p>{row.hasEvidence ? <button type="button" onClick={onOpenBackpack}>查看证据<ArrowRight size={13} /></button> : null}</article>)}
        </div>
      </section>

      <section className="growthReviewSection projectGrowthChanges">
        <header><div><span>本轮成长变化</span><h2>项目从模糊想法，变成了更具体的验证对象。</h2></div><TrendingUp size={26} /></header>
        <div className="growthChangeList">
          {buildGrowthChanges(initialProject, project, confirmedRecords).map((change) => <article key={change.label}><span>{change.label}</span><div><small>起点</small><p>{change.before}</p></div><ArrowRight size={17} /><div className="after"><small>现在</small><strong>{change.after}</strong></div></article>)}
        </div>
      </section>

      <section id="growth-review" className="growthReviewSection aiRoundReview">
        <header><div><span>AI阶段复盘</span><h2>只根据已确认的现实证据得出摘要。</h2><p>依据：{completedTasks.length} 项已通过任务、{confirmedRecords.length} 条已确认证据。</p></div><Sparkles size={27} /></header>
        <div className="aiReviewGrid">
          <article><CheckCircle2 size={18} /><span>本轮得到</span><strong>{review.achievement}</strong></article>
          <article><TrendingUp size={18} /><span>下降的风险</span><strong>{review.loweredRisk}</strong></article>
          <article className="risk"><CircleAlert size={18} /><span>当前最高风险</span><strong>{review.highestRisk}</strong></article>
          <article className="goal"><Target size={18} /><span>下一轮唯一目标</span><strong>{nextGoal}</strong></article>
        </div>
        {confirmedRecords.length === 0 ? <aside className="noEvidenceWarning"><CircleAlert size={17} /><p>本轮没有已确认证据。即使完成了操作，也不能升级项目判断；下一轮仍应优先获得真实用户行为。</p></aside> : null}
      </section>

      <section id="growth-decision" className="growthReviewSection nextCycleDecision">
        <header><div><span>下一轮决策</span><h2>选择继续前进、保持调整或返回修正。</h2></div><Route size={26} /></header>
        <div className="outcomeDecisionCards" role="radiogroup" aria-label="下一轮方向">
          <button className={selectedOutcome === "advance" ? "selected" : ""} type="button" disabled={!canAdvance} onClick={() => chooseOutcome("advance")} role="radio" aria-checked={selectedOutcome === "advance"}><span>{canAdvance ? <TrendingUp size={18} /> : <LockKeyhole size={18} />}继续前进</span><strong>进入下一创业阶段</strong><p>关键证据达到门槛，进入更强的交易或交付验证。</p>{recommendation === "advance" ? <em>AI推荐</em> : <small>当前证据未达到升级门槛</small>}</button>
          <button className={selectedOutcome === "hold" ? "selected" : ""} type="button" onClick={() => chooseOutcome("hold")} role="radio" aria-checked={selectedOutcome === "hold"}><span><RotateCcw size={18} />保持阶段</span><strong>调整下一轮验证路线</strong><p>不升级项目阶段，只更换任务和验证方法。</p>{recommendation === "hold" ? <em>AI推荐</em> : null}</button>
          <button className={selectedOutcome === "return" ? "selected" : ""} type="button" disabled={!canReturn} onClick={() => chooseOutcome("return")} role="radio" aria-checked={selectedOutcome === "return"}><span>{canReturn ? <ArrowRight size={18} /> : <LockKeyhole size={18} />}返回修正</span><strong>退回上一阶段修正假设</strong><p>目标用户、问题或商业路径被否定时，缩小范围重新开始。</p>{recommendation === "return" ? <em>AI推荐</em> : null}</button>
        </div>

        <article className="nextCycleLaunchCard">
          <header><div><span>第 {newCycleNumber} 轮即将开始</span><h3>带着证据进入下一轮，而不是从头再来。</h3></div><Lightbulb size={25} /></header>
          <label><span>下一轮唯一目标</span><textarea value={nextGoal} onChange={(event) => setNextGoal(event.target.value)} /></label>
          <div className="nextCycleFacts"><p><span>建议周期</span><strong>7天</strong></p><p><span>投入上限</span><strong>{report.investmentLimit.days}天 / {report.investmentLimit.money}元</strong></p><p><span>将继承</span><strong>项目资料、历史证据、风险记录和任务结果</strong></p></div>
          <footer><p>选择“开启下一轮”后，本轮任务与证据会归档，不会被覆盖。</p><button className="primaryButton" type="button" disabled={!nextGoal.trim()} onClick={() => onStartNextCycle(selectedOutcome, review.summary, nextGoal)}>开启第 {newCycleNumber} 轮<ArrowRight size={16} /></button></footer>
        </article>
      </section>

      <section className="growthReviewSection cycleHistorySection">
        <header><div><span>历史轮次</span><h2>每一轮都保留当时的目标、证据和决定。</h2></div><History size={25} /></header>
        {completedCycles.length === 0 ? <div className="cycleHistoryEmpty">完成当前轮次后，这里会出现第一条成长记录。</div> : <div className="cycleHistoryList">{completedCycles.map((cycle) => { const expanded = expandedHistoryId === cycle.id; return <article key={cycle.id}><button type="button" onClick={() => setExpandedHistoryId((current) => current === cycle.id ? null : cycle.id)}><i>第 {cycle.cycleNumber} 轮</i><span>{stageLabel(cycle.stageAtStart)}验证</span><strong>{lightLabel(cycle.lightBefore)} → {cycle.lightAfter ? lightLabel(cycle.lightAfter) : "未结算"}</strong><em>证据 {cycle.evidenceScoreBefore} → {cycle.evidenceScoreAfter ?? cycle.evidenceScoreBefore}</em><ChevronDown className={expanded ? "open" : ""} size={16} /></button>{expanded ? <div><p><span>当轮目标</span>{cycle.primaryGoal}</p><p><span>完成任务</span>{cycle.taskSnapshot.filter((task) => task.workflowStatus === "completed").length} 项</p><p><span>AI结论</span>{cycle.aiReview || "没有保存复盘摘要"}</p><p><span>用户选择</span>{cycle.outcome ? outcomeTitle(cycle.outcome) : "未记录"}</p></div> : null}</article>; })}</div>}
      </section>
    </div>
  );
}

function buildHypothesisRows(project: Project, tasks: ValidationTask[], records: EvidenceRecord[]) {
  const byMilestone = (id: string) => records.filter((record) => record.milestoneId === id);
  const completedIn = (id: string) => tasks.some((task) => task.milestoneId === id && task.workflowStatus === "completed");
  const demand = byMilestone("m1");
  const trials = byMilestone("m2");
  const acquisition = byMilestone("m3");
  const transaction = byMilestone("m4");
  return [
    { title: `${project.targetUser || "目标用户"}确实存在当前问题`, status: demand.length >= 1 ? "已支持" : completedIn("m1") ? "证据不足" : "尚未验证", evidence: demand.length ? `${demand.reduce((sum, record) => sum + record.quantity, 0)} 人/次的访谈或意愿记录` : "尚无已确认的需求证据", hasEvidence: demand.length > 0 },
    { title: "用户愿意上传照片完成换衣体验", status: trials.length >= 1 ? "初步支持" : demand.some((record) => record.behavior.includes("拒绝")) ? "证据不足" : "尚未验证", evidence: trials.length ? `${trials.reduce((sum, record) => sum + record.quantity, 0)} 次已确认试用行为` : "尚未完成真实商品换衣试用", hasEvidence: trials.length > 0 },
    { title: "换衣结果能够帮助用户改变购买判断", status: trials.some((record) => /改变|帮助|决定/.test(`${record.behavior}${record.userQuote ?? ""}`)) ? "已支持" : completedIn("m2") ? "证据不足" : "尚未验证", evidence: trials.length ? trials[0].behavior : "没有已确认的决策行为记录", hasEvidence: trials.length > 0 },
    { title: "能够通过低成本渠道获得种子用户", status: acquisition.length >= 1 ? "初步支持" : completedIn("m3") ? "证据不足" : "尚未验证", evidence: acquisition.length ? `${acquisition.reduce((sum, record) => sum + record.quantity, 0)} 个主动反馈或留资行为` : "尚未获得已确认的主动反馈", hasEvidence: acquisition.length > 0 },
    { title: "个人用户或服装店愿意付费", status: transaction.some((record) => record.type === "payment") ? "已支持" : transaction.length ? "证据不足" : "尚未验证", evidence: transaction.length ? transaction[0].behavior : "尚未完成报价、预订或付款验证", hasEvidence: transaction.length > 0 },
  ];
}

function buildAiReview(project: Project, records: EvidenceRecord[], completedTasks: ValidationTask[], pendingCount: number) {
  if (records.length === 0) return { achievement: "尚未形成能够支持项目判断的现实证据。", loweredRisk: "没有风险因任务打勾而自动下降。", highestRisk: "目标用户是否会采取真实行动仍然未知。", summary: "本轮没有已确认证据，不能升级项目判断；下一轮应优先完成一次可复核的用户行动。" };
  const hasTrial = records.some((record) => record.type === "trial");
  const hasPayment = records.some((record) => record.type === "payment" || record.type === "quote");
  const achievement = hasPayment ? "已经获得报价、预订或付款层面的外部信号。" : hasTrial ? "目标用户已经完成真实试用，需求从口头反馈进入行为验证。" : "目标用户的问题获得初步访谈或意愿证据支持。";
  const loweredRisk = hasTrial ? "用户是否愿意实际体验的风险开始下降。" : "目标用户是否真实存在这个问题，从未知变为初步支持。";
  const highestRisk = hasPayment ? "用户是否会持续使用并形成可重复交付。" : hasTrial ? "用户是否愿意为换衣结果付费或推荐给他人。" : "用户是否愿意上传照片，并根据换衣结果改变购买决定。";
  return { achievement, loweredRisk, highestRisk, summary: `本轮完成 ${completedTasks.length} 项已通过任务，形成 ${records.length} 条已确认证据，另有 ${pendingCount} 条需要补证。${achievement}${highestRisk}` };
}

function buildGrowthChanges(initial: Project | null, project: Project, records: EvidenceRecord[]) {
  return [
    { label: "用户理解", before: initial?.targetUser || "模糊的目标用户", after: project.targetUser || "仍待明确目标用户" },
    { label: "核心问题", before: initial?.painPoint || "想解决一个宽泛问题", after: project.painPoint || "仍待确认核心问题" },
    { label: "商业路径", before: initial?.monetization || "尚未确认如何收费", after: project.monetization || "先验证真实行动，再决定收费方式" },
    { label: "验证能力", before: initial?.existingArtifact || "只有想法", after: records.length ? `已有 ${records.length} 条已确认现实证据` : project.existingArtifact || "尚未形成现实证据" },
  ];
}

function buildNextGoal(project: Project, records: EvidenceRecord[]) {
  if (records.some((record) => record.type === "payment" || record.type === "quote")) return "验证首批用户是否会持续使用，并确认一次交付的时间和成本是否可控。";
  if (records.some((record) => record.type === "trial")) return "测试个人用户9.9元按次付费与服装店合作意愿，获得至少1次付款、预订或试用承诺。";
  return `完成5次真实商品换衣试用，验证${project.targetUser || "目标用户"}是否会根据结果改变购买决定。`;
}

function conclusionTitle(report: DecisionReport, confirmedCount: number) {
  if (confirmedCount === 0) return "没有证据，暂不升级判断";
  if (report.light === "green") return "关键证据达到门槛，可以受控前进";
  if (report.light === "red") return "投入与证据不匹配，需要返回修正";
  return "保持当前阶段，继续小范围验证";
}

function conclusionSummary(report: DecisionReport, confirmedCount: number) {
  if (confirmedCount === 0) return "本轮操作尚未形成已确认证据，不能因为完成任务就提高项目等级。";
  return report.lightReason;
}

function stageLabel(stage: Project["currentStage"]) {
  return { idea: "想法", research: "研究", demo: "演示", mvp: "MVP", growth: "增长" }[stage];
}

function lightLabel(light: JourneyCycle["lightBefore"]) {
  return { red: "红灯", yellow: "黄灯", green: "绿灯", blue: "蓝灯" }[light];
}

function outcomeTitle(outcome: CycleOutcome) {
  return { advance: "继续前进", hold: "保持阶段并调整路线", return: "返回修正假设" }[outcome];
}

function formatDelta(value: number) {
  if (value === 0) return "无变化";
  return value > 0 ? `+${value}` : String(value);
}
