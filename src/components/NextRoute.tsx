import {
  Backpack,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Flag,
  RefreshCw,
  Route,
  ShieldX,
  TimerReset,
} from "lucide-react";
import { useMemo, useState } from "react";
import { requestAiCoach } from "../lib/aiClient";
import { evidenceTypeLabels, gateLabels, taskStatusLabels } from "../lib/labels";
import type { AiCoachResponse } from "../lib/aiSchemas";
import type { CalibrationRound, DecisionReport, Evidence, EvidenceRecord, Project, ValidationTask } from "../types";

interface NextRouteProps {
  report: DecisionReport;
  project: Project;
  evidence: Evidence;
  records: EvidenceRecord[];
  tasks: ValidationTask[];
  rounds: CalibrationRound[];
  onCopy: () => void;
  copyState: string;
  onResetTasks: () => void;
  onOpenRefill: () => void;
}

const evidenceStrength: Record<EvidenceRecord["type"], number> = {
  research: 1,
  interview: 2,
  problem_story: 3,
  test_post: 3,
  active_interest: 4,
  signup: 4,
  trial: 5,
  quote: 6,
  payment: 7,
  repeat: 8,
  referral: 8,
};

export function NextRoute({
  report,
  project,
  evidence,
  records,
  tasks,
  rounds,
  onCopy,
  copyState,
  onResetTasks,
  onOpenRefill,
}: NextRouteProps) {
  const [coach, setCoach] = useState<AiCoachResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const strongestEvidence = useMemo(() => [...records]
    .filter((record) => record.source !== "ai_inference" && record.source !== "founder_assumption")
    .sort((a, b) => evidenceStrength[b.type] - evidenceStrength[a.type] || b.quantity - a.quantity)[0], [records]);
  const completedTasks = tasks.filter((task) => task.status !== "pending").length;

  async function personalizeTasks() {
    setLoading(true);
    const result = await requestAiCoach({
      mode: "task_personalization",
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
    });
    setCoach(result);
    setLoading(false);
  }

  return (
    <div className="nextRouteScreen">
      <header className={`routePassHeader light-${report.light}`}>
        <div>
          <span className="routeEyebrow">下一程路线</span>
          <h1>{project.name || "当前项目"}现在该怎么开。</h1>
          <p>{report.lightReason}</p>
        </div>
        <div className="routePassSignal">
          <span>当前灯号</span>
          <strong>{report.lightLabel}</strong>
          <p>证据 {report.evidenceScore}/100 · 路测 {report.planScore}/100</p>
        </div>
      </header>

      <section className="routeFocusBand">
        <Flag size={24} />
        <div><span>本轮唯一重点</span><strong>{report.currentFocus}</strong><p>{report.nextReviewTrigger}</p></div>
        <button className="primaryButton" type="button" onClick={onOpenRefill}><ClipboardCheck size={16} />开始执行与回填</button>
      </section>

      <div className="routeDecisionGrid">
        <article className="routeDecisionCard">
          <span>投入上限</span>
          <div className="limitNumbers"><strong>{report.investmentLimit.days}<small>天</small></strong><strong>{report.investmentLimit.money}<small>元</small></strong></div>
          <p>这是本轮验证预算，不是项目总预算。</p>
        </article>
        <article className="routeDecisionCard danger">
          <span><ShieldX size={15} />本轮禁止事项</span>
          <ul>{report.investmentLimit.bans.map((ban) => <li key={ban}>{ban}</li>)}</ul>
        </article>
        <article className="routeDecisionCard evidence">
          <span><Backpack size={15} />当前最强证据</span>
          {strongestEvidence ? <><strong>{evidenceTypeLabels[strongestEvidence.type]}</strong><p>{strongestEvidence.behavior}</p></> : <p>还没有来自真实用户行为的证据。</p>}
        </article>
      </div>

      <section className="taskRouteBoard">
        <div className="taskRouteHeading">
          <div><span className="routeEyebrow">7 天最小验证</span><h2>每天只做一件会产生外部结果的事</h2><p>任务完成不等于通过，只有回填的用户行为会改变灯号。</p></div>
          <div className="taskBoardActions"><span>{completedTasks}/7 已回填</span><button className="ghostButton" type="button" onClick={onResetTasks}><TimerReset size={15} />按当前状态重排</button></div>
        </div>
        <div className="taskRouteList">
          {tasks.map((task) => (
            <article key={task.id} className={`taskRouteItem status-${task.status}`}>
              <div className="taskDay">{String(task.day).padStart(2, "0")}</div>
              <div><span>{taskStatusLabels[task.status]}</span><strong>{task.title.replace(/^第\s*\d+\s*天\s*·\s*/, "")}</strong><p>{task.detail}</p></div>
              {task.status === "completed" ? <CheckCircle2 size={21} /> : <Route size={21} />}
            </article>
          ))}
        </div>
        <div className="taskCoachRow">
          <button className="ghostButton" type="button" onClick={personalizeTasks} disabled={loading}>{loading ? <RefreshCw className="spin" size={15} /> : <Bot size={15} />}检查任务是否够具体</button>
          <button className="copyButton" type="button" onClick={onCopy}><Copy size={15} />{copyState}</button>
        </div>
        {coach && <article className={`taskCoachResult source-${coach.source}`}><div><strong>{coach.source === "ai" ? "AI 任务建议" : "规则任务建议"}</strong><span>{coach.source === "ai" ? "模型补充" : "稳定降级"}</span></div><p>{coach.data.summary}</p><ul>{coach.data.suggestions.map((item) => <li key={item}>{item}</li>)}</ul></article>}
      </section>

      <div className="routeBottomGrid">
        <section className="stopBoard">
          <div><ShieldX size={18} /><strong>停止或调整条件</strong></div>
          <ul>{report.stopConditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
        </section>
        <section className="gateLedger">
          <div><Route size={18} /><strong>六个路口账本</strong></div>
          <div>{report.roadtestChecks.map((gate) => <span key={gate.id}><b>{gateLabels[gate.id]}</b><em>{gate.status}</em></span>)}</div>
        </section>
        <section className="roundLedger">
          <div><TimerReset size={18} /><strong>校准记录</strong></div>
          {rounds.length === 0 ? <p>进入本页后会锁定本轮起点。</p> : <ol>{rounds.slice(0, 4).map((round) => <li key={round.id}><span>{formatDate(round.createdAt)}</span><strong>{round.lightLabel}</strong><p>{round.changeSummary}</p></li>)}</ol>}
        </section>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
