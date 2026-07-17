import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FileSearch,
  Flag,
  Lightbulb,
  LockKeyhole,
  MapPinned,
  PencilLine,
  Rocket,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  researchPresets,
  riskPresets,
  roadmapPresets,
  solutionSteps,
  type SolutionField,
} from "../data/intersectionDecisionPresets";
import type { GateActionPlan, Project, ValidationTask } from "../types";
import { requestAiCoach } from "../lib/aiClient";
import type { AiCoachData, AiCoachRequest } from "../lib/aiSchemas";
import { buildFallbackCoachResponse } from "../lib/aiFallback";
import { isCompetitionPresetIdea } from "../data/competitionPreset";

interface GateChallengeProps {
  project: Project;
  selectedRoute: GateActionPlan;
  onEnterTasks: (tasks: ValidationTask[]) => void;
}

type DecisionStage = "guide" | "summary" | "research" | "redteam" | "result" | "roadmap";
type SolutionAnswers = Record<SolutionField, Record<string, string>>;
type RiskResolution = { mode: "mitigation" | "accepted"; mitigationIndex?: number; update: string };
type ResearchReport = NonNullable<AiCoachData["researchReport"]>;
type DynamicRisk = NonNullable<AiCoachData["redTeamRisks"]>[number];
type RoadmapDraft = NonNullable<AiCoachData["roadmapDraft"]>;
type SolutionRefinement = NonNullable<AiCoachData["solutionRefinement"]>;

const decisionStages: Array<{ id: DecisionStage; label: string }> = [
  { id: "guide", label: "方案引导" },
  { id: "summary", label: "方案确认" },
  { id: "research", label: "资料分析" },
  { id: "redteam", label: "红队测试" },
  { id: "result", label: "测试结论" },
  { id: "roadmap", label: "路线地图" },
];

