import { BrainCircuit, Check, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
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
  successProbability: string;
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
      market: { tam: "1000 万潜在用户", sam: "100 万可服务用户", som: "首年 1 万目标用户", growth: "预设市场年增长率：25%" },
      business: { model: "免费基础版 + Pro 订阅（29 元/月）", arr: "预设首年 ARR：35 万元", breakEven: "预设盈亏平衡点：第 8 个月" },
      keySuccessFactors: ["核心结果准确率 ≥80%", "目标用户完成首次关键任务 ≥40%", "用户愿意留下联系方式或付费 ≥30%"],
      landingCycle: "2–3 月",
      successProbability: "比赛预设成功概率：65%",
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
      market: { tam: "50 万相关商家", sam: "5 万可触达商家", som: "首年 500 家试点客户", growth: "预设市场年增长率：18%" },
      business: { model: "按店铺诊断收费 + 月度工具订阅", arr: "预设首年 ARR：48 万元", breakEven: "预设盈亏平衡点：第 10 个月" },
      keySuccessFactors: ["诊断结果能量化节省或转化价值", "商家愿意提供真实数据", "单次服务可沉淀为标准化交付"],
      landingCycle: "3–4 月",
      successProbability: "比赛预设成功概率：55%",
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
      market: { tam: "2000 万潜在消费者", sam: "200 万高频用户", som: "首年 2 万付费用户", growth: "预设市场年增长率：22%" },
      business: { model: "单次服务收费 + 会员订阅", arr: "预设首年 ARR：30 万元", breakEven: "预设盈亏平衡点：第 9 个月" },
      keySuccessFactors: ["用户愿意完成核心服务流程", "结果可被感知并愿意分享", "人工交付能转为产品能力"],
      landingCycle: "1–2 月",
      successProbability: "比赛预设成功概率：50%",
      detailedBreakdown: ["假设：用户愿意为结果投入照片、时间或金钱。", "验证：先人工交付一次，不依赖完整产品。", "失败处理：重做结果承诺或回到高痛点用户。"],
    },
  ];
}

