import {
  ArrowRight,
  BrainCircuit,
  CarFront,
  Check,
  ChevronDown,
  Compass,
  Edit3,
  Library,
  LoaderCircle,
  Route,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { ExampleCase } from "../data/examples";
import { buildFallbackCoachResponse } from "../lib/aiFallback";
import { requestAiCoach } from "../lib/aiClient";
import type { AiCoachRequest, AiProjectDraft } from "../lib/aiSchemas";
import { stageLabels } from "../lib/labels";
import type { JourneyCycle, Project } from "../types";
import cockpitVehicle from "../assets/opc-cockpit-vehicle.png";
import { ProjectVehicle } from "./ProjectVehicle";

interface ProjectDepartureProps {
  project: Project;
  onConfirm: (project: Project, initialProject: Project) => void;
  examples: ExampleCase[];
  onLoadExample: (index: number) => void;
  onReady: () => void;
  activeCycle?: JourneyCycle;
  completedCycles: JourneyCycle[];
}

type DeparturePhase = "input" | "review" | "packing" | "briefing";

const destinations = [
  "确认问题是否值得做",
  "找到第一批真实用户",
  "获得首个付费信号",
  "让一人交付可持续",
] as const;

const draftFields: Array<{
  key: keyof AiProjectDraft;
  label: string;
  multiline?: boolean;
}> = [
  { key: "name", label: "项目名称" },
  { key: "targetUser", label: "最先服务谁" },
  { key: "description", label: "项目在做什么", multiline: true },
  { key: "painPoint", label: "要解决的现实问题", multiline: true },
  { key: "alternative", label: "用户现在怎么解决" },
  { key: "acquisition", label: "第一批用户从哪里来" },
  { key: "monetization", label: "谁为哪个结果付钱" },
  { key: "existingArtifact", label: "当前已有成果" },
  { key: "biggestUncertainty", label: "本轮最大不确定性", multiline: true },
];

const emptyEvidence = {
  interviewCount: 0,
  activeInterestCount: 0,
  trialCount: 0,
  paymentCount: 0,
  hasRetention: false,
};

export function ProjectDeparture({
  project,
  onConfirm,
  examples,
  onLoadExample,
  onReady,
  activeCycle,
  completedCycles,
}: ProjectDepartureProps) {
  const reduceMotion = useReducedMotion();
  const compactAnimation = typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;
  const [phase, setPhase] = useState<DeparturePhase>(() => completedCycles.length > 0 && activeCycle ? "briefing" : "input");
  const [idea, setIdea] = useState(project.description);
  const [destination, setDestination] = useState<(typeof destinations)[number]>(destinations[0]);
  const [draft, setDraft] = useState<AiProjectDraft | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<string[]>([]);
  const [source, setSource] = useState<"ai" | "fallback">("fallback");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCases, setShowCases] = useState(false);
  const [showGuidedInput, setShowGuidedInput] = useState(false);
  const [guidedIdea, setGuidedIdea] = useState({ user: "", problem: "", method: "", outcome: "", resources: "" });
  const [editingField, setEditingField] = useState<keyof AiProjectDraft | null>(null);
  const [showClarification, setShowClarification] = useState(false);

  const luggage = useMemo(() => draft ? [
    { label: "目标用户", value: draft.targetUser, icon: UserRound },
    { label: "现实问题", value: draft.painPoint, icon: Compass },
    { label: "验证目标", value: destination, icon: Route },
    { label: "最大风险", value: draft.biggestUncertainty, icon: BrainCircuit },
  ] : [], [draft, destination]);

  useEffect(() => {
    if (phase !== "packing" || !draft) return;
    const timer = window.setTimeout(onReady, reduceMotion ? 500 : 5600);
    return () => window.clearTimeout(timer);
  }, [draft, onReady, phase, reduceMotion]);

  async function analyzeIdea(extraContext = "", suppliedIdea = idea) {
    const normalizedIdea = suppliedIdea.trim();
    if (normalizedIdea.length < 8) {
      setError("请至少用一句完整的话描述你想做什么、帮助谁或解决什么问题。");
      return;
    }
    setError("");
    setLoading(true);
    const request = buildIntakeRequest(`${normalizedIdea}\n本轮希望：${destination}${extraContext}`);
    const response = await requestAiCoach(request);
    const fallback = buildFallbackCoachResponse(request);
    const nextDraft = response.data.projectDraft ?? fallback.data.projectDraft;
    if (!nextDraft) {
      setError("项目拆解没有返回完整结构，请稍后重试。");
      setLoading(false);
      return;
    }
    setDraft(nextDraft);
    setQuestions(response.data.questions);
    setQuestionAnswers(response.data.questions.map(() => ""));
    setSource(response.source);
    setNotice(response.notice || response.data.summary);
    setEditingField(null);
    setShowClarification(false);
    setPhase("review");
    setLoading(false);
  }

  function buildIntakeRequest(fullIdea: string): AiCoachRequest {
    return {
      mode: "project_intake",
      idea: fullIdea,
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
      evidence: emptyEvidence,
    };
  }

  function updateDraft(key: keyof AiProjectDraft, value: string) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
  }

  function applyClarifications() {
    const context = questions
      .map((question, index) => questionAnswers[index]?.trim() ? `\n${question}\n回答：${questionAnswers[index].trim()}` : "")
      .join("");
    void analyzeIdea(context);
  }

  function analyzeGuidedIdea() {
    const normalized = `我想帮${guidedIdea.user || "一类具体用户"}解决${guidedIdea.problem || "一个反复出现的问题"}，通过${guidedIdea.method || "一个更低成本的方式"}，让他们可以${guidedIdea.outcome || "更快获得明确结果"}${guidedIdea.resources ? `。我目前能使用的资源是：${guidedIdea.resources}` : ""}。`;
    setIdea(normalized);
    setShowGuidedInput(false);
    void analyzeIdea("", normalized);
  }

  function confirmAndPack() {
    if (!draft) return;
    const nextProject: Project = {
      ...project,
      ...draft,
      id: project.description.trim() === idea.trim() && project.id ? project.id : crypto.randomUUID(),
      hasDemo: draft.currentStage === "demo" || draft.currentStage === "mvp" || draft.currentStage === "growth",
    };
    const initialProject: Project = {
      ...project,
      id: nextProject.id,
      name: "最初的一句话想法",
      description: idea.trim(),
      targetUser: "",
      painPoint: "",
      alternative: "",
      acquisition: "",
      monetization: "",
      biggestUncertainty: "",
      existingArtifact: "",
    };
    onConfirm(nextProject, initialProject);
    setPhase("packing");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function selectExampleCase(example: ExampleCase) {
    setIdea(example.project.description || `${example.project.name}，帮助${example.project.targetUser}解决${example.project.painPoint}`);
    setShowCases(false);
    setError("");
  }

  const activeField = editingField === "currentStage"
    ? { key: "currentStage" as const, label: "当前阶段", multiline: false }
    : draftFields.find((field) => field.key === editingField);

  return (
    <div className="departureScreen departureExperience">
      <AnimatePresence mode="wait">
        {phase === "briefing" && activeCycle && (
          <motion.section key="briefing" className="cycleBriefing" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="cycleBriefingSignal"><Sparkles size={18} /><span>第 {activeCycle.cycleNumber} 轮 · 下一程出发</span></div>
            <div className="cycleBriefingLayout">
              <div className="cycleBriefingCopy">
                <span>{stageLabels[project.currentStage]}</span>
                <h1>项目没有重新开始，它带着上一轮证据继续前进。</h1>
                <p>AI 已继承项目资料、任务结果、风险变化和历史建议。本轮只聚焦一个最关键目标。</p>
                <article><small>本轮核心任务</small><strong>{activeCycle.primaryGoal}</strong></article>
                <div className="cycleBriefingActions">
                  <button className="primaryButton" type="button" onClick={onReady}><Route size={17} />进入第 {activeCycle.cycleNumber} 轮地图</button>
                  <button className="ghostButton" type="button" onClick={() => setPhase("input")}><Edit3 size={16} />调整项目资料</button>
                </div>
              </div>
              <div className="cycleBriefingVehicle">
                <img className="cockpitVehicleAsset" src={cockpitVehicle} alt="OPC 项目车" />
                <div><span>已完成轮次</span><strong>{completedCycles.length}</strong><span>历史证据继续保留</span></div>
              </div>
            </div>
          </motion.section>
        )}

        {phase === "input" && (
          <motion.section
            key="input"
            className="ideaLaunch"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <div className="ideaLaunchCopy">
              <div className="launchSignal"><span /><span /><span /><strong>AI创业验证旅程</strong></div>
              <h1>把想法装上车，去现实里找到答案。</h1>
              <p>你只需要说清想法。AI负责拆解风险、规划路线和生成任务，真实反馈决定项目车能否继续前进。</p>
              <div className="launchWorldBoard" aria-label="创业验证旅行地图预览">
                <div className="worldBoardTopline"><span>当前路线预览</span><strong>从想法到第一条付费证据</strong></div>
                <svg viewBox="0 0 620 250" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="launchRoadGlow" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#58d9ff" />
                      <stop offset="0.55" stopColor="#39bdf1" />
                      <stop offset="1" stopColor="#20c86a" />
                    </linearGradient>
                  </defs>
                  <path className="launchTerrain terrainBack" d="M0 146 C88 70 168 118 244 64 C324 8 390 88 458 48 C520 12 572 46 620 6 L620 250 L0 250 Z" />
                  <path className="launchTerrain terrainFront" d="M0 198 C86 142 154 190 230 142 C320 84 402 178 484 116 C538 76 584 92 620 70 L620 250 L0 250 Z" />
                  <path className="launchWorldRoad shadow" d="M54 181 C122 181 120 96 192 96 S266 188 332 188 S408 86 470 86 S530 155 578 135" />
                  <path className="launchWorldRoad glow" d="M54 181 C122 181 120 96 192 96 S266 188 332 188 S408 86 470 86 S530 155 578 135" />
                  <path className="launchWorldRoad dash" d="M54 181 C122 181 120 96 192 96 S266 188 332 188 S408 86 470 86 S530 155 578 135" />
                </svg>
                <div className="launchLandmark village"><i /><span>用户村</span></div>
                <div className="launchLandmark forest"><i /><span>需求森林</span></div>
                <div className="launchLandmark port"><i /><span>付费港口</span></div>
                <div className="launchLandmark factory"><i /><span>交付工厂</span></div>
                <motion.div className="launchWorldVehicle" animate={{ x: [0, 14, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
                  <ProjectVehicle size="small" loaded={false} />
                </motion.div>
                <div className="worldBoardLegend"><span><i className="red" />风险</span><span><i className="yellow" />验证</span><span><i className="green" />通过</span></div>
              </div>
            </div>

            <div className="ideaConsole">
              <label className="ideaField">
                <span>我想做一个</span>
                <textarea
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  placeholder="用一句话说清你的想法，例如：帮网购买衣服的年轻女性预览上身效果，减少买错和退货。"
                />
              </label>
              <div className="departureGoalRow" aria-label="本轮优先目标">
                <span>这一轮我最想先</span>
                <div>{destinations.map((item) => <button className={destination === item ? "selected" : ""} type="button" key={item} onClick={() => setDestination(item)}>{item}</button>)}</div>
              </div>
              <button className="guidedInputToggle" type="button" onClick={() => setShowGuidedInput((value) => !value)} aria-expanded={showGuidedInput}>
                <Compass size={16} />不知道怎么写？用引导描述
              </button>
              <AnimatePresence initial={false}>
                {showGuidedInput && (
                  <motion.section className="guidedIdeaBuilder" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <p>不需要全部填写，写出你现在最确定的部分即可。</p>
                    <label>我想帮<input value={guidedIdea.user} onChange={(event) => setGuidedIdea((current) => ({ ...current, user: event.target.value }))} placeholder="谁" /></label>
                    <label>解决<input value={guidedIdea.problem} onChange={(event) => setGuidedIdea((current) => ({ ...current, problem: event.target.value }))} placeholder="什么问题" /></label>
                    <label>通过<input value={guidedIdea.method} onChange={(event) => setGuidedIdea((current) => ({ ...current, method: event.target.value }))} placeholder="什么方式" /></label>
                    <label>让他们可以<input value={guidedIdea.outcome} onChange={(event) => setGuidedIdea((current) => ({ ...current, outcome: event.target.value }))} placeholder="得到什么结果" /></label>
                    <label className="guidedResource">我目前有的资源<input value={guidedIdea.resources} onChange={(event) => setGuidedIdea((current) => ({ ...current, resources: event.target.value }))} placeholder="选填，例如：5 位店主朋友、设计能力、一个现成 Demo" /></label>
                    <button className="secondaryButton" type="button" onClick={analyzeGuidedIdea}>用这些信息让 AI 理清</button>
                  </motion.section>
                )}
              </AnimatePresence>
              {error && <p className="ideaError">{error}</p>}
              <div className="ideaActions">
                <button className="primaryButton launchButton" type="button" onClick={() => void analyzeIdea()} disabled={loading}>
                  {loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                  {loading ? "AI正在拆解项目" : "让 AI 帮我理清"}
                </button>
                <button className="guestButton" type="button" onClick={() => onLoadExample(0)}>
                  <CarFront size={17} />我是游客，直接体验
                </button>
              </div>
            </div>

            <div className="caseLibraryBar">
              <div><Library size={17} /><span>不知道怎么写？从案例开始</span></div>
              <div className="caseQuickList">
                {examples.slice(0, 3).map((example) => (
                    <button type="button" key={example.project.id} onClick={() => selectExampleCase(example)}>{example.project.name}</button>
                ))}
              </div>
              <button className="caseLibraryToggle" type="button" onClick={() => setShowCases((value) => !value)} aria-expanded={showCases}>
                案例库<ChevronDown size={15} />
              </button>
            </div>

            <AnimatePresence>
              {showCases && (
                <motion.div className="caseLibraryDrawer" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {examples.map((example) => (
                    <button type="button" key={example.project.id} onClick={() => selectExampleCase(example)}>
                      <strong>{example.project.name}</strong>
                      <span>{stageLabels[example.project.currentStage]}</span>
                      <p>{example.project.description}</p>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        {phase === "review" && draft && (
          <motion.section key="review" className="projectManifest" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <header className="manifestHeader">
              <div>
                <span className="manifestStep"><BrainCircuit size={16} />AI已完成第一次项目拆解</span>
                <h1>先确认装进车里的东西。</h1>
                <p>这些是待验证假设，不是已经成立的事实。你只需要修改AI理解错的地方。</p>
              </div>
              <div className={`aiSourceMark source-${source}`}><Sparkles size={16} />{source === "ai" ? "AI生成" : "本地稳定拆解"}</div>
            </header>

            <div className="manifestSummaryGrid">
              <article className="manifestSummaryCard primary"><span>项目车</span><strong>{draft.name}</strong><p>{draft.description}</p><div><button type="button" onClick={() => setEditingField("name")}>改名称</button><button type="button" onClick={() => setEditingField("description")}>改描述</button></div></article>
              <article className="manifestSummaryCard"><span>最先服务谁</span><strong>{draft.targetUser}</strong><p>{draft.painPoint}</p><div><button type="button" onClick={() => setEditingField("targetUser")}>改用户</button><button type="button" onClick={() => setEditingField("painPoint")}>改问题</button></div></article>
              <article className="manifestSummaryCard"><span>现实入口</span><strong>{draft.acquisition}</strong><p>用户当前方案：{draft.alternative}</p><div><button type="button" onClick={() => setEditingField("acquisition")}>改入口</button><button type="button" onClick={() => setEditingField("alternative")}>改替代方案</button></div></article>
              <article className="manifestSummaryCard warning"><span>本轮最大风险</span><strong>{draft.biggestUncertainty}</strong><p>验证目的地：{destination}</p><div><button type="button" onClick={() => setEditingField("biggestUncertainty")}>修改风险</button></div></article>
              <article className="manifestSummaryCard"><span>交易与成果</span><strong>{draft.monetization}</strong><p>{draft.existingArtifact || "当前还没有可展示成果"}</p><div><button type="button" onClick={() => setEditingField("monetization")}>改付费</button><button type="button" onClick={() => setEditingField("existingArtifact")}>改成果</button></div></article>
              <article className="manifestSummaryCard stage"><span>当前阶段</span><strong>{stageLabels[draft.currentStage]}</strong><p>AI会按这个阶段调整任务强度。</p><div><button type="button" onClick={() => setEditingField("currentStage")}>修改阶段</button></div></article>
            </div>

            <AnimatePresence>
              {editingField && activeField && (
                <motion.section className="singleFactEditor" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div><Edit3 size={17} /><p><strong>只修改：{activeField.label}</strong><span>其余内容保持不变。</span></p><button type="button" onClick={() => setEditingField(null)}>完成</button></div>
                  {editingField === "currentStage" ? (
                    <select value={draft.currentStage} onChange={(event) => setDraft({ ...draft, currentStage: event.target.value as AiProjectDraft["currentStage"] })}>
                      {Object.entries(stageLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  ) : activeField.multiline ? (
                    <textarea value={String(draft[editingField])} onChange={(event) => updateDraft(editingField, event.target.value)} autoFocus />
                  ) : (
                    <input value={String(draft[editingField])} onChange={(event) => updateDraft(editingField, event.target.value)} autoFocus />
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {questions.length > 0 && !editingField && (
              <section className={`clarificationPanel singleClarification ${showClarification ? "open" : ""}`}>
                <div><strong>AI发现一个仍需确认的关键点</strong><span>{questions[0]}</span></div>
                {!showClarification ? (
                  <button type="button" onClick={() => setShowClarification(true)}><Edit3 size={16} />补充这个信息</button>
                ) : (
                  <><label><span>你的补充</span><input value={questionAnswers[0] || ""} onChange={(event) => setQuestionAnswers((current) => current.map((value, itemIndex) => itemIndex === 0 ? event.target.value : value))} autoFocus /></label>
                  <button type="button" onClick={applyClarifications} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <Edit3 size={16} />}重新拆解</button></>
                )}
              </section>
            )}

            <footer className="manifestActions">
              <p>{notice}</p>
              <div>
                <button className="ghostButton" type="button" onClick={() => setPhase("input")}>返回修改想法</button>
                <button className="primaryButton" type="button" onClick={confirmAndPack}><Check size={17} />确认并装车</button>
              </div>
            </footer>
          </motion.section>
        )}

        {phase === "packing" && draft && (
          <motion.section key="packing" className="packingScene packingCinematic" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="packingBackdrop" aria-hidden="true"><i /><i /><i /><i /></div>
            <header className="packingHeader">
              <div><span>AI 路线规划完成</span><h1>正在把想法装进项目车</h1><p>四项关键假设将成为这次旅程的行李，而不是已经成立的事实。</p></div>
              <div className="packingDestination"><span>下一站</span><strong>{destination}</strong></div>
            </header>

            <div className="packingSequence">
              <motion.article
                className="packingOriginalIdea"
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: [0, 1, 1, 0.72], y: [18, 0, 0, -8], scale: [0.97, 1, 1, 0.92] }}
                transition={{ duration: reduceMotion ? 0.01 : 2.1, times: [0, 0.24, 0.72, 1] }}
              >
                <span>原始想法</span><p>{idea}</p><small>AI 正在提取可验证结构</small>
              </motion.article>

              <div className="packingTransfer" aria-label="AI 拆解出的四项关键假设">
                <svg viewBox="0 0 760 250" preserveAspectRatio="none" aria-hidden="true">
                  <motion.path
                    d={compactAnimation ? "M380 20 C380 90 380 150 380 228" : "M44 126 C230 22 440 228 718 126"}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: reduceMotion ? 0 : 0.75, duration: reduceMotion ? 0.01 : 1.25 }}
                  />
                </svg>
                {luggage.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.article
                      key={item.label}
                      className={`packingLuggage luggage-${index + 1}`}
                      initial={{ opacity: 0, scale: 0.86, x: 0, y: compactAnimation ? -24 : 18 }}
                      animate={{
                        opacity: reduceMotion ? 1 : [0, 1, 1, 0],
                        scale: reduceMotion ? 1 : [0.82, 1, 1, 0.36],
                        x: reduceMotion ? 0 : compactAnimation ? [0, 0, 0, 0] : [0, 0, 0, "34vw"],
                        y: reduceMotion ? 0 : compactAnimation ? [-24, 0, 0, 150] : [18, 0, 0, 40],
                      }}
                      transition={{ delay: reduceMotion ? 0 : 0.55 + index * 0.43, duration: reduceMotion ? 0.01 : 2.65, times: [0, 0.24, 0.68, 1] }}
                    >
                      <Icon size={18} /><span>{item.label}</span><strong>{item.value}</strong><i>{String(index + 1).padStart(2, "0")}</i>
                    </motion.article>
                  );
                })}
              </div>

              <motion.div
                className="packingVehicleStage"
                initial={{ x: 0, y: 0 }}
                animate={{ x: reduceMotion ? 0 : compactAnimation ? [0, 0, 0] : [0, 0, "48vw"], y: reduceMotion ? 0 : compactAnimation ? [0, 0, 170] : [0, 0, -22] }}
                transition={{ duration: reduceMotion ? 0.01 : 5.25, times: [0, 0.78, 1], ease: [0.65, 0, 0.35, 1] }}
              >
                <motion.div initial={{ scale: 0.94, opacity: 1 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
                  <img className="cockpitVehicleAsset packingVehicleAsset" src={cockpitVehicle} alt={`${draft.name}项目车`} />
                </motion.div>
                <div className="cargoIndicator"><span>装载进度</span><div>{luggage.map((item, index) => <motion.i key={item.label} initial={{ scale: 0.3, opacity: 0.25 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: reduceMotion ? 0 : 2.6 + index * 0.34 }} />)}</div></div>
              </motion.div>

              <div className="packingSignal" aria-label="路线已放行"><i /><i /><motion.i initial={{ opacity: 0.25 }} animate={{ opacity: 1, scale: [1, 1.18, 1] }} transition={{ delay: reduceMotion ? 0 : 4.05, duration: 0.8 }} /></div>
              <motion.div className="packingRoadReveal" initial={{ scaleX: reduceMotion ? 1 : .16 }} animate={{ scaleX: 1 }} transition={{ delay: reduceMotion ? 0 : 1.1, duration: reduceMotion ? 0.01 : 2.9 }}><span /><span /><span /></motion.div>
            </div>
            <div className="packingFooter"><span>AI 已完成：拆解项目 · 识别风险 · 规划验证目标</span><button className="packingSkip" type="button" onClick={onReady}>跳过动画<ArrowRight size={16} /></button></div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