export function GateChallenge({ project, selectedRoute, onEnterTasks }: GateChallengeProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const [unlockedStage, setUnlockedStage] = useState(0);
  const [guideStep, setGuideStep] = useState(0);
  const [answers, setAnswers] = useState<SolutionAnswers>(() => emptySolutionAnswers(project));
  const [completedSteps, setCompletedSteps] = useState<SolutionField[]>([]);
  const [researchReady, setResearchReady] = useState(false);
  const [riskIndex, setRiskIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Record<string, RiskResolution>>({});
  const [customRiskPlan, setCustomRiskPlan] = useState("");
  const [riskAcceptanceReason, setRiskAcceptanceReason] = useState("");
  const [editingCustomRisk, setEditingCustomRisk] = useState(false);
  const [acceptedResult, setAcceptedResult] = useState(false);
  const [solutionSuggestion, setSolutionSuggestion] = useState<SolutionRefinement | null>(null);
  const [stageLoading, setStageLoading] = useState<"solution" | "research" | "redteam" | "roadmap" | null>(null);
  const [aiMessage, setAiMessage] = useState("");
  const [researchReport, setResearchReport] = useState<ResearchReport>(() => fallbackResearchReport());
  const [risks, setRisks] = useState<DynamicRisk[]>(() => fallbackRisks());
  const [roadmapDraft, setRoadmapDraft] = useState<RoadmapDraft>(() => fallbackRoadmapDraft(project));
  const solutionRequestRef = useRef(0);
  const researchRequestRef = useRef(0);
  const redTeamRequestRef = useRef(0);
  const redTeamInteractedRef = useRef(false);
  const roadmapRequestRef = useRef(0);
  const presetOnly = useMemo(() => isCompetitionPresetIdea(project, project.description), [project]);

  const currentStep = solutionSteps[guideStep];
  const currentRisk = risks[riskIndex] ?? risks[0];
  const resolvedCount = Object.keys(resolutions).length;
  const highRiskOpen = risks.filter((risk) => risk.severity === "高危" && !resolutions[risk.id]).length;

  function goToStage(index: number) {
    if (index > unlockedStage) return;
    setStageIndex(index);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function unlockAndGo(index: number) {
    setUnlockedStage((current) => Math.max(current, index));
    setStageIndex(index);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function updateAnswer(step: SolutionField, key: string, value: string) {
    setAnswers((current) => ({ ...current, [step]: { ...current[step], [key]: value } }));
  }

  async function improveCurrentStep() {
    if (stageLoading) return;
    setStageLoading("solution");
    const request = buildStageRequest("solution_refinement", project, {
      step: currentStep.id,
      answers: answers[currentStep.id],
      selectedRoute,
    });
    const immediate = buildFallbackCoachResponse(request, "已先显示本地参考，MiMo 正在后台尝试升级。");
    const requestId = ++solutionRequestRef.current;
    setSolutionSuggestion(immediate.data.solutionRefinement ?? null);
    setAiMessage(immediate.notice ?? "");
    const response = await requestAiCoach(request, {
      strategy: presetOnly ? "preset-only" : "live-first",
      cacheKey: `solution:${project.id}:${currentStep.id}:${JSON.stringify(answers[currentStep.id])}`,
    });
    if (requestId === solutionRequestRef.current) {
      setSolutionSuggestion(response.data.solutionRefinement ?? null);
      setAiMessage(response.notice || (response.source === "ai" ? "MiMo 已生成当前步骤建议。" : "已使用本地参考建议。"));
      setStageLoading(null);
    }
  }

  function applySolutionSuggestion() {
    if (!solutionSuggestion) return;
    solutionRequestRef.current += 1;
    setStageLoading(null);
    setAnswers((current) => ({
      ...current,
      [currentStep.id]: {
        ...current[currentStep.id],
        ...Object.fromEntries(solutionSuggestion.draftFields.map((item) => [item.key, item.value])),
      },
    }));
    setSolutionSuggestion(null);
  }

  function saveStepAndContinue() {
    if (!currentStep.fields.every((field) => answers[currentStep.id][field.key]?.trim())) return;
    solutionRequestRef.current += 1;
    setStageLoading(null);
    setCompletedSteps((current) => current.includes(currentStep.id) ? current : [...current, currentStep.id]);
    if (guideStep < solutionSteps.length - 1) setGuideStep((current) => current + 1);
  }

  function skipStep() {
    solutionRequestRef.current += 1;
    setStageLoading(null);
    setCompletedSteps((current) => current.includes(currentStep.id) ? current : [...current, currentStep.id]);
    if (guideStep < solutionSteps.length - 1) setGuideStep((current) => current + 1);
  }

  function resolveRisk(mitigationIndex: number) {
    redTeamInteractedRef.current = true;
    setStageLoading(null);
    const mitigation = currentRisk.mitigations[mitigationIndex];
    setResolutions((current) => ({
      ...current,
      [currentRisk.id]: { mode: "mitigation", mitigationIndex, update: mitigation.update },
    }));
    moveToNextRisk();
  }

  function acceptRisk() {
    if (riskAcceptanceReason.trim().length < 4) return;
    redTeamInteractedRef.current = true;
    setStageLoading(null);
    setResolutions((current) => ({
      ...current,
      [currentRisk.id]: { mode: "accepted", update: `用户确认接受该风险。接受原因：${riskAcceptanceReason.trim()}` },
    }));
    setRiskAcceptanceReason("");
    moveToNextRisk();
  }

  function saveCustomRiskPlan() {
    if (customRiskPlan.trim().length < 8) return;
    redTeamInteractedRef.current = true;
    setStageLoading(null);
    setResolutions((current) => ({
      ...current,
      [currentRisk.id]: { mode: "mitigation", update: customRiskPlan.trim() },
    }));
    setCustomRiskPlan("");
    setEditingCustomRisk(false);
    moveToNextRisk();
  }

  function moveToNextRisk() {
    const nextOpen = risks.findIndex((risk, index) => index > riskIndex && !resolutions[risk.id]);
    if (nextOpen >= 0) setRiskIndex(nextOpen);
  }

  function buildTasks(): ValidationTask[] {
    return roadmapDraft.milestones.flatMap((milestone, milestoneIndex) => milestone.tasks.map((task, taskIndex) => ({
      id: `${project.id}-${milestone.id}-${taskIndex + 1}`,
      projectId: project.id,
      day: task.day,
      title: `${milestone.title} · ${task.title}`,
      detail: task.detail,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      target: task.target,
      actions: task.actions,
      tools: task.tools,
      duration: task.duration,
      estimatedCost: task.estimatedCost,
      passCriteria: task.passCriteria,
      stopCriteria: task.stopCriteria,
      status: "pending" as const,
      result: "",
      evidenceIds: [],
      workflowStatus: milestoneIndex === 0 && taskIndex === 0 ? "ready" as const : "locked" as const,
    })));
  }

  async function startResearch() {
    if (stageLoading) return;
    setStageLoading("research");
    const request = buildStageRequest("research_analysis", project, { answers, selectedRoute });
    const immediate = buildFallbackCoachResponse(request, "已先显示本地资料，MiMo 正在后台检索可信来源。");
    const requestId = ++researchRequestRef.current;
    if (immediate.data.researchReport) setResearchReport(immediate.data.researchReport);
    setResearchReady(true);
    setAiMessage(immediate.notice ?? "");
    setStageLoading(null);
    const response = await requestAiCoach(request, {
      strategy: presetOnly ? "preset-only" : "live-first",
      cacheKey: `research:${project.id}:${JSON.stringify(answers)}`,
    });
    if (requestId === researchRequestRef.current) {
      if (response.data.researchReport) setResearchReport(response.data.researchReport);
      setResearchReady(true);
      setAiMessage(response.notice || (response.source === "ai" ? "MiMo 已完成联网资料分析。" : "联网不可用，已明确使用本地案例库。"));
    }
  }

  async function startRedTeam() {
    if (stageLoading) return;
    researchRequestRef.current += 1;
    setStageLoading("redteam");
    const request = buildStageRequest("red_team_analysis", project, { answers, selectedRoute, researchReport });
    const immediate = buildFallbackCoachResponse(request, "已先显示本地红队结果，MiMo 正在后台生成项目专属风险。");
    const requestId = ++redTeamRequestRef.current;
    redTeamInteractedRef.current = false;
    if (immediate.data.redTeamRisks) setRisks(immediate.data.redTeamRisks);
    setRiskIndex(0);
    setResolutions({});
    setAiMessage(immediate.notice ?? "");
    unlockAndGo(3);
    const response = await requestAiCoach(request, {
      strategy: presetOnly ? "preset-only" : "live-first",
      cacheKey: `redteam:${project.id}:${JSON.stringify(answers)}:${researchReport.searchedAt}`,
    });
    if (requestId === redTeamRequestRef.current) {
      if (!redTeamInteractedRef.current) {
        if (response.data.redTeamRisks) setRisks(response.data.redTeamRisks);
        setRiskIndex(0);
        setResolutions({});
        setAiMessage(response.notice || (response.source === "ai" ? "MiMo 已生成项目专属红队风险。" : "已使用本地红队案例。"));
      }
      setStageLoading(null);
    }
  }

  async function generateRoadmap() {
    if (stageLoading) return;
    setStageLoading("roadmap");
    const request = buildStageRequest("task_decomposition", project, {
      answers,
      selectedRoute,
      risks: risks.map((risk) => ({ id: risk.id, title: risk.title, severity: risk.severity, resolution: resolutions[risk.id]?.update })),
    });
    const immediate = buildFallbackCoachResponse(request, "已先显示本地路线地图，MiMo 正在后台生成项目专属版本。");
    const requestId = ++roadmapRequestRef.current;
    if (immediate.data.roadmapDraft) setRoadmapDraft(immediate.data.roadmapDraft);
    setAiMessage(immediate.notice ?? "");
    unlockAndGo(5);
    const response = await requestAiCoach(request, {
      strategy: presetOnly ? "preset-only" : "live-first",
      cacheKey: `roadmap:${project.id}:${JSON.stringify(resolutions)}`,
    });
    if (requestId === roadmapRequestRef.current) {
      if (response.data.roadmapDraft) setRoadmapDraft(response.data.roadmapDraft);
      setAiMessage(response.notice || (response.source === "ai" ? "MiMo 已生成执行路线地图。" : "已使用本地执行路线。"));
      setStageLoading(null);
    }
  }

  function enterTasks() {
    roadmapRequestRef.current += 1;
    onEnterTasks(buildTasks());
  }

  return (
    <div className="gateChallengeScreen decisionJourney">
      <header className="decisionHero">
        <div>
          <span>路口决策</span>
          <h1>把选择的路径，写成你自己的方案。</h1>
          <p>AI负责提问、检索摘要和压力测试；方案由你确认，风险由你决定是否接受。</p>
        </div>
        <article>
          <small>已选择路径</small>
          <strong>{selectedRoute.action || "轻量级 SaaS 工具路线"}</strong>
          <p>{selectedRoute.audience || project.targetUser}</p>
        </article>
      </header>

      <nav className="decisionStageNav" aria-label="路口决策阶段导览">
        {decisionStages.map((stage, index) => {
          const complete = index < stageIndex || index < unlockedStage;
          const locked = index > unlockedStage;
          return (
            <button
              key={stage.id}
              className={`${index === stageIndex ? "active" : ""} ${complete ? "complete" : ""}`}
              type="button"
              disabled={locked}
              onClick={() => goToStage(index)}
              title={locked ? "请先完成前一阶段" : stage.label}
            >
              <i>{locked ? <LockKeyhole size={14} /> : complete ? <Check size={15} /> : index + 1}</i>
              <span>{stage.label}</span>
              {index < decisionStages.length - 1 ? <ChevronRight className="stageArrow" size={15} /> : null}
            </button>
          );
        })}
      </nav>

      {stageIndex === 0 ? (
        <section className="decisionPanel solutionGuidePanel">
          <header className="decisionSectionHeader">
            <div><span>第一阶段</span><h2>我不会直接给你方案，我来引导你一步一步写出来。</h2></div>
            <strong>{completedSteps.length}/5 步</strong>
          </header>

          <div className="guideStepNav" aria-label="方案框架步骤">
            {solutionSteps.map((step, index) => (
              <button key={step.id} className={index === guideStep ? "active" : completedSteps.includes(step.id) ? "complete" : ""} type="button" onClick={() => setGuideStep(index)}>
                <i>{completedSteps.includes(step.id) ? <Check size={13} /> : index + 1}</i>
                <span><small>{step.shortLabel}</small><strong>{step.title}</strong></span>
              </button>
            ))}
          </div>

          <article className="solutionStepCard">
            <header>
              <div><PencilLine size={21} /><span>你的方案框架 · 第{guideStep + 1}步</span></div>
              <strong>{currentStep.title}</strong>
              <p>{currentStep.question}</p>
            </header>
            <div className="solutionFormGrid">
              {currentStep.fields.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  {field.key === "severity" ? (
                    <input value={answers[currentStep.id][field.key] ?? ""} onChange={(event) => updateAnswer(currentStep.id, field.key, event.target.value)} placeholder={field.placeholder} />
                  ) : (
                    <textarea value={answers[currentStep.id][field.key] ?? ""} onChange={(event) => updateAnswer(currentStep.id, field.key, event.target.value)} placeholder={field.placeholder} />
                  )}
                </label>
              ))}
            </div>
            <aside className="aiReferenceHint"><Lightbulb size={18} /><div><strong>AI提示（参考）</strong><p>{currentStep.hint}</p></div></aside>
            {solutionSuggestion ? <aside className="aiReferenceHint"><Sparkles size={18} /><div><strong>AI发现的缺口</strong><p>{solutionSuggestion.gaps.join("；")}</p><small>{solutionSuggestion.rationale}</small><div><button className="ghostButton" type="button" onClick={() => setSolutionSuggestion(null)}>不采用</button><button className="primaryButton" type="button" onClick={applySolutionSuggestion}>确认采用参考改写</button></div></div></aside> : null}
            {aiMessage ? <p className="aiStageMessage">{aiMessage}</p> : null}
            <footer>
              <div>
                <button className="ghostButton" type="button" onClick={skipStep}>跳过这步</button>
                <button className="aiAssistButton" type="button" disabled={stageLoading === "solution"} onClick={improveCurrentStep}><Sparkles size={15} />{stageLoading === "solution" ? "正在分析当前步骤…" : "让AI帮我完善"}</button>
              </div>
              <div>
                <button className="ghostButton" type="button" disabled={guideStep === 0} onClick={() => setGuideStep((current) => current - 1)}><ArrowLeft size={15} />上一步</button>
                <button className="primaryButton" type="button" onClick={saveStepAndContinue} disabled={!currentStep.fields.every((field) => answers[currentStep.id][field.key]?.trim())}>
                  {guideStep === solutionSteps.length - 1 ? "保存这一步" : "保存并进入下一步"}<ArrowRight size={15} />
                </button>
              </div>
            </footer>
          </article>

          <div className="decisionBottomAction">
            <p>五个步骤必须依次确认；比赛演示可使用“让AI帮我完善”载入预设答案。</p>
            <button className="primaryButton" type="button" disabled={completedSteps.length < 5} onClick={() => unlockAndGo(1)}>完成方案框架<ArrowRight size={16} /></button>
          </div>
        </section>
      ) : null}

      {stageIndex === 1 ? (
        <section className="decisionPanel solutionSummaryPanel">
          <header className="decisionSectionHeader"><div><span>第二阶段</span><h2>确认你的完整方案。</h2><p>红队压力测试将以这个版本为起点。</p></div></header>
          <div className="solutionSummaryList">
            {solutionSteps.map((step, index) => (
              <article key={step.id}>
                <div className="summaryIndex">{String(index + 1).padStart(2, "0")}</div>
                <div><small>{step.shortLabel}</small><h3>{step.title}</h3><dl>{step.fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{answers[step.id][field.key] || "暂未填写"}</dd></div>)}</dl></div>
                <button type="button" onClick={() => { setGuideStep(index); goToStage(0); }}><PencilLine size={14} />修改{step.title}</button>
              </article>
            ))}
          </div>
          <div className="decisionBottomAction"><button className="ghostButton" type="button" onClick={() => goToStage(0)}><ArrowLeft size={15} />返回继续修改</button><button className="primaryButton" type="button" onClick={() => unlockAndGo(2)}>确认方案并开始分析<ArrowRight size={16} /></button></div>
        </section>
      ) : null}

      {stageIndex === 2 ? (
        <section className="decisionPanel researchPanel">
          <header className="decisionSectionHeader"><div><span>第三阶段</span><h2>联网检索与资料收集。</h2><p>市场、竞品、趋势、用户反馈和政策信息将作为红队测试依据。</p></div><FileSearch size={30} /></header>
          <aside className="presetDisclosure"><CircleAlert size={17} /><p><strong>{researchReport.items.some((item) => item.sources.length) ? "MiMo 联网资料" : "本地案例库"}</strong>{researchReport.items.some((item) => item.sources.length) ? "以下内容保留来源和发布日期，仍需结合项目自己的用户证据判断。" : "当前没有可核验联网来源，以下内容不能冒充实时市场调研。"}</p></aside>
          {!researchReady ? (
            <div className="researchStartState"><Search size={38} /><h3>准备检索真实世界信息</h3><p>非预设项目将调用 MiMo 联网搜索；比赛预设直接读取稳定案例，避免现场等待。</p><button className="primaryButton" type="button" disabled={stageLoading === "research"} onClick={startResearch}><Search size={16} />{stageLoading === "research" ? "正在联网检索…" : "开始资料分析"}</button></div>
          ) : (
            <div className="researchResults">
              {researchReport.items.map((item) => <article key={item.id}><header><CheckCircle2 size={17} /><span>{item.label}</span></header><h3>{item.title}</h3><p>{item.summary}</p><ul>{item.findings.map((finding) => <li key={finding}>{finding}</li>)}</ul>{item.sources.length ? <div className="researchSources">{item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}</strong><small>{source.sourceType} · {source.publishedAt}</small></a>)}</div> : <small>本地案例，无实时来源</small>}</article>)}
            </div>
          )}
          {researchReady && (researchReport.conflicts.length || researchReport.gaps.length) ? <aside className="presetDisclosure"><CircleAlert size={17} /><p><strong>资料边界</strong>{[...researchReport.conflicts, ...researchReport.gaps].join("；")}</p></aside> : null}
          <div className="decisionBottomAction"><button className="ghostButton" type="button" onClick={() => goToStage(1)}><ArrowLeft size={15} />返回方案确认</button><button className="primaryButton" type="button" disabled={!researchReady || stageLoading === "research" || stageLoading === "redteam"} onClick={startRedTeam}>{stageLoading === "research" ? "MiMo 正在后台更新资料…" : stageLoading === "redteam" ? "正在生成项目专属风险…" : "确认资料并启动红队测试"}<ShieldAlert size={16} /></button></div>
        </section>
      ) : null}

      {stageIndex === 3 ? (
        <section className="decisionPanel redTeamTestPanel">
          <header className="redTeamLaunch"><div><ShieldAlert size={28} /><span>红队压力测试启动</span></div><h2>现在，我要扮演你的“魔鬼代言人”。</h2><p>我会想尽办法找出方案里的漏洞，并为每个风险提供可以执行的缓解方案。</p></header>
          <div className="riskProgress"><div><strong>{resolvedCount}<small>/{risks.length}</small></strong><span>已处理风险</span></div><div><strong>{highRiskOpen}</strong><span>未处理高危</span></div><ol>{risks.map((risk, index) => <li key={risk.id} className={`${index === riskIndex ? "active" : ""} ${resolutions[risk.id] ? "complete" : ""}`}><button type="button" onClick={() => setRiskIndex(index)}>{resolutions[risk.id] ? <Check size={12} /> : index + 1}</button></li>)}</ol></div>

          <article className={`riskCard severity-${currentRisk.severity}`}>
            <header><div><span>风险点 {riskIndex + 1}/{risks.length} · {currentRisk.dimension}</span><h3>{currentRisk.title}</h3></div><strong>{currentRisk.severity}</strong></header>
            <div className="riskFinding"><Search size={19} /><div><span>发现的问题</span><p>{currentRisk.problem}</p><small>{currentRisk.evidence}</small></div></div>
            <div className="riskImpact"><CircleAlert size={18} /><div><span>风险影响</span><p>{currentRisk.impact}</p></div></div>
            <div className="mitigationSection"><h4>推荐缓解方案（请选择或自行提出）</h4><div className="mitigationGrid">{currentRisk.mitigations.map((option, index) => <article key={option.title}><span>方案 {index + 1}</span><h5>{option.title}</h5><p>{option.description}</p><dl><div><dt>成本</dt><dd>{option.cost}</dd></div><div><dt>验证周期</dt><dd>{option.duration}</dd></div><div><dt>可信度</dt><dd>{option.credibility}</dd></div></dl><button type="button" onClick={() => resolveRisk(index)}>选择方案{index + 1}</button></article>)}</div></div>
            {editingCustomRisk ? <div className="customRiskComposer"><textarea value={customRiskPlan} onChange={(event) => setCustomRiskPlan(event.target.value)} placeholder="写出你准备如何降低这个风险，以及用什么结果判断是否有效。" autoFocus /><div><button type="button" onClick={() => setEditingCustomRisk(false)}>取消</button><button className="primaryButton" type="button" disabled={customRiskPlan.trim().length < 8} onClick={saveCustomRiskPlan}>保存我的方案</button></div></div> : null}
            <label className="riskAcceptanceReason"><span>如果选择接受风险，请记录原因</span><input value={riskAcceptanceReason} onChange={(event) => setRiskAcceptanceReason(event.target.value)} placeholder="例如：当前只做5人测试，损失可控，先观察上传率" /></label>
            <footer><div><button type="button" onClick={() => setEditingCustomRisk(true)}>我想自己写一个方案</button><button type="button" disabled={riskAcceptanceReason.trim().length < 4} onClick={acceptRisk}>这个风险我接受</button></div><div><button type="button" disabled={riskIndex === 0} onClick={() => setRiskIndex((current) => current - 1)}><ArrowLeft size={14} />上一个</button><button type="button" disabled={riskIndex === risks.length - 1} onClick={() => setRiskIndex((current) => current + 1)}>下一个<ArrowRight size={14} /></button></div></footer>
          </article>
          <div className="decisionBottomAction"><p>完成标准：所有风险均由用户选择方案或明确接受；AI不能自行宣布安全。</p><button className="primaryButton" type="button" disabled={resolvedCount < risks.length} onClick={() => unlockAndGo(4)}>完成压力测试<ArrowRight size={16} /></button></div>
        </section>
      ) : null}

      {stageIndex === 4 ? (
        <section className="decisionPanel testResultPanel">
          <header className="decisionSectionHeader"><div><span>第五阶段</span><h2>压力测试结论。</h2><p>当前方案适合小范围验证，不建议立即投入完整产品开发。</p></div><CheckCircle2 size={34} /></header>
          <div className="resultScoreboard"><article><strong>{risks.length}</strong><span>测试风险</span></article><article><strong>{Object.values(resolutions).filter((item) => item.mode === "mitigation").length}</strong><span>已制定缓解方案</span></article><article><strong>{Object.values(resolutions).filter((item) => item.mode === "accepted").length}</strong><span>用户接受风险</span></article><article><strong>≤5</strong><span>最多测试轮数</span></article></div>
          <article className="resultDecision"><span>红队建议</span><h3>先小范围验证</h3><p>已有可点击Demo和首批试用资源，可以验证需求；但用户上传意愿、换衣可信度和付费行为仍缺少真实证据。</p><ul><li>先完成5次目标用户访谈</li><li>验证照片上传率和换衣结果决策帮助度</li><li>比较个人付费和服装店合作意愿</li></ul></article>
          <div className="resolutionLedger"><h3>方案更新记录</h3>{risks.map((risk) => <article key={risk.id}><div><span>{risk.dimension}</span><strong>{risk.title}</strong></div><p>{resolutions[risk.id]?.update}</p><em>{resolutions[risk.id]?.mode === "accepted" ? "风险已接受" : "方案已更新"}</em></article>)}</div>
          <label className="resultConfirmation"><input type="checkbox" checked={acceptedResult} onChange={(event) => setAcceptedResult(event.target.checked)} /><span><strong>我确认压力测试已完成</strong><small>我理解这些结论仍需要通过真实用户行为验证。</small></span></label>
          <div className="decisionBottomAction"><button className="ghostButton" type="button" onClick={() => goToStage(3)}><ArrowLeft size={15} />返回处理风险</button><button className="primaryButton" type="button" disabled={!acceptedResult || stageLoading === "roadmap"} onClick={generateRoadmap}>{stageLoading === "roadmap" ? "正在生成执行任务…" : "确认并绘制路线地图"}<MapPinned size={16} /></button></div>
        </section>
      ) : null}

      {stageIndex === 5 ? (
        <section className="decisionPanel roadmapDecisionPanel">
          <header className="roadmapSuccess"><Rocket size={31} /><div><span>地图已画好，准备出发</span><h2>你已经拥有一个经过压力测试的执行方案。</h2></div></header>
          <div className="roadmapOverview"><article><small>你的项目</small><strong>{project.name}</strong></article><article><small>经过压力测试</small><strong>{risks.length} 个风险点</strong></article><article><small>任务原则</small><strong>先外部行动</strong></article><article><small>关键里程碑</small><strong>{roadmapDraft.milestones.length} 个</strong></article></div>
          <section className="commercialPathMap" aria-label="商业化落地路径地图">
            <header><Flag size={19} /><div><span>商业化落地路径地图</span><p>从需求证据开始，不把开发完整产品当作起点。</p></div></header>
            <div className="milestonePath">{roadmapDraft.milestones.map((milestone, index) => <article key={milestone.id}><div className="milestoneNumber">M{index + 1}</div><div><span>{milestone.duration}</span><h3>{milestone.title}</h3><p>{milestone.goal}</p><ul>{milestone.tasks.map((task) => <li key={`${task.day}-${task.title}`}>{task.title}</li>)}</ul><dl><div><dt>成功标准</dt><dd>{milestone.success}</dd></div><div><dt>主要风险</dt><dd>{milestone.risk}</dd></div><div><dt>停止条件</dt><dd>{milestone.stop}</dd></div></dl></div>{index < roadmapDraft.milestones.length - 1 ? <ArrowRight className="milestoneArrow" size={21} /> : null}</article>)}</div>
            <footer><span>当前进度：0%</span><i><b /></i><strong>已处理风险：{resolvedCount}/{risks.length}</strong></footer>
          </section>
          <div className="decisionBottomAction"><button className="ghostButton" type="button" onClick={() => goToStage(4)}><ArrowLeft size={15} />再修改一下</button><button className="primaryButton" type="button" onClick={enterTasks}>立即出发，进入任务执行<Rocket size={16} /></button></div>
        </section>
      ) : null}
    </div>
  );
}

