import { BrainCircuit, Check, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isCompetitionPresetIdea } from "../data/competitionPreset";
import { requestAiCoach } from "../lib/aiClient";
import { buildFallbackCoachResponse } from "../lib/aiFallback";
import type { AiCoachData, AiCoachRequest } from "../lib/aiSchemas";
import type { Project } from "../types";

export interface InitialValidationRoute {
  title: string;
  rationale: string;
  audience: string;
  action: string;
  deadline: string;
  passCriteria: string;
  stopCriteria: string;
  suitability: string;
  estimatedCost: string;
  difficulty: string;
}

interface BusinessRoute extends InitialValidationRoute {
  market: { tam: string; sam: string; som: string; growth: string };
  business: { model: string; arr: string; breakEven: string };
  keySuccessFactors: string[];
  landingCycle: string;
  validationStatus: string;
  detailedBreakdown: string[];
}

interface RouteOverviewProps {
  project: Project;
  initialProject: Project | null;
  onBack: () => void;
  onConfirmRoute: (route: InitialValidationRoute) => void;
}

function buildPresetBusinessRoutes(project: Project, version: number): BusinessRoute[] {
  const user = project.targetUser || "目标用户";
  const product = project.name || "该项目";
  const routeNames = [
    ["轻量级 SaaS 工具路线", "B2B 店铺诊断服务路线", "消费者单次体验路线"],
    ["内容获客验证路线", "品牌合作试点路线", "人工 Concierge 验证路线"],
    ["垂直场景工具路线", "高意向门店共创路线", "预售验证路线"],
  ][Math.min(version, 2)];

  return [
    {
      title: routeNames[0],
      rationale: "先用低成本产品形态验证高频场景和主动使用意愿。",
      suitability: "适合已有 Demo、页面或可用人工流程的项目。",
      audience: `首批 30 位 ${user}`,
      action: `用 ${product} 的最小版本完成试用，记录一次完整任务是否成功。`,
      deadline: "2–3 周",
      passCriteria: "至少 10 人完成试用，其中 3 人愿意留下联系方式或预约下一步。",
      stopCriteria: "连续两轮试用仍无人完成关键动作时，收缩功能或重定义场景。",
      estimatedCost: "预计成本：≤300 元",
      difficulty: "★★☆☆☆",
      market: { tam: "本阶段未联网，不提供确定性数字", sam: "本阶段未联网，不提供确定性数字", som: "以首批30位用户作为验证样本", growth: "本阶段未联网，不提供确定性数字" },
      business: { model: "免费试用 + 订阅假设（待验证）", arr: "无真实交易数据，不计算ARR", breakEven: "获得付费信号后再测算" },
      keySuccessFactors: ["核心结果准确率 ≥80%", "目标用户完成首次关键任务 ≥40%", "用户愿意留下联系方式或付费 ≥30%"],
      landingCycle: "2–3 月",
      validationStatus: "待验证：尚无真实试用结果",
      detailedBreakdown: ["假设：用户愿意用新工具替代现有方式。", "验证：完成一次关键任务后，追问是否愿意再次使用或付费。", "失败处理：优先缩小用户场景，不扩大开发范围。"],
    },
    {
      title: routeNames[1],
      rationale: "把产品包装成可交付的诊断服务，先验证商家是否愿意为结果付费。",
      suitability: "适合能够接触行业从业者、门店或品牌方的团队。",
      audience: `10 家服务 ${user} 的相关商家或服务方`,
      action: `提供一次人工诊断或试点报告，测试 ${product} 是否能节省时间、降低损失或带来转化。`,
      deadline: "3–4 周",
      passCriteria: "至少 3 家完成试点，其中 1 家愿意讨论报价、续用或联合推广。",
      stopCriteria: "10 家均不愿投入时间或数据时，调整价值主张或终止 B2B 假设。",
      estimatedCost: "预计成本：≤800 元",
      difficulty: "★★★☆☆",
      market: { tam: "本阶段未联网，不提供确定性数字", sam: "本阶段未联网，不提供确定性数字", som: "以10家可触达商家作为验证样本", growth: "本阶段未联网，不提供确定性数字" },
      business: { model: "按店铺诊断收费 + 月度工具订阅（待验证）", arr: "无真实交易数据，不计算ARR", breakEven: "获得试点报价后再测算" },
      keySuccessFactors: ["诊断结果能量化节省或转化价值", "商家愿意提供真实数据", "单次服务可沉淀为标准化交付"],
      landingCycle: "3–4 月",
      validationStatus: "待验证：尚无商家试点结果",
      detailedBreakdown: ["假设：商家愿意为明确经营结果付费。", "验证：用人工试点先交付结果，再进入报价。", "失败处理：转向消费者端或降低数据接入门槛。"],
    },
    {
      title: routeNames[2],
      rationale: "先用单次服务或人工交付测试消费者是否愿意为结果采取行动。",
      suitability: "适合获客渠道明确、希望快速验证付费或分享行为的项目。",
      audience: `50 位可通过内容或社群触达的 ${user}`,
      action: "以人工 Concierge 方式完成一次核心服务，观察试用、分享、留资和付费行为。",
      deadline: "1–2 周",
      passCriteria: "至少 5 人完成服务，2 人愿意付费、分享或预约下一次。",
      stopCriteria: "触达 50 人仍无强行动信号时，停止投放并修改结果承诺。",
      estimatedCost: "预计成本：≤500 元",
      difficulty: "★★★☆☆",
      market: { tam: "本阶段未联网，不提供确定性数字", sam: "本阶段未联网，不提供确定性数字", som: "以50位可触达用户作为验证样本", growth: "本阶段未联网，不提供确定性数字" },
      business: { model: "单次服务收费 + 会员订阅（待验证）", arr: "无真实交易数据，不计算ARR", breakEven: "获得首个付费信号后再测算" },
      keySuccessFactors: ["用户愿意完成核心服务流程", "结果可被感知并愿意分享", "人工交付能转为产品能力"],
      landingCycle: "1–2 月",
      validationStatus: "待验证：尚无消费者付费结果",
      detailedBreakdown: ["假设：用户愿意为结果投入照片、时间或金钱。", "验证：先人工交付一次，不依赖完整产品。", "失败处理：重做结果承诺或回到高痛点用户。"],
    },
  ];
}

