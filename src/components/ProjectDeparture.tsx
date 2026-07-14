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
  PackageOpen,
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
import type { Project } from "../types";

interface ProjectDepartureProps {
  project: Project;
  onChange: (project: Project) => void;
  onConfirm: (project: Project, initialProject: Project) => void;
  examples: ExampleCase[];
  onLoadExample: (index: number) => void;
  onReady: () => void;
}

type DeparturePhase = "input" | "review" | "packing";

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
  onChange,
  onConfirm,
  examples,
  onLoadExample,
  onReady,
}: ProjectDepartureProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<DeparturePhase>("input");
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

  const luggage = useMemo(() => draft ? [
    { label: "目标用户", value: draft.targetUser, icon: UserRound },
    { label: "现实问题", value: draft.painPoint, icon: Compass },
    { label: "验证目标", value: destination, icon: Route },
    { label: "最大风险", value: draft.biggestUncertainty, icon: BrainCircuit },
  ] : [], [draft, destination]);

  useEffect(() => {
    if (phase !== "packing" || !draft) return;
    const timer = window.setTimeout(onReady, reduceMotion ? 500 : 3900);
    return () => window.clearTimeout(timer);
  }, [draft, onReady, phase, reduceMotion]);

  async function analyzeIdea(extraContext = "") {
    if (idea.trim().length < 8) {
      setError("请至少用一句完整的话描述你想做什么、帮助谁或解决什么问题。");
      return;
    }
    setError("");
    setLoading(true);
    const request = buildIntakeRequest(`${idea.trim()}\n本轮希望：${destination}${extraContext}`);
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
    onChange(nextProject);
    onConfirm(nextProject, initialProject);
    setPhase("packing");
  }

  function useCase(example: ExampleCase) {
    setIdea(example.project.description || `${example.project.name}，帮助${example.project.targetUser}解决${example.project.painPoint}`);
    setShowCases(false);
    setError("");
  }

  return (
    <div className="departureScreen departureExperience">
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <motion.section
            key="input"
            className="ideaLaunch"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <div className="ideaLaunchCopy">
              <div className="launchSignal" aria-hidden="true"><span /><span /><span /></div>
              <h1>把一句创业想法，变成一条能执行、能验证的路线。</h1>
              <p>AI会拆解用户、问题、交易和交付风险，生成现实任务；真实反馈决定项目车下一步开向哪里。</p>
            </div>

            <div className="ideaConsole">
              <label className="destinationField">
                <span>我想把这个项目先带到</span>
                <select value={destination} onChange={(event) => setDestination(event.target.value as typeof destination)}>
                  {destinations.map((item) => <option value={item} key={item}>{item}</option>)}
                </select>
              </label>
              <label className="ideaField">
                <span>我的想法是</span>
                <textarea
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  placeholder="例如：我想做一个AI试衣助手，帮助经常网购但不确定上身效果的年轻女性，减少买错和退货。"
                  autoFocus
                />
              </label>
              {error && <p className="ideaError">{error}</p>}
              <div className="ideaActions">
                <button className="primaryButton launchButton" type="button" onClick={() => void analyzeIdea()} disabled={loading}>
                  {loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                  {loading ? "AI正在拆解项目" : "让AI规划路线"}
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
                  <button type="button" key={example.project.id} onClick={() => useCase(example)}>{example.project.name}</button>
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
                    <button type="button" key={example.project.id} onClick={() => useCase(example)}>
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

            <div className="manifestGrid">
              {draftFields.map((field) => (
                <label key={field.key} className={field.multiline ? "wide" : ""}>
                  <span>{field.label}</span>
                  {field.multiline ? (
                    <textarea value={String(draft[field.key])} onChange={(event) => updateDraft(field.key, event.target.value)} />
                  ) : (
                    <input value={String(draft[field.key])} onChange={(event) => updateDraft(field.key, event.target.value)} />
                  )}
                </label>
              ))}
              <label>
                <span>当前阶段</span>
                <select value={draft.currentStage} onChange={(event) => setDraft({ ...draft, currentStage: event.target.value as AiProjectDraft["currentStage"] })}>
                  {Object.entries(stageLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
            </div>

            {questions.length > 0 && (
              <section className="clarificationPanel">
                <div><strong>AI还有{questions.length}个可选问题</strong><span>不回答也能继续，补充后路线会更具体。</span></div>
                {questions.map((question, index) => (
                  <label key={question}><span>{question}</span><input value={questionAnswers[index] || ""} onChange={(event) => setQuestionAnswers((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} /></label>
                ))}
                <button type="button" onClick={applyClarifications} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <Edit3 size={16} />}补充后重新拆解</button>
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
          <motion.section key="packing" className="packingScene" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="packingSky"><span /><span /><span /></div>
            <header><span>AI路线规划完成</span><h1>正在把想法装进项目车</h1><p>下一站：{destination}</p></header>
            <div className="packingStage">
              <div className="luggageQueue">
                {luggage.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.article key={item.label} initial={{ x: -90, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: reduceMotion ? 0 : index * 0.55, duration: 0.45 }}>
                      <Icon size={18} /><span>{item.label}</span><strong>{item.value}</strong>
                    </motion.article>
                  );
                })}
              </div>
              <motion.div className="packingCar" initial={{ x: 0 }} animate={{ x: reduceMotion ? 0 : [0, 0, 520] }} transition={{ duration: 3.7, times: [0, 0.72, 1], ease: "easeInOut" }}>
                <PackageOpen size={22} /><CarFront size={58} /><span>{draft.name}</span>
              </motion.div>
              <div className="packingRoad"><span /><span /><span /></div>
            </div>
            <button className="packingSkip" type="button" onClick={onReady}>跳过动画<ArrowRight size={16} /></button>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
