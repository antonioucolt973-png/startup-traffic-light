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
import { useMemo, useState } from "react";
import {
  buildSolutionPreset,
  researchPresets,
  riskPresets,
  roadmapPresets,
  solutionSteps,
  type SolutionField,
} from "../data/intersectionDecisionPresets";
import type { GateActionPlan, Project, ValidationTask } from "../types";

interface GateChallengeProps {
  project: Project;
  selectedRoute: GateActionPlan;
  onEnterTasks: (tasks: ValidationTask[]) => void;
}

type DecisionStage = "guide" | "summary" | "research" | "redteam" | "result" | "roadmap";
type SolutionAnswers = Record<SolutionField, Record<string, string>>;
type RiskResolution = { mode: "mitigation" | "accepted"; mitigationIndex?: number; update: string };

const decisionStages: Array<{ id: DecisionStage; label: string }> = [
  { id: "guide", label: "方案引导" },
  { id: "summary", label: "方案确认" },
  { id: "research", label: "资料分析" },
  { id: "redteam", label: "红队测试" },
  { id: "result", label: "测试结论" },
  { id: "roadmap", label: "路线地图" },
];

export function GateChallenge({ project, selectedRoute, onEnterTasks }: GateChallengeProps) {
  const preset = useMemo(() => buildSolutionPreset(project), [project]);
  const [stageIndex, setStageIndex] = useState(0);
  const [unlockedStage, setUnlockedStage] = useState(0);
  const [guideStep, setGuideStep] = useState(0);
  const [answers, setAnswers] = useState<SolutionAnswers>(() => emptySolutionAnswers(project));
  const [completedSteps, setCompletedSteps] = useState<SolutionField[]>([]);
  const [researchReady, setResearchReady] = useState(false);
  const [riskIndex, setRiskIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Record<string, RiskResolution>>({});
  const [customRiskPlan, setCustomRiskPlan] = useState("");
  const [editingCustomRisk, setEditingCustomRisk] = useState(false);
  const [acceptedResult, setAcceptedResult] = useState(false);

  const currentStep = solutionSteps[guideStep];
  const currentRisk = riskPresets[riskIndex];
  const resolvedCount = Object.keys(resolutions).length;
  const highRiskOpen = riskPresets.filter((risk) => risk.severity === "高危" && !resolutions[risk.id]).length;

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

  function improveCurrentStep() {
    setAnswers((current) => ({ ...current, [currentStep.id]: { ...preset[currentStep.id] } }));
  }

  function saveStepAndContinue() {
    if (!currentStep.fields.every((field) => answers[currentStep.id][field.key]?.trim())) return;
    setCompletedSteps((current) => current.includes(currentStep.id) ? current : [...current, currentStep.id]);
    if (guideStep < solutionSteps.length - 1) setGuideStep((current) => current + 1);
  }

  function skipStep() {
    setCompletedSteps((current) => current.includes(currentStep.id) ? current : [...current, currentStep.id]);
    if (guideStep < solutionSteps.length - 1) setGuideStep((current) => current + 1);
  }

  function resolveRisk(mitigationIndex: number) {
    const mitigation = currentRisk.mitigations[mitigationIndex];
    setResolutions((current) => ({
      ...current,
      [currentRisk.id]: { mode: "mitigation", mitigationIndex, update: mitigation.update },
    }));
    moveToNextRisk();
  }

  function acceptRisk() {
    setResolutions((current) => ({
      ...current,
      [currentRisk.id]: { mode: "accepted", update: "用户确认接受该风险，并将在执行阶段持续观察。" },
    }));
    moveToNextRisk();
  }

  function saveCustomRiskPlan() {
    if (customRiskPlan.trim().length < 8) return;
    setResolutions((current) => ({
      ...current,
      [currentRisk.id]: { mode: "mitigation", update: customRiskPlan.trim() },
    }));
    setCustomRiskPlan("");
    setEditingCustomRisk(false);
    moveToNextRisk();
  }

  function moveToNextRisk() {
    const nextOpen = riskPresets.findIndex((risk, index) => index > riskIndex && !resolutions[risk.id]);
    if (nextOpen >= 0) setRiskIndex(nextOpen);
  }

  function buildTasks(): ValidationTask[] {
    return roadmapPresets.flatMap((milestone, milestoneIndex) => milestone.tasks.map((detail, taskIndex) => ({
      id: `${project.id}-${milestone.id}-${taskIndex + 1}`,
      projectId: project.id,
      day: milestoneIndex * 2 + taskIndex + 1,
      title: `${milestone.title} · ${detail}`,
      detail,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      target: milestone.goal,
      actions: buildTaskActions(milestone.id, taskIndex),
      tools: buildTaskTools(milestone.id),
      duration: milestone.duration,
      estimatedCost: milestone.id === "m4" ? "≤ ¥100" : "¥0（使用免费工具）",
      passCriteria: milestone.success,
      stopCriteria: milestone.stop,
      status: "pending" as const,
      result: "",
      evidenceIds: [],
      workflowStatus: milestoneIndex === 0 && taskIndex === 0 ? "ready" as const : "locked" as const,
    })));
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
            <footer>
              <div>
                <button className="ghostButton" type="button" onClick={skipStep}>跳过这步</button>
                <button className="aiAssistButton" type="button" onClick={improveCurrentStep}><Sparkles size={15} />让AI帮我完善</button>
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
          <aside className="presetDisclosure"><CircleAlert size={17} /><p><strong>比赛预设资料分析</strong>当前未连接外部大模型和实时搜索，以下结果由本地案例库稳定生成，不能替代真实市场调研。</p></aside>
          {!researchReady ? (
            <div className="researchStartState"><Search size={38} /><h3>准备检索真实世界信息</h3><p>商业化版本将在这里连接搜索与大模型；比赛版本使用同结构预设数据。</p><button className="primaryButton" type="button" onClick={() => setResearchReady(true)}><Search size={16} />开始资料分析</button></div>
          ) : (
            <div className="researchResults">
              {researchPresets.map((item) => <article key={item.id}><header><CheckCircle2 size={17} /><span>{item.label}</span></header><h3>{item.title}</h3><p>{item.summary}</p><ul>{item.findings.map((finding) => <li key={finding}>{finding}</li>)}</ul></article>)}
            </div>
          )}
          <div className="decisionBottomAction"><button className="ghostButton" type="button" onClick={() => goToStage(1)}><ArrowLeft size={15} />返回方案确认</button><button className="primaryButton" type="button" disabled={!researchReady} onClick={() => unlockAndGo(3)}>确认资料并启动红队测试<ShieldAlert size={16} /></button></div>
        </section>
      ) : null}

      {stageIndex === 3 ? (
        <section className="decisionPanel redTeamTestPanel">
          <header className="redTeamLaunch"><div><ShieldAlert size={28} /><span>红队压力测试启动</span></div><h2>现在，我要扮演你的“魔鬼代言人”。</h2><p>我会想尽办法找出方案里的漏洞，并为每个风险提供可以执行的缓解方案。</p></header>
          <div className="riskProgress"><div><strong>{resolvedCount}<small>/{riskPresets.length}</small></strong><span>已处理风险</span></div><div><strong>{highRiskOpen}</strong><span>未处理高危</span></div><ol>{riskPresets.map((risk, index) => <li key={risk.id} className={`${index === riskIndex ? "active" : ""} ${resolutions[risk.id] ? "complete" : ""}`}><button type="button" onClick={() => setRiskIndex(index)}>{resolutions[risk.id] ? <Check size={12} /> : index + 1}</button></li>)}</ol></div>

          <article className={`riskCard severity-${currentRisk.severity}`}>
            <header><div><span>风险点 {riskIndex + 1}/{riskPresets.length} · {currentRisk.dimension}</span><h3>{currentRisk.title}</h3></div><strong>{currentRisk.severity}</strong></header>
            <div className="riskFinding"><Search size={19} /><div><span>发现的问题</span><p>{currentRisk.problem}</p><small>{currentRisk.evidence}</small></div></div>
            <div className="riskImpact"><CircleAlert size={18} /><div><span>风险影响</span><p>{currentRisk.impact}</p></div></div>
            <div className="mitigationSection"><h4>推荐缓解方案（请选择或自行提出）</h4><div className="mitigationGrid">{currentRisk.mitigations.map((option, index) => <article key={option.title}><span>方案 {index + 1}</span><h5>{option.title}</h5><p>{option.description}</p><dl><div><dt>成本</dt><dd>{option.cost}</dd></div><div><dt>验证周期</dt><dd>{option.duration}</dd></div><div><dt>可信度</dt><dd>{option.credibility}</dd></div></dl><button type="button" onClick={() => resolveRisk(index)}>选择方案{index + 1}</button></article>)}</div></div>
            {editingCustomRisk ? <div className="customRiskComposer"><textarea value={customRiskPlan} onChange={(event) => setCustomRiskPlan(event.target.value)} placeholder="写出你准备如何降低这个风险，以及用什么结果判断是否有效。" autoFocus /><div><button type="button" onClick={() => setEditingCustomRisk(false)}>取消</button><button className="primaryButton" type="button" disabled={customRiskPlan.trim().length < 8} onClick={saveCustomRiskPlan}>保存我的方案</button></div></div> : null}
            <footer><div><button type="button" onClick={() => setEditingCustomRisk(true)}>我想自己写一个方案</button><button type="button" onClick={acceptRisk}>这个风险我接受</button></div><div><button type="button" disabled={riskIndex === 0} onClick={() => setRiskIndex((current) => current - 1)}><ArrowLeft size={14} />上一个</button><button type="button" disabled={riskIndex === riskPresets.length - 1} onClick={() => setRiskIndex((current) => current + 1)}>下一个<ArrowRight size={14} /></button></div></footer>
          </article>
          <div className="decisionBottomAction"><p>完成标准：所有高风险已处理，中风险已选择方案或由用户明确接受。</p><button className="primaryButton" type="button" disabled={resolvedCount < riskPresets.length} onClick={() => unlockAndGo(4)}>完成压力测试<ArrowRight size={16} /></button></div>
        </section>
      ) : null}

      {stageIndex === 4 ? (
        <section className="decisionPanel testResultPanel">
          <header className="decisionSectionHeader"><div><span>第五阶段</span><h2>压力测试结论。</h2><p>当前方案适合小范围验证，不建议立即投入完整产品开发。</p></div><CheckCircle2 size={34} /></header>
          <div className="resultScoreboard"><article><strong>{riskPresets.length}</strong><span>测试风险</span></article><article><strong>{Object.values(resolutions).filter((item) => item.mode === "mitigation").length}</strong><span>已制定缓解方案</span></article><article><strong>{Object.values(resolutions).filter((item) => item.mode === "accepted").length}</strong><span>用户接受风险</span></article><article><strong>2</strong><span>预设测试轮数</span></article></div>
          <article className="resultDecision"><span>红队建议</span><h3>先小范围验证</h3><p>已有可点击Demo和首批试用资源，可以验证需求；但用户上传意愿、换衣可信度和付费行为仍缺少真实证据。</p><ul><li>先完成5次目标用户访谈</li><li>验证照片上传率和换衣结果决策帮助度</li><li>比较个人付费和服装店合作意愿</li></ul></article>
          <div className="resolutionLedger"><h3>方案更新记录</h3>{riskPresets.map((risk) => <article key={risk.id}><div><span>{risk.dimension}</span><strong>{risk.title}</strong></div><p>{resolutions[risk.id]?.update}</p><em>{resolutions[risk.id]?.mode === "accepted" ? "风险已接受" : "方案已更新"}</em></article>)}</div>
          <label className="resultConfirmation"><input type="checkbox" checked={acceptedResult} onChange={(event) => setAcceptedResult(event.target.checked)} /><span><strong>我确认压力测试已完成</strong><small>我理解这些结论仍需要通过真实用户行为验证。</small></span></label>
          <div className="decisionBottomAction"><button className="ghostButton" type="button" onClick={() => goToStage(3)}><ArrowLeft size={15} />返回处理风险</button><button className="primaryButton" type="button" disabled={!acceptedResult} onClick={() => unlockAndGo(5)}>确认并绘制路线地图<MapPinned size={16} /></button></div>
        </section>
      ) : null}

      {stageIndex === 5 ? (
        <section className="decisionPanel roadmapDecisionPanel">
          <header className="roadmapSuccess"><Rocket size={31} /><div><span>地图已画好，准备出发</span><h2>你已经拥有一个经过压力测试的执行方案。</h2></div></header>
          <div className="roadmapOverview"><article><small>你的项目</small><strong>{project.name}</strong></article><article><small>经过压力测试</small><strong>{riskPresets.length} 个风险点</strong></article><article><small>预计周期</small><strong>4 周</strong></article><article><small>关键里程碑</small><strong>{roadmapPresets.length} 个</strong></article></div>
          <section className="commercialPathMap" aria-label="商业化落地路径地图">
            <header><Flag size={19} /><div><span>商业化落地路径地图</span><p>从需求证据开始，不把开发完整产品当作起点。</p></div></header>
            <div className="milestonePath">{roadmapPresets.map((milestone, index) => <article key={milestone.id}><div className="milestoneNumber">M{index + 1}</div><div><span>{milestone.duration}</span><h3>{milestone.title}</h3><p>{milestone.goal}</p><ul>{milestone.tasks.map((task) => <li key={task}>{task}</li>)}</ul><dl><div><dt>成功标准</dt><dd>{milestone.success}</dd></div><div><dt>主要风险</dt><dd>{milestone.risk}</dd></div><div><dt>停止条件</dt><dd>{milestone.stop}</dd></div></dl></div>{index < roadmapPresets.length - 1 ? <ArrowRight className="milestoneArrow" size={21} /> : null}</article>)}</div>
            <footer><span>当前进度：0%</span><i><b /></i><strong>已处理风险：{resolvedCount}/{riskPresets.length}</strong></footer>
          </section>
          <div className="decisionBottomAction"><button className="ghostButton" type="button" onClick={() => goToStage(4)}><ArrowLeft size={15} />再修改一下</button><button className="primaryButton" type="button" onClick={() => onEnterTasks(buildTasks())}>立即出发，进入任务执行<Rocket size={16} /></button></div>
        </section>
      ) : null}
    </div>
  );
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