function buildRouteRequest(project: Project, version: number, customDirection = ""): AiCoachRequest {
  const intent = customDirection.trim()
    ? `用户自定义方向：${customDirection.trim()}`
    : version > 0
      ? `再来3条：生成第 ${version + 1} 组路线，避开此前路线的主要行动。`
      : "首次生成分析工作台与三条验证路线。";
  return {
    mode: "route_options",
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
      interviewCount: project.contactedUserCount,
      activeInterestCount: 0,
      trialCount: 0,
      paymentCount: project.hasQuoted ? 1 : 0,
      hasRetention: false,
    },
    answer: intent,
  };
}

function routeCacheKey(project: Project, version: number, customDirection = "") {
  const raw = JSON.stringify({
    project: buildRouteRequest(project, version, customDirection).project,
    version,
    customDirection: customDirection.trim(),
  });
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `routes:${(hash >>> 0).toString(16)}`;
}

function fallbackRouteData(project: Project, version = 0, customDirection = "") {
  const data = buildFallbackCoachResponse(buildRouteRequest(project, version, customDirection)).data;
  const presetRoutes = buildPresetBusinessRoutes(project, version);
  if (customDirection.trim()) {
    presetRoutes[2] = {
      ...presetRoutes[2],
      title: customDirection.trim().slice(0, 42),
      rationale: "按你的方向补全为可证伪路线；仍需用真实用户行为验证，不代表市场结论。",
      detailedBreakdown: [`你的设想：${customDirection.trim()}`, ...presetRoutes[2].detailedBreakdown],
    };
  }
  return { ...data, routeOptions: presetRoutes };
}

async function generateRouteData(project: Project, version: number, customDirection = "") {
  const request = buildRouteRequest(project, version, customDirection);
  return requestAiCoach(request, {
    strategy: isCompetitionPresetIdea(project, project.description) ? "preset-only" : "live-first",
    cacheKey: routeCacheKey(project, version, customDirection),
  });
}

