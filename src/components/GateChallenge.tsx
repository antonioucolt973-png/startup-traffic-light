import { ArrowRight, Bot, CheckCircle2, ClipboardPen, MessageSquareReply, RefreshCw, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { requestAiCoach } from "../lib/aiClient";
import type { AiCoachResponse } from "../lib/aiSchemas";
import type { DecisionReport, Evidence, GateActionPlan, GateId, Project, RedTeamTurn } from "../types";
import { RoadMap } from "./RoadMap";

interface GateChallengeProps {
  project: Project;
  report: DecisionReport;
  evidence: Evidence;
  activeGate: GateId;
  onActiveGateChange: (gate: GateId) => void;
  plan: GateActionPlan;
  onPlanChange: (plan: GateActionPlan) => void;
  turns: RedTeamTurn[];
  onAddTurn: (turn: RedTeamTurn) => void;
  onOpenBackpack: () => void;
}

const planFields: Array<{ key: keyof GateActionPlan; label: string; placeholder: string }> = [
  { key: "audience", label: "找谁", placeholder: "具体人群、名单、社群或已有联系人" },
  { key: "action", label: "做什么", placeholder: "访谈、发送演示、邀请试用、提出报价等现实行动" },
  { key: "deadline", label: "什么时候完成", placeholder: "例如：明天下午 6 点前，或 48 小时内" },
  { key: "passCriteria", label: "什么算通过", placeholder: "例如：10 人中至少 3 人愿意试用" },
  { key: "stopCriteria", label: "什么情况停止或调整", placeholder: "例如：10 人中少于 2 人承认痛点就暂停" },
];

export function GateChallenge({
  project,
  report,
  evidence,
  activeGate,
  onActiveGateChange,
  plan,
  onPlanChange,
  turns,
  onAddTurn,
  onOpenBackpack,
}: GateChallengeProps) {
  const [review, setReview] = useState<AiCoachResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState<"review" | "redteam" | null>(null);
  const gate = report.roadtestChecks.find((item) => item.id === activeGate) ?? report.roadtestChecks[0];
  const gateTurns = useMemo(() => turns.filter((turn) => turn.gateId === activeGate).slice(-2), [turns, activeGate]);
  const latestTurn = gateTurns[gateTurns.length - 1];
  const currentQuestion = latestTurn?.nextQuestion || gate.redTeamPrompt;
  const redTeamComplete = gateTurns.length >= 2;

  function updatePlan(key: keyof GateActionPlan, value: string) {
    onPlanChange({ ...plan, [key]: value });
    setReview(null);
  }

  async function reviewPlan() {
    setLoading("review");
    const result = await requestAiCoach(buildRequest("plan_review"));
    setReview(result);
    setLoading(null);
  }

  async function answerRedTeam() {
    if (!answer.trim() || redTeamComplete) return;
    setLoading("redteam");
    const result = await requestAiCoach({
      ...buildRequest("red_team_followup"),
      previousQuestion: currentQuestion,
      answer: answer.trim(),
    });
    const round = (gateTurns.length + 1) as 1 | 2;
    onAddTurn({
      id: `${Date.now()}-${activeGate}-${round}`,
      projectId: project.id,
      gateId: activeGate,
      round,
      question: currentQuestion,
      answer: answer.trim(),
      feedback: result.data.summary,
      nextQuestion: result.data.questions[0],
      source: result.source,
      createdAt: new Date().toISOString(),
    });
    setAnswer("");
    setLoading(null);
  }

  function buildRequest(mode: "plan_review" | "red_team_followup") {
    return {
      mode,
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
      gate: { id: gate.id, title: gate.title, scene: gate.scene, currentEvidence: gate.evidence },
      plan,
    } as const;
  }

  return (
    <div className="gateChallengeScreen">
      <header className="gateChallengeHeader">
        <div><span className="routeEyebrow">现实路口</span><h1>一次只处理一个现实问题。</h1><p>你可以拿出证据，也可以提交一份具体的补证方案。红队会继续追问，但不会禁止你修改和回答。</p></div>
        <button className="ghostButton" type="button" onClick={onOpenBackpack}>打开证据背包<ArrowRight size={16} /></button>
      </header>

      <RoadMap checks={report.roadtestChecks} activeGate={activeGate} onGateChange={(id) => { onActiveGateChange(id); setReview(null); setAnswer(""); }} />

      <section className={`gateScenePanel status${gate.status}`}>
        <div className="gateSceneVisual"><ShieldAlert size={30} /><span>{gate.stage === "demand" ? "需求关" : gate.stage === "transaction" ? "交易关" : "交付关"}</span></div>
        <div><span>现实会怎么拦你</span><h2>{gate.title}</h2><p>{gate.scene}</p></div>
        <div className="gateStatusBox"><span>当前路况</span><strong>{gate.status}</strong><p>{gate.evidence}</p></div>
      </section>

      <div className="gateWorkbench">
        <section className="planWorkbench">
          <div className="workbenchHeading"><div><ClipboardPen size={19} /><strong>我的补证方案</strong></div><span>好计划只能获得路测资格</span></div>
          <div className="structuredPlanGrid">
            {planFields.map((field) => (
              <label key={field.key} className={field.key === "action" ? "wide" : ""}>
                <span>{field.label}</span>
                {field.key === "action" ? <textarea value={plan[field.key]} onChange={(event) => updatePlan(field.key, event.target.value)} placeholder={field.placeholder} /> : <input value={plan[field.key]} onChange={(event) => updatePlan(field.key, event.target.value)} placeholder={field.placeholder} />}
              </label>
            ))}
          </div>
          <div className="planActions"><p>{gate.feedback}</p><button className="primaryButton" type="button" onClick={reviewPlan} disabled={loading !== null}>{loading === "review" ? <RefreshCw className="spin" size={16} /> : <Bot size={16} />}评估方案</button></div>
          {review && (
            <article className={`planReview source-${review.source}`}>
              <div><strong>{review.source === "ai" ? "AI 方案评估" : "规则方案评估"}</strong><span>{review.source === "ai" ? "模型建议" : "稳定降级"}</span></div>
              <p>{review.data.summary}</p>
              {review.data.missingFields.length > 0 && <p>仍缺：{review.data.missingFields.join("、")}</p>}
              <ul>{review.data.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul>
            </article>
          )}
        </section>

        <section className="redTeamConversation">
          <div className="workbenchHeading"><div><MessageSquareReply size={19} /><strong>红队检查员</strong></div><span>{gateTurns.length}/2 轮</span></div>
          <div className="conversationThread">
            {gateTurns.map((turn) => (
              <div key={turn.id} className="conversationRound">
                <p className="inspectorBubble">{turn.question}</p>
                <p className="founderBubble">{turn.answer}</p>
                <p className="reviewBubble"><CheckCircle2 size={14} />{turn.feedback}<span>{turn.source === "ai" ? "AI" : "规则"}</span></p>
              </div>
            ))}
            {!redTeamComplete && <p className="inspectorBubble current">{currentQuestion}</p>}
          </div>
          {redTeamComplete ? (
            <div className="conversationComplete"><CheckCircle2 size={18} /><p>本轮红队检查完成。你仍可以继续修改上面的方案，路口状态会按规则重新计算。</p></div>
          ) : (
            <div className="answerComposer"><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="直接回答，不需要迎合检查员。写清楚你的依据或准备怎么改。" /><button className="primaryButton" type="button" onClick={answerRedTeam} disabled={!answer.trim() || loading !== null}>{loading === "redteam" ? <RefreshCw className="spin" size={16} /> : <MessageSquareReply size={16} />}提交回答</button></div>
          )}
        </section>
      </div>
    </div>
  );
}