export function RouteOverview({ project, initialProject, onBack, onConfirmRoute }: RouteOverviewProps) {
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [routeSetVersion, setRouteSetVersion] = useState(0);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [showRouteEditor, setShowRouteEditor] = useState(false);
  const [showCustomRouteInput, setShowCustomRouteInput] = useState(false);
  const [customRouteIdea, setCustomRouteIdea] = useState("");
  const [confirmedCustomRouteIdea, setConfirmedCustomRouteIdea] = useState("");
  const [routeEdits, setRouteEdits] = useState({ title: "", model: "", cycle: "" });
  const [message, setMessage] = useState("比赛预设分析：未连接外部大模型，结果由本地规则稳定生成。");

  const analysisTrace = useMemo(() => [
    { title: "问题拆解", method: "MECE：用户、场景、痛点、替代方案", output: `聚焦「${project.targetUser}」；当前问题是「${project.painPoint}」。` },
    { title: "市场与替代扫描", method: "预设案例库 + 当前替代方案", output: `用户目前依赖「${project.alternative}」。比赛版未连接实时联网市场数据。` },
    { title: "商业路径推演", method: "价值链、获客入口、交付资源", output: `先从「${project.acquisition}」触达；现有可用资源是「${project.existingArtifact || "尚未确认"}」。` },
    { title: "关键假设账本", method: "80/20 优先级：先验证最致命的不确定性", output: `优先验证：${project.biggestUncertainty}` },
    { title: "最小验证路线", method: "低成本、可证伪、可回填证据", output: "把关键假设拆成访谈、试用或人工服务等可执行路线。" },
  ], [project]);

  const businessRoutes = useMemo(() => {
    const routes = buildPresetBusinessRoutes(project, routeSetVersion);
    if (!confirmedCustomRouteIdea.trim()) return routes;
    return [routes[0], routes[1], {
      ...routes[2],
      title: confirmedCustomRouteIdea.trim().slice(0, 42),
      rationale: "按你的方向生成的比赛预设路径；仍需用真实用户行为验证，不代表市场结论。",
      detailedBreakdown: [`你的设想：${confirmedCustomRouteIdea.trim()}`, ...routes[2].detailedBreakdown],
    }];
  }, [confirmedCustomRouteIdea, project, routeSetVersion]);

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

  function regenerateRoutes() {
    if (routeSetVersion >= 2) {
      setMessage("比赛演示最多重新生成 2 次；请选择一条路径继续，或输入自己的方向。");
      return;
    }
    setRouteSetVersion((current) => current + 1);
    setActiveRouteIndex(0);
    setSelectedRouteIndex(null);
    setShowRouteDetails(false);
    setShowRouteEditor(false);
    setRouteEdits({ title: "", model: "", cycle: "" });
    setMessage(`已生成第 ${routeSetVersion + 2} 组比赛预设路径，未连接外部大模型。`);
  }

  function generateCustomRoute() {
    if (!customRouteIdea.trim()) {
      setMessage("请先输入你想验证的路径方向。");
      return;
    }
    setConfirmedCustomRouteIdea(customRouteIdea.trim());
    setActiveRouteIndex(2);
    setSelectedRouteIndex(null);
    setShowCustomRouteInput(false);
    setShowRouteDetails(false);
    setShowRouteEditor(false);
    setRouteEdits({ title: "", model: "", cycle: "" });
    setMessage("已用本地预设方法补全你的路径卡；商业化版本可在此接入大模型。");
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
        <div className="aiSourceMark source-fallback"><Sparkles size={16} />比赛预设分析</div>
      </header>

      <section className="aiAnalysisWorkbench" aria-label="AI 分析工作台">
        <header><div><span>AI 分析工作台</span><h2>展示可复核的分析过程，再确认项目摘要。</h2></div><small>比赛预设分析 · 不展示模型内部逐字推理</small></header>
        <section className={`analysisTrace ${showFullAnalysis ? "expanded" : "compact"}`} aria-label="AI 可复核分析过程">
          <div className="analysisTraceIntro"><strong>AI 分析过程</strong><span>展示咨询式结构化步骤与中间产出，不展示内部思维链。</span></div>
          <ol>{analysisTrace.slice(0, showFullAnalysis ? analysisTrace.length : 3).map((step, index) => <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><small>{step.method}</small>{showFullAnalysis && <p>{step.output}</p>}</div></li>)}</ol>
          <button className="analysisExpand" type="button" onClick={() => setShowFullAnalysis((current) => !current)}>{showFullAnalysis ? "收起完整分析" : "展开完整 5 步分析与详细摘要"}</button>
        </section>
        <div className={`analysisWorkbenchGrid ${showFullAnalysis ? "expanded" : "compact"}`}>
          <article className="analysisBlock identified"><span>AI 已识别</span><dl><div><dt>目标用户</dt><dd>{project.targetUser}</dd></div><div><dt>核心问题</dt><dd>{project.painPoint}</dd></div><div><dt>当前替代方案</dt><dd>{project.alternative}</dd></div><div><dt>现有资源</dt><dd>{project.existingArtifact || "尚未确认"}</dd></div></dl></article>
          <article className="analysisBlock judgment"><span>AI 当前判断</span><dl><div><dt>已知事实</dt><dd>你已明确希望解决：{initialProject?.description || project.description}</dd></div><div><dt>待验证假设</dt><dd>{project.targetUser}是否会采取试用、留资或付费等外部行动。</dd></div><div><dt>最大风险</dt><dd>{project.biggestUncertainty}</dd></div><div><dt>优先原因</dt><dd>没有真实行动信号时，继续开发只会增加投入，不能降低不确定性。</dd></div></dl></article>
          <article className="analysisBlock method"><span>AI 使用的方法</span><ul><li>用户与问题拆解</li><li>假设树：用户、问题、替代方案、付费与交付</li><li>商业路径推演</li><li>最小成本验证</li></ul></article>
        </div>
      </section>

      <section className="businessRoutePlanner" aria-label="AI 商业路径选择">
        <header className="businessRouteHeader"><div><span>AI 商业路径</span><h2>选一条路径，再用现实结果验证。</h2></div><small>比赛预设数据，非实时市场数据；后续可接大模型生成同一结构</small></header>
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
          <div className="businessRouteMetrics"><span>落地周期：<strong>{displayedRoute.landingCycle}</strong></span><span>难度系数：<strong>{displayedRoute.difficulty}</strong></span><span>成功概率：<strong>{displayedRoute.successProbability}</strong></span></div>
          {showRouteDetails && <section className="routeBreakdown"><h4>详细拆解</h4><ul>{displayedRoute.detailedBreakdown.map((item) => <li key={item}>{item}</li>)}<li>通过标准：{displayedRoute.passCriteria}</li><li>停止或调整：{displayedRoute.stopCriteria}</li></ul></section>}
          <footer className="businessRouteActions"><button type="button" className={selectedRouteIndex === activeRouteIndex ? "selectedRouteButton" : "primaryButton"} onClick={() => { setSelectedRouteIndex(activeRouteIndex); setMessage(`已选择路径 ${String.fromCharCode(65 + activeRouteIndex)}。`); }}>{selectedRouteIndex === activeRouteIndex ? <><Check size={16} />已选择这条路径</> : "选择这条路径"}</button><button type="button" className="secondaryButton" onClick={() => setShowRouteDetails((current) => !current)}>{showRouteDetails ? "收起详细拆解" : "查看详细拆解"}</button><button type="button" className="secondaryButton" onClick={() => setShowRouteEditor((current) => !current)}>修改这条路径</button></footer>
        </article>
        <div className="businessRouteUtilities"><button type="button" className="textButton" onClick={() => setShowCustomRouteInput((current) => !current)}>我自己想一条</button><button type="button" className="textButton" onClick={regenerateRoutes}>都不满意，再来 3 条{routeSetVersion > 0 ? `（${routeSetVersion}/2）` : ""}</button></div>
        {showCustomRouteInput && <form className="customRouteComposer" onSubmit={(event) => { event.preventDefault(); generateCustomRoute(); }}><label htmlFor="custom-route">写下你想验证的商业路径</label><textarea id="custom-route" value={customRouteIdea} onChange={(event) => setCustomRouteIdea(event.target.value)} placeholder="例如：先与 3 家服装店合作，用人工试衣结果图验证店主是否愿意付费。" /><button type="submit" className="secondaryButton">用预设方法生成路径卡</button></form>}
      </section>

      <footer className="manifestActions"><p>{message}</p><div><button className="ghostButton" type="button" onClick={onBack}>返回修改想法</button><button className="primaryButton" type="button" onClick={proceedToDecision}><Check size={17} />确认路线并进入路口决策</button></div></footer>
    </section>
  );
}