export function RouteOverview({ project, initialProject, onBack, onConfirmRoute }: RouteOverviewProps) {
  const initialData = useMemo(() => fallbackRouteData(project), [project]);
  const isPresetProject = useMemo(() => isCompetitionPresetIdea(project, project.description), [project]);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [routeSetVersion, setRouteSetVersion] = useState(0);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [showRouteEditor, setShowRouteEditor] = useState(false);
  const [showCustomRouteInput, setShowCustomRouteInput] = useState(false);
  const [customRouteIdea, setCustomRouteIdea] = useState("");
  const [routeEdits, setRouteEdits] = useState({ title: "", model: "", cycle: "" });
  const [analysisWorkbench, setAnalysisWorkbench] = useState<NonNullable<AiCoachData["analysisWorkbench"]>>(() => initialData.analysisWorkbench!);
  const [businessRoutes, setBusinessRoutes] = useState<BusinessRoute[]>(() => initialData.routeOptions as BusinessRoute[]);
  const [aiSource, setAiSource] = useState<"ai" | "fallback">("fallback");
  const [loading, setLoading] = useState(!isPresetProject);
  const [message, setMessage] = useState(isPresetProject ? "比赛预设分析已就绪，未发起模型请求。" : "正在生成可复核分析与三条验证路线……");

  useEffect(() => {
    if (isPresetProject) {
      return undefined;
    }
    let cancelled = false;
    void generateRouteData(project, 0).then((response) => {
      if (cancelled) return;
      setAnalysisWorkbench(response.data.analysisWorkbench!);
      setBusinessRoutes(response.data.routeOptions as BusinessRoute[]);
      setAiSource(response.source);
      setMessage(response.notice || (response.source === "ai" ? "MiMo 已生成项目分析与三条验证路线。" : "比赛预设分析已就绪。"));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isPresetProject, project]);

  const analysisTrace = analysisWorkbench.steps;

  const activeRoute = businessRoutes[activeRouteIndex] ?? businessRoutes[0];
  const displayedRoute: BusinessRoute = {
    ...activeRoute,
    title: routeEdits.title.trim() || activeRoute.title,
    business: { ...activeRoute.business, model: routeEdits.model.trim() || activeRoute.business.model },
    landingCycle: routeEdits.cycle.trim() || activeRoute.landingCycle,
  };

  if (!project.description.trim()) {
    return <section className="routeOverviewEmpty"><h1>先完成项目出发，再生成路线总览。</h1><p>路线总览需要目标用户、问题和现有资源等项目输入。</p><button className="primaryButton" type="button" onClick={onBack}>返回项目出发</button></section>;
  }

  function switchRoute(index: number) {
    setActiveRouteIndex(index);
    setShowRouteDetails(false);
    setShowRouteEditor(false);
    setRouteEdits({ title: "", model: "", cycle: "" });
  }

  async function regenerateRoutes() {
    if (loading) return;
    if (routeSetVersion >= 2) {
      setMessage("比赛演示最多重新生成 2 次；请选择一条路径继续，或输入自己的方向。");
      return;
    }
    const nextVersion = routeSetVersion + 1;
    setLoading(true);
    setMessage("正在生成一组差异更明显的验证路线……");
    const response = await generateRouteData(project, nextVersion);
    setAnalysisWorkbench(response.data.analysisWorkbench!);
    setBusinessRoutes(response.data.routeOptions as BusinessRoute[]);
    setAiSource(response.source);
    setRouteSetVersion(nextVersion);
    setActiveRouteIndex(0);
    setSelectedRouteIndex(null);
    setShowRouteDetails(false);
    setShowRouteEditor(false);
    setRouteEdits({ title: "", model: "", cycle: "" });
    setLoading(false);
    setMessage(response.notice || (response.source === "ai" ? `MiMo 已生成第 ${nextVersion + 1} 组验证路线。` : `已生成第 ${nextVersion + 1} 组本地备用路线。`));
  }

  async function generateCustomRoute() {
    if (!customRouteIdea.trim()) {
      setMessage("请先输入你想验证的路径方向。");
      return;
    }
    if (loading) return;
    const direction = customRouteIdea.trim();
    setLoading(true);
    setMessage("正在分析你的自定义方向并补全验证标准……");
    const response = await generateRouteData(project, routeSetVersion, direction);
    setAnalysisWorkbench(response.data.analysisWorkbench!);
    setBusinessRoutes(response.data.routeOptions as BusinessRoute[]);
    setAiSource(response.source);
    setActiveRouteIndex(2);
    setSelectedRouteIndex(null);
    setShowCustomRouteInput(false);
    setShowRouteDetails(false);
    setShowRouteEditor(false);
    setRouteEdits({ title: "", model: "", cycle: "" });
    setLoading(false);
    setMessage(response.notice || (response.source === "ai" ? "MiMo 已分析你的方向并补全路径卡。" : "模型暂不可用，已用本地方法补全你的路径卡。"));
  }

  function proceedToDecision() {
    if (selectedRouteIndex !== activeRouteIndex) {
      setMessage("请先选择当前展示的路径，再进入路口决策。");
      return;
    }
    onConfirmRoute(displayedRoute);
  }

  return (
    <section className="projectManifest routeOverviewScreen">
      <header className="manifestHeader">
        <div><span className="manifestStep"><BrainCircuit size={16} />AI 已完成第一次项目拆解</span><h1>先确认装进车里的东西。</h1><p>这些是待验证假设，不是已经成立的事实。先比较路线，再选择下一步要验证的方向。</p></div>
        <div className={`aiSourceMark ${aiSource === "ai" ? "source-ai" : "source-fallback"}`}><Sparkles size={16} />{loading ? "AI 分析生成中" : aiSource === "ai" ? "MiMo 实时分析" : "比赛预设分析"}</div>
      </header>

      <section className="aiAnalysisWorkbench" aria-label="AI 分析工作台">
        <header><div><span>AI 分析工作台</span><h2>展示可复核的分析过程，再确认项目摘要。</h2></div><small>{aiSource === "ai" ? "MiMo 结构化分析" : "比赛预设分析"} · 不展示模型内部逐字推理</small></header>
        <section className={`analysisTrace ${showFullAnalysis ? "expanded" : "compact"}`} aria-label="AI 可复核分析过程">
          <div className="analysisTraceIntro"><strong>AI 分析过程</strong><span>展示咨询式结构化步骤与中间产出，不展示内部思维链。</span></div>
          <ol>{analysisTrace.slice(0, showFullAnalysis ? analysisTrace.length : 3).map((step, index) => <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><small>{step.method}</small>{showFullAnalysis && <p>{step.output}</p>}</div></li>)}</ol>
          <button className="analysisExpand" type="button" onClick={() => setShowFullAnalysis((current) => !current)}>{showFullAnalysis ? "收起完整分析" : "展开完整 5 步分析与详细摘要"}</button>
        </section>
        <div className={`analysisWorkbenchGrid ${showFullAnalysis ? "expanded" : "compact"}`}>
          <article className="analysisBlock identified"><span>AI 已识别</span><dl><div><dt>目标用户</dt><dd>{project.targetUser}</dd></div><div><dt>核心问题</dt><dd>{project.painPoint}</dd></div><div><dt>当前替代方案</dt><dd>{project.alternative}</dd></div><div><dt>现有资源</dt><dd>{project.existingArtifact || "尚未确认"}</dd></div></dl></article>
          <article className="analysisBlock judgment"><span>AI 当前判断</span><dl><div><dt>已知事实</dt><dd>{analysisWorkbench.knownFacts.join("；") || initialProject?.description || project.description}</dd></div><div><dt>待验证假设</dt><dd>{analysisWorkbench.assumptions.join("；")}</dd></div><div><dt>最大风险</dt><dd>{analysisWorkbench.biggestRisk}</dd></div><div><dt>优先原因</dt><dd>{analysisWorkbench.priorityReason}</dd></div></dl></article>
          <article className="analysisBlock method"><span>AI 使用的方法</span><ul>{analysisWorkbench.methods.map((method) => <li key={method}>{method}</li>)}</ul></article>
        </div>
      </section>

      <section className="businessRoutePlanner" aria-label="AI 商业路径选择">
        <header className="businessRouteHeader"><div><span>AI 商业路径</span><h2>选一条路径，再用现实结果验证。</h2></div><small>{aiSource === "ai" ? "MiMo 已生成同一结构；本阶段未联网" : "比赛预设数据，非实时市场数据"}</small></header>
        <p className="businessRouteHint">路径是待验证的商业假设，不是市场结论，也不会直接影响项目红绿灯。</p>
        <div className="businessRouteTabs" role="tablist" aria-label="路径选择">{businessRoutes.map((route, index) => <button key={`${route.title}-${index}`} type="button" role="tab" aria-selected={activeRouteIndex === index} className={activeRouteIndex === index ? "active" : ""} onClick={() => switchRoute(index)}><span>路径 {String.fromCharCode(65 + index)}</span><strong>{route.title}</strong></button>)}</div>

        <article className={`businessRouteCard route-${activeRouteIndex}`}>
          <header><div><span>路径 {String.fromCharCode(65 + activeRouteIndex)} · 当前详情</span><h3>{displayedRoute.title}</h3><p>{displayedRoute.rationale}</p></div><small>{displayedRoute.suitability}</small></header>
          {showRouteEditor && <form className="routeEditor" onSubmit={(event) => { event.preventDefault(); setShowRouteEditor(false); setMessage("路径卡已更新；修改内容仍需用真实用户反馈验证。"); }}><label>路径名称<input value={routeEdits.title} placeholder={activeRoute.title} onChange={(event) => setRouteEdits((current) => ({ ...current, title: event.target.value }))} /></label><label>商业模式<input value={routeEdits.model} placeholder={activeRoute.business.model} onChange={(event) => setRouteEdits((current) => ({ ...current, model: event.target.value }))} /></label><label>落地周期<input value={routeEdits.cycle} placeholder={activeRoute.landingCycle} onChange={(event) => setRouteEdits((current) => ({ ...current, cycle: event.target.value }))} /></label><div><button type="submit" className="secondaryButton">保存修改</button><button type="button" className="textButton" onClick={() => setShowRouteEditor(false)}>取消</button></div></form>}
          <div className="businessRouteSections">
            <section><h4>市场验证 <small>基于 MECE 分析</small></h4><dl className="marketFacts"><div><dt>TAM</dt><dd>{displayedRoute.market.tam}</dd></div><div><dt>SAM</dt><dd>{displayedRoute.market.sam}</dd></div><div><dt>SOM</dt><dd>{displayedRoute.market.som}</dd></div><div><dt>市场增长</dt><dd>{displayedRoute.market.growth}</dd></div></dl></section>
            <section><h4>商业模式 <small>基于商业画布</small></h4><dl className="marketFacts"><div><dt>模式</dt><dd>{displayedRoute.business.model}</dd></div><div><dt>首年 ARR</dt><dd>{displayedRoute.business.arr}</dd></div><div><dt>盈亏平衡</dt><dd>{displayedRoute.business.breakEven}</dd></div><div><dt>验证对象</dt><dd>{displayedRoute.audience}</dd></div></dl></section>
            <section className="routeKsf"><h4>关键成功因素</h4><ol>{displayedRoute.keySuccessFactors.map((factor) => <li key={factor}>{factor}</li>)}</ol></section>
          </div>
          <div className="businessRouteMetrics"><span>落地周期：<strong>{displayedRoute.landingCycle}</strong></span><span>难度系数：<strong>{displayedRoute.difficulty}</strong></span><span>验证状态：<strong>{displayedRoute.validationStatus}</strong></span></div>
          {showRouteDetails && <section className="routeBreakdown"><h4>详细拆解</h4><ul>{displayedRoute.detailedBreakdown.map((item) => <li key={item}>{item}</li>)}<li>通过标准：{displayedRoute.passCriteria}</li><li>停止或调整：{displayedRoute.stopCriteria}</li></ul></section>}
          <footer className="businessRouteActions"><button type="button" className={selectedRouteIndex === activeRouteIndex ? "selectedRouteButton" : "primaryButton"} onClick={() => { setSelectedRouteIndex(activeRouteIndex); setMessage(`已选择路径 ${String.fromCharCode(65 + activeRouteIndex)}。`); }}>{selectedRouteIndex === activeRouteIndex ? <><Check size={16} />已选择这条路径</> : "选择这条路径"}</button><button type="button" className="secondaryButton" onClick={() => setShowRouteDetails((current) => !current)}>{showRouteDetails ? "收起详细拆解" : "查看详细拆解"}</button><button type="button" className="secondaryButton" onClick={() => setShowRouteEditor((current) => !current)}>修改这条路径</button></footer>
        </article>
        <div className="businessRouteUtilities"><button type="button" className="textButton" disabled={loading} onClick={() => setShowCustomRouteInput((current) => !current)}>我自己想一条</button><button type="button" className="textButton" disabled={loading} onClick={regenerateRoutes}>{loading ? "正在生成路线……" : "都不满意，再来 3 条"}{routeSetVersion > 0 ? `（${routeSetVersion}/2）` : ""}</button></div>
        {showCustomRouteInput && <form className="customRouteComposer" onSubmit={(event) => { event.preventDefault(); void generateCustomRoute(); }}><label htmlFor="custom-route">写下你想验证的商业路径</label><textarea id="custom-route" value={customRouteIdea} onChange={(event) => setCustomRouteIdea(event.target.value)} placeholder="例如：先与 3 家服装店合作，用人工试衣结果图验证店主是否愿意付费。" /><button type="submit" className="secondaryButton" disabled={loading}>{loading ? "正在分析……" : "让 AI 生成路径卡"}</button></form>}
      </section>

      <footer className="manifestActions"><p>{message}</p><div><button className="ghostButton" type="button" onClick={onBack}>返回修改想法</button><button className="primaryButton" type="button" onClick={proceedToDecision}><Check size={17} />确认路线并进入路口决策</button></div></footer>
    </section>
  );
}
