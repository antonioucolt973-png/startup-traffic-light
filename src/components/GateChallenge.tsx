import { ArrowRight, Bot, CheckCircle2, ClipboardPen, Map, MessageSquareReply, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { requestAiCoach } from "../lib/aiClient";
import type { AiCoachResponse } from "../lib/aiSchemas";
import type { DecisionReport, Evidence, EvidenceRecord, GateActionPlan, GateId, Project, RedTeamTurn, SurveyCampaign } from "../types";
import { RoadMap } from "./RoadMap";
import { SurveyWorkshop } from "./SurveyWorkshop";

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
  userId?: string;
  surveys: SurveyCampaign[];
  onSaveSurvey: (survey: SurveyCampaign) => void;
  onAddEvidence: (record: EvidenceRecord) => void;
}

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
  userId,
  surveys,
  onSaveSurvey,
  onAddEvidence,
}: GateChallengeProps) {
  const [review, setReview] = useState<AiCoachResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState<"review" | "redteam" | null>(null);
  const [routeOptions, setRouteOptions] = useState<NonNullable<AiCoachResponse["data"]["routeOptions"]>>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [adjustingPlan, setAdjustingPlan] = useState(false);
  const [customPlanIdea, setCustomPlanIdea] = useState("");
  const gate = report.roadtestChecks.find((item) => item.id === activeGate) ?? report.roadtestChecks[0];
  const gateTurns = useMemo(() => turns.filter((turn) => turn.gateId === activeGate).slice(-2), [turns, activeGate]);
  const latestTurn = gateTurns[gateTurns.length - 1];
  const currentQuestion = latestTurn?.nextQuestion || gate.redTeamPrompt;
  const redTeamComplete = gateTurns.length >= 2;
  const hasPlan = plan.audience.trim().length > 0 && plan.action.trim().length > 0;

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
      id: crypto.randomUUID(),
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

  async function generateRoutes() {
    setRouteLoading(true);
    const result = await requestAiCoach(buildRequest("route_options"));
    setRouteOptions(result.data.routeOptions ?? []);
    setRouteLoading(false);
  }

  function chooseRoute(option: NonNullable<AiCoachResponse["data"]["routeOptions"]>[number]) {
    onPlanChange({
      audience: option.audience,
      action: option.action,
      deadline: option.deadline,
      passCriteria: option.passCriteria,
      stopCriteria: option.stopCriteria,
    });
    setAdjustingPlan(false);
    setReview(null);
  }

  function buildCustomRoute() {
    if (customPlanIdea.trim().length < 6) return;
    const criteria = gate.stage === "demand"
      ? { pass: "至少 3 人明确描述相同问题，并愿意继续沟通", stop: "触达 10 人后少于 2 人承认问题存在，则暂停并调整用户或问题" }
      : gate.stage === "transaction"
        ? { pass: "至少 2 人主动留资、试用、接受报价或进入下一步", stop: "完成 20 次有效触达仍没有主动行为，则更换入口或价值表达" }
        : { pass: "至少完成 1 次投入上限内的真实交付，并获得继续使用意向", stop: "连续 2 次交付超出时间或成本上限，则缩小承诺范围" };
    onPlanChange({
      audience: project.targetUser || "最接近目标用户的 5 人",
      action: customPlanIdea.trim(),
      deadline: "48 小时内",
      passCriteria: criteria.pass,
      stopCriteria: criteria.stop,
    });
    setReview(null);
    setAdjustingPlan(false);
  }

  function buildRequest(mode: "plan_review" | "red_team_followup" | "route_options") {
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

      <RoadMap checks={report.roadtestChecks} activeGate={activeGate} onGateChange={(id) => { onActiveGateChange(id); setReview(null); setAnswer(""); setAdjustingPlan(false); setCustomPlanIdea(""); }} />

      <section className={`gateScenePanel status${gate.status}`}>
        <div className="gateSceneVisual"><ShieldAlert size={30} /><span>{gate.stage === "demand" ? "需求关" : gate.stage === "transaction" ? "交易关" : "交付关"}</span></div>
        <div><span>现实会怎么拦你</span><h2>{gate.title}</h2><p>{gate.scene}</p></div>
        <div className="gateStatusBox"><span>当前路况</span><strong>{gate.status}</strong><p>{gate.evidence}</p></div>
      </section>

      <section className="aiRoutePlanner">
        <div className="aiRouteIntro"><Map size={22} /><div><strong>让AI先拆三条可走路线</strong><p>根据当前路口、已有证据和一人公司的资源限制生成。你仍然可以改写或完全自定义。</p></div></div>
        <div className="routePlannerActions">
          <button className="routeCustomButton" type="button" onClick={() => { setCustomPlanIdea(plan.action); setAdjustingPlan(true); }}><ClipboardPen size={16} />我有自己的做法</button>
          <button className="routeGenerateButton" type="button" onClick={generateRoutes} disabled={routeLoading}>
            {routeLoading ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}{routeOptions.length ? "重新生成路线" : "生成3条行动路线"}
          </button>
        </div>
        {routeOptions.length > 0 && (
          <div className="routeOptionGrid">
            {routeOptions.map((option, index) => (
              <article key={option.title}>
                <span>路线 {index + 1}</span><h3>{option.title}</h3><p>{option.rationale}</p>
                <dl><div><dt>行动</dt><dd>{option.action}</dd></div><div><dt>通过</dt><dd>{option.passCriteria}</dd></div></dl>
                <button type="button" onClick={() => chooseRoute(option)}>选择这条路线<ArrowRight size={15} /></button>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="gateWorkbench">
        <section className="planWorkbench">
          <div className="workbenchHeading"><div><ClipboardPen size={19} /><strong>本路口行动路线</strong></div><span>AI生成，用户确认</span></div>
          {hasPlan && !adjustingPlan ? (
            <article className="selectedMissionCard">
              <header><div><span>已选择路线</span><strong>{plan.action}</strong></div><button type="button" onClick={() => { setCustomPlanIdea(plan.action); setAdjustingPlan(true); }}>重新描述</button></header>
              <div className="missionFacts">
                <p><span>去找谁</span><strong>{plan.audience}</strong></p>
                <p><span>截止时间</span><strong>{plan.deadline}</strong></p>
                <p><span>通过标准</span><strong>{plan.passCriteria}</strong></p>
                <p className="stop"><span>停止或调整</span><strong>{plan.stopCriteria}</strong></p>
              </div>
            </article>
          ) : adjustingPlan ? (
            <div className="routeIdeaComposer">
              <div><Sparkles size={18} /><p><strong>用一句话说你准备怎么验证</strong><span>目标人群、时间、通过标准和停止条件由系统自动补齐。</span></p></div>
              <textarea value={customPlanIdea} onChange={(event) => setCustomPlanIdea(event.target.value)} placeholder="例如：明天把演示发给微信群里认识的 10 位服装店主，邀请他们试用并问是否愿意付费。" autoFocus />
              <div><button type="button" onClick={() => setAdjustingPlan(false)}>取消</button><button className="primaryButton" type="button" onClick={buildCustomRoute} disabled={customPlanIdea.trim().length < 6}><Sparkles size={16} />整理成行动路线</button></div>
            </div>
          ) : (
            <div className="planEmptyState"><Bot size={28} /><strong>先让AI给出三条路线</strong><p>你只需选择最符合资源和时间的一条，再进入红队检查。</p><button type="button" onClick={() => setAdjustingPlan(true)}>或者从空白路线开始</button></div>
          )}
          <div className="planActions"><p>{gate.feedback}</p><button className="primaryButton" type="button" onClick={reviewPlan} disabled={!hasPlan || loading !== null}>{loading === "review" ? <RefreshCw className="spin" size={16} /> : <Bot size={16} />}让AI评估路线</button></div>
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
          <div className="redTeamRoomLabel"><ShieldAlert size={15} /><span>红队压力测试舱</span></div>
          <div className="workbenchHeading"><div><MessageSquareReply size={19} /><strong>红队压力测试</strong></div><span>{gateTurns.length}/2 轮</span></div>
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
      <SurveyWorkshop project={project} gateId={activeGate} gateTitle={gate.title} evidence={evidence} userId={userId} campaigns={surveys} onSaveCampaign={onSaveSurvey} onAddEvidence={onAddEvidence} />
    </div>
  );
}