function buildStageRequest(mode: AiCoachRequest["mode"], project: Project, stageContext: Record<string, unknown>): AiCoachRequest {
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
    evidence: { interviewCount: 0, activeInterestCount: 0, trialCount: 0, paymentCount: 0, hasRetention: false },
    stageContext,
  };
}

function fallbackResearchReport(): ResearchReport {
  return {
    items: researchPresets.map((item) => ({ ...item, id: item.id as ResearchReport["items"][number]["id"], sources: [] })),
    conflicts: [],
    gaps: ["本地案例库没有可点击实时来源"],
    searchedAt: "未联网｜本地案例库",
  };
}

function fallbackRisks(): DynamicRisk[] {
  return riskPresets.slice(0, 3).map((risk) => ({
    ...risk,
    dimension: risk.dimension as DynamicRisk["dimension"],
    mitigations: risk.mitigations.map((item) => ({
      ...item,
      validationAction: item.description,
      credibilityBasis: item.credibility === "高" ? "能产生可复核的外部行为结果" : "能缩小不确定性，仍需后续验证",
    })),
  }));
}

function fallbackRoadmapDraft(project: Project): RoadmapDraft {
  let day = 1;
  return {
    milestones: roadmapPresets.map((milestone) => ({
      ...milestone,
      tasks: milestone.tasks.map((title, taskIndex) => ({
        day: day++,
        title,
        detail: `面向${project.targetUser || "目标用户"}完成“${title}”，记录实际行为和拒绝原因。`,
        target: milestone.goal,
        actions: buildTaskActions(milestone.id, taskIndex),
        tools: buildTaskTools(milestone.id),
        duration: milestone.duration,
        estimatedCost: milestone.id === "m4" ? "≤ ¥100" : "¥0（使用免费工具）",
        evidenceMethod: "上传截图或文件，并填写实际行为、数量和用户原话",
        passCriteria: milestone.success,
        stopCriteria: milestone.stop,
      })),
    })),
  };
}

