import {
  ArrowRight,
  BrainCircuit,
  CarFront,
  Check,
  Compass,
  Edit3,
  LoaderCircle,
  Route,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { buildFallbackCoachResponse } from "../lib/aiFallback";
import type { AiCoachRequest, AiProjectDraft } from "../lib/aiSchemas";
import { stageLabels } from "../lib/labels";
import type { JourneyCycle, Project } from "../types";

type DeparturePhase = "input" | "clarify" | "briefing";

interface ClarificationStep {
  question: string;
  hint: string;
  options: string[];
}

interface ProjectDepartureProps {
  project: Project;
  onConfirm: (project: Project, initialProject: Project) => void;
  onLoadExample: (index: number) => void;
  onReady: () => void;
  activeCycle?: JourneyCycle;
  completedCycles: JourneyCycle[];
}

const destinations = [
  "确认问题是否值得做",
  "找到第一批真实用户",
  "获得首个付费信号",
  "让一人交付可持续",
] as const;

const emptyEvidence = {
  interviewCount: 0,
  activeInterestCount: 0,
  trialCount: 0,
  paymentCount: 0,
  hasRetention: false,
};

function buildClarificationSteps(idea: string, draft: AiProjectDraft): ClarificationStep[] {
  const isTryOnDemo = /试衣|试穿|换衣|穿搭|服装|衣服图|上身效果/.test(idea);
  if (isTryOnDemo) {
    return [
      {
        question: "第一批先验证哪一类人？",
        hint: "先缩小对象，才能找到真实样本，不要同时面向所有服装消费者。",
        options: ["经常网购服装、担心上身效果的年轻女性", "有私域顾客的服装店主", "先验证愿意上传照片的穿搭内容用户"],
      },
      {
        question: "用户最愿意为哪个结果采取行动？",
        hint: "我们验证的是具体行为，不是“觉得功能有趣”。",
        options: ["下单前确认衣服是否适合自己", "减少买错后退货或换货", "快速获得一张可分享的试穿效果图"],
      },
      {
        question: "你现在能拿来验证的最小资源是什么？",
        hint: "不需要先完成产品；一个人工流程或静态页面也可以测试行动意愿。",
        options: ["可点击的换衣 Demo 或效果图", "先人工生成 3-5 张试穿效果", "5 位可直接联系的目标用户"],
      },
    ];
  }

  return [
    {
      question: "第一批最容易联系到、最常遇到问题的人具体是谁？",
      hint: "目标用户越具体，后续访谈和验证成本越低。",
      options: [draft.targetUser, "你身边可直接联系到的一小类用户", "已有社群或客户中的高频用户"],
    },
    {
      question: "这个问题最近一次发生时，用户付出了什么代价？",
      hint: "优先确认发生频率、时间或金钱损失，而不是主观喜欢程度。",
      options: ["浪费了时间，需要反复手工处理", "产生了直接金钱损失或退货成本", "错过机会，结果不确定且焦虑"],
    },
    {
      question: "你本周能拿来验证的最小资源是什么？",
      hint: "先用现有资源获得外部反馈，再决定是否投入开发。",
      options: ["5 位可直接联系的目标用户", "一个原型、页面或人工服务流程", "现有社群、内容渠道或行业联系人"],
    },
  ];
}

function applyClarifications(draft: AiProjectDraft, idea: string, answers: string[]): AiProjectDraft {
  const isTryOnDemo = /试衣|试穿|换衣|穿搭|服装|衣服图|上身效果/.test(idea);
  const [targetUser, desiredOutcome, availableResource] = answers;
  const user = targetUser || draft.targetUser;

  return {
    ...draft,
    targetUser: user,
    painPoint: isTryOnDemo && desiredOutcome
      ? `${user}希望${desiredOutcome}，但商品图、买家秀和现有试衣方式无法可靠判断自己的上身效果。`
      : draft.painPoint,
    existingArtifact: availableResource || draft.existingArtifact,
    biggestUncertainty: isTryOnDemo
      ? `${user}是否愿意上传照片，并为“${desiredOutcome || "确认上身效果"}”完成一次试用、留资或付费动作。`
      : `${user}是否真的会为解决这个问题采取可复核的下一步行动。`,
  };
}

export function ProjectDeparture({
  project,
  onConfirm,
  onLoadExample,
  onReady,
  activeCycle,
  completedCycles,
}: ProjectDepartureProps) {
  const [phase, setPhase] = useState<DeparturePhase>(() => completedCycles.length > 0 && activeCycle ? "briefing" : "input");
  const [idea, setIdea] = useState(project.description);
  const ideaInputRef = useRef<HTMLTextAreaElement>(null);
  const destination = destinations[0];
  const [draft, setDraft] = useState<AiProjectDraft | null>(null);
  const [clarificationRound, setClarificationRound] = useState(0);
  const [clarificationAnswers, setClarificationAnswers] = useState<string[]>([]);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [source, setSource] = useState<"ai" | "fallback">("fallback");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGuidedInput, setShowGuidedInput] = useState(false);
  const [guidedIdea, setGuidedIdea] = useState({ user: "", problem: "", method: "", outcome: "", resources: "" });
  const clarificationSteps = useMemo(
    () => draft ? buildClarificationSteps(idea, draft) : [],
    [draft, idea],
  );
  async function analyzeIdea(extraContext = "", suppliedIdea = idea) {
    const normalizedIdea = suppliedIdea.trim();
    if (normalizedIdea.length < 8) {
      setError("请至少用一句完整的话描述你想做什么、帮助谁或解决什么问题。");
      return;
    }
    setError("");
    setLoading(true);
    const request = buildIntakeRequest(`${normalizedIdea}\n本轮希望：${destination}${extraContext}`);
    const response = buildFallbackCoachResponse(request, "比赛演示预设分析：未连接外部大模型，结果由本地规则稳定生成。");
    const nextDraft = response.data.projectDraft;
    if (!nextDraft) {
      setError("项目拆解没有返回完整结构，请稍后重试。");
      setLoading(false);
      return;
    }
    setDraft(nextDraft);
    setClarificationRound(0);
    setClarificationAnswers([]);
    setClarificationAnswer("");
    setSource("fallback");
    setPhase("clarify");
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

  function importGuidedIdea() {
    const normalized = `我想帮${guidedIdea.user || "一类具体用户"}解决${guidedIdea.problem || "一个反复出现的问题"}，通过${guidedIdea.method || "一个更低成本的方式"}，让他们可以${guidedIdea.outcome || "更快获得明确结果"}${guidedIdea.resources ? `。我目前能使用的资源是：${guidedIdea.resources}` : ""}。`;
    setIdea(normalized);
    setShowGuidedInput(false);
    window.requestAnimationFrame(() => ideaInputRef.current?.focus());
  }

  function submitClarification() {
    const answer = clarificationAnswer.trim();
    if (!answer) {
      setError("请选择一个快捷答案，或补充你自己的答案后再继续。");
      return;
    }

    const answers = [...clarificationAnswers, answer];
    setError("");
    if (clarificationRound === clarificationSteps.length - 1 && draft) {
      const clarifiedDraft = applyClarifications(draft, idea, answers);
      setClarificationAnswers(answers);
      setDraft(clarifiedDraft);
      setClarificationAnswer("");
      const nextProject: Project = {
        ...project,
        ...clarifiedDraft,
        id: project.description.trim() === idea.trim() && project.id ? project.id : crypto.randomUUID(),
        hasDemo: clarifiedDraft.currentStage === "demo" || clarifiedDraft.currentStage === "mvp" || clarifiedDraft.currentStage === "growth",
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
      onReady();
      return;
    }

    setClarificationAnswers(answers);
    setClarificationAnswer("");
    setClarificationRound((current) => current + 1);
  }

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
              <aside className="cycleBriefingFacts" aria-label="本轮继承信息">
                <div><span>已完成轮次</span><strong>{completedCycles.length}</strong></div>
                <div><span>历史证据</span><strong>继续保留</strong></div>
                <div><span>本轮策略</span><strong>聚焦一个目标</strong></div>
              </aside>
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
              <span className="routeEyebrow">项目起点</span>
              <h1>从一个想法开始。</h1>
              <p>说清你想做什么。AI 负责拆解问题、风险和行动路线；是否继续前进，只由真实用户行为决定。</p>
              <ul className="departureValueList">
                <li><Sparkles size={16} />AI 把一句话拆成待验证假设</li>
                <li><Route size={16} />给出低成本、可证伪的行动路线</li>
                <li><Check size={16} />现实证据决定灯号与下一阶段</li>
              </ul>
            </div>

            <div className="ideaConsole">
              <label className="ideaField">
                <span>我想做一个</span>
                <textarea
                  ref={ideaInputRef}
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  placeholder="用一句话说清你的想法，例如：帮网购买衣服的年轻女性预览上身效果，减少买错和退货。"
                />
              </label>
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
                    <button className="secondaryButton" type="button" onClick={importGuidedIdea}>一键导入到上方聊天框</button>
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

          </motion.section>
        )}

        {phase === "clarify" && draft && clarificationSteps[clarificationRound] && (
          <motion.section key="clarify" className="clarificationJourney" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <header className="clarificationJourneyHeader">
              <div>
                <span className="manifestStep"><BrainCircuit size={16} />AI 理清中 · 第 {clarificationRound + 1}/3 轮</span>
                <h1>每次只确认一个会影响验证路线的问题。</h1>
                <p>这不是普通聊天。你的回答会决定项目优先服务谁、验证什么，以及先用什么资源获得外部反馈。</p>
              </div>
              <div className={`aiSourceMark source-${source}`}><Sparkles size={16} />比赛预设分析流程</div>
            </header>

            <ol className="clarificationProgress" aria-label="AI 理清进度">
              {clarificationSteps.map((step, index) => (
                <li key={step.question} className={index === clarificationRound ? "active" : index < clarificationRound ? "done" : ""}>
                  <span>{index < clarificationRound ? <Check size={15} /> : index + 1}</span><b>关键问题 {index + 1}</b>
                </li>
              ))}
            </ol>

            <article className="clarificationQuestionCard">
              <span>AI 追问</span>
              <h2>{clarificationSteps[clarificationRound].question}</h2>
              <p>{clarificationSteps[clarificationRound].hint}</p>
              <div className="clarificationChoices" aria-label="快捷答案">
                {clarificationSteps[clarificationRound].options.map((option) => (
                  <button key={option} type="button" className={clarificationAnswer === option ? "selected" : ""} onClick={() => setClarificationAnswer(option)}>{option}</button>
                ))}
              </div>
              <label className="clarificationCustomAnswer">
                <span>自己补充（可替代上方选项）</span>
                <input value={clarificationAnswer} onChange={(event) => setClarificationAnswer(event.target.value)} placeholder="例如：我已有 5 位经常网购服装的朋友愿意试用" />
              </label>
              {error && <p className="ideaError">{error}</p>}
              <footer>
                <small>已记录 {clarificationAnswers.length} 条回答。AI 不会把这里的回答直接当作真实用户证据。</small>
                <button className="primaryButton" type="button" onClick={submitClarification}>{clarificationRound === 2 ? <><BrainCircuit size={17} />完成理清，进入路线总览</> : <><ArrowRight size={17} />确认并进入下一问</>}</button>
              </footer>
            </article>
          </motion.section>
        )}

      </AnimatePresence>
    </div>
  );
}