function emptySolutionAnswers(project: Project): SolutionAnswers {
  return {
    who: { demographic: project.targetUser, psychographic: "", behavior: "", portrait: "" },
    what: { pain: project.painPoint, severity: "", alternative: project.alternative, shortage: "" },
    why: { solution: project.description, difference: "", benefit: "", proposition: "" },
    how: { charge: project.monetization, pricing: "", cost: "", profit: "" },
    when: { mvp: project.existingArtifact, milestone: "", resource: "", timeline: "" },
  };
}

function buildTaskActions(milestoneId: string, taskIndex: number) {
  const actions: Record<string, string[][]> = {
    m1: [
      ["列出5位经常网购服装、担心上身效果的目标用户", "使用访谈提纲完成15分钟问题访谈", "记录用户原话、现有替代方案和是否愿意继续体验"],
      ["向20位目标用户展示照片授权说明", "询问是否愿意上传照片体验换衣Demo", "统计愿意、拒绝和犹豫人数并记录原因"],
    ],
    m2: [
      ["把Demo限定为正面半身照和上装", "准备3组可稳定演示的商品图片", "记录生成失败和明显失真的情况"],
      ["邀请5位目标用户使用真实商品完成换衣体验", "让用户先看商品图再看换衣结果", "记录结果是否改变购买判断"],
    ],
    m3: [
      ["制作3条真实商品试穿前后对比内容", "发布到朋友圈或穿搭社群", "记录主动评论、私信和试用请求"],
      ["邀请10位目标用户完成一次完整体验", "记录完成、放弃和拒绝的人数", "询问是否愿意留下联系方式继续试用"],
    ],
    m4: [
      ["向完成体验的用户展示9.9元继续使用选项", "记录接受、拒绝和犹豫原因", "不使用口头好评代替付款或预订行为"],
      ["找到5家有私域顾客的服装店", "演示换衣工具并询问合作方式", "记录是否愿意试用、接受报价或约下一次沟通"],
    ],
  };
  return actions[milestoneId]?.[taskIndex] ?? ["完成任务要求", "记录真实外部行为", "按成功标准整理证据"];
}

function buildTaskTools(milestoneId: string) {
  const common = [
    { title: "用户访谈提纲", content: "先问最近一次网购服装经历，再问当时如何判断上身效果、哪里最不确定、最后如何处理。不要先介绍产品。" },
    { title: "访谈记录模板", content: "对象｜最近一次行为｜用户原话｜现有替代方案｜是否愿意体验｜下一步行动。" },
  ];
  if (milestoneId === "m1") return [...common, { title: "照片上传意愿问卷", content: "愿意上传吗？最担心什么？什么授权说明会让你更放心？愿意现场上传还是远程上传？" }];
  if (milestoneId === "m2") return [{ title: "Demo体验观察表", content: "上传是否完成｜生成耗时｜明显错误｜是否帮助判断｜是否愿意再次使用。" }, ...common];
  if (milestoneId === "m3") return [{ title: "内容发布模板", content: "真实商品图 + 换衣前后对比 + 明确邀请：回复“试穿”获得一次体验。" }, { title: "种子用户登记表", content: "来源｜是否完成体验｜主动反馈｜联系方式｜愿意继续的原因。" }];
  return [{ title: "付费意愿记录表", content: "报价｜用户反应｜是否付款/预订｜拒绝原因｜可接受价格。" }, { title: "服装店合作访谈提纲", content: "现有顾客试穿流程｜退货问题｜是否愿意试用｜可以接受的合作方式和预算。" }];
}
