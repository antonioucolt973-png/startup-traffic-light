import {
  AlertTriangle,
  ArrowRight,
  Backpack,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileAudio,
  FileImage,
  FileText,
  Flag,
  Hammer,
  ListChecks,
  LockKeyhole,
  Paperclip,
  SkipForward,
  Sparkles,
  Target,
  Upload,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { EvidenceRecord, EvidenceType, Project, ValidationTask } from "../types";

interface NextRouteProps {
  project: Project;
  tasks: ValidationTask[];
  records: EvidenceRecord[];
  initialTaskId?: string;
  onUpdateTask: (task: ValidationTask) => void;
  onSubmitEvidence: (task: ValidationTask, record: EvidenceRecord, unlockNext: boolean) => void;
  onUnlockNext: (taskId: string) => void;
  onOpenBackpack: () => void;
}

type SubmissionType = "screenshot" | "file" | "data" | "audio";
type ReviewResult = { sufficient: boolean; message: string; missing: string[]; milestoneReached?: boolean; record?: EvidenceRecord };

const submissionOptions: Array<{ id: SubmissionType; label: string; icon: typeof FileImage }> = [
  { id: "screenshot", label: "上传截图", icon: FileImage },
  { id: "file", label: "上传文件", icon: FileText },
  { id: "data", label: "粘贴数据", icon: Paperclip },
  { id: "audio", label: "上传录音", icon: FileAudio },
];

export function NextRoute({
  project,
  tasks,
  records,
  initialTaskId,
  onUpdateTask,
  onSubmitEvidence,
  onUnlockNext,
  onOpenBackpack,
}: NextRouteProps) {
  const firstAvailable = tasks.find((task) => task.workflowStatus !== "locked" && task.workflowStatus !== "completed" && task.workflowStatus !== "skipped") ?? tasks[0];
  const [activeTaskId, setActiveTaskId] = useState(initialTaskId || firstAvailable?.id || "");
  const [openTool, setOpenTool] = useState<string | null>(null);
  const [submissionType, setSubmissionType] = useState<SubmissionType>("screenshot");
  const [behavior, setBehavior] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [userQuote, setUserQuote] = useState("");
  const [pastedData, setPastedData] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [actionMode, setActionMode] = useState<"difficulty" | "delay" | "skip" | null>(null);
  const [actionText, setActionText] = useState("");
  const [delayDate, setDelayDate] = useState("");

  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? firstAvailable;
  const completedCount = tasks.filter((task) => task.workflowStatus === "completed").length;
  const milestoneGroups = useMemo(() => groupTasks(tasks), [tasks]);
  const taskEvidence = activeTask ? records.filter((record) => record.taskId === activeTask.id) : [];

  function resetSubmission() {
    setBehavior("");
    setQuantity(1);
    setUserQuote("");
    setPastedData("");
    setAttachmentName("");
    setReviewResult(null);
  }

  function chooseTask(task: ValidationTask) {
    if (task.workflowStatus === "locked") return;
    setActiveTaskId(task.id);
    setOpenTool(null);
    setActionMode(null);
    setActionText("");
    resetSubmission();
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function submitForReview() {
    if (!activeTask) return;
    const missing: string[] = [];
    if (behavior.trim().length < 12) missing.push("写清楚实际发生的用户行为");
    if (quantity < 1) missing.push("填写有效人数或次数");
    if (userQuote.trim().length < 6) missing.push("补充一条用户原话或明确反馈");
    if (submissionType === "data" ? pastedData.trim().length < 8 : !attachmentName) missing.push(submissionType === "data" ? "粘贴可核对的数据" : "选择一个证明材料");
    const sufficient = missing.length === 0 && quantity >= minimumQuantity(activeTask);
    if (!sufficient && quantity < minimumQuantity(activeTask)) missing.push(`当前建议至少记录 ${minimumQuantity(activeTask)} 人或次`);

    const record: EvidenceRecord = {
      id: `${Date.now()}-${activeTask.id}`,
      projectId: project.id,
      taskId: activeTask.id,
      milestoneId: activeTask.milestoneId,
      type: inferEvidenceType(activeTask),
      occurredAt: new Date().toISOString(),
      actor: project.targetUser || "目标用户",
      behavior: behavior.trim() || "尚未补充完整的现实行为记录",
      quantity: Math.max(1, quantity),
      source: "user_behavior",
      note: pastedData.trim(),
      url: "",
      verifiable: sufficient,
      reviewStatus: sufficient ? "confirmed" : "pending",
      origin: "task",
      rawRecordIds: [],
      attachmentType: submissionType,
      attachmentName: submissionType === "data" ? "已粘贴数据" : attachmentName,
      userQuote: userQuote.trim(),
      assessment: sufficient
        ? "证据包含明确对象、实际行为、数量、用户原话和可复核材料，达到本任务的比赛预设审核要求。"
        : `证据已收到，但仍需补充：${missing.join("、")}。`,
    };
    const nextTask = { ...activeTask, status: sufficient ? "completed" as const : "pending" as const, workflowStatus: sufficient ? "completed" as const : "needs_evidence" as const, result: behavior.trim(), evidenceIds: [...activeTask.evidenceIds, record.id] };
    const milestoneReached = sufficient && tasks.filter((task) => task.milestoneId === activeTask.milestoneId && task.id !== activeTask.id).every((task) => task.workflowStatus === "completed" || task.workflowStatus === "skipped");
    onSubmitEvidence(nextTask, record, sufficient);
    setReviewResult({
      sufficient,
      message: sufficient ? milestoneReached ? `你真棒！${activeTask.milestoneTitle || "当前里程碑"}达成！` : "你真棒！当前任务的证据已通过，下一项任务已经解锁。" : "证据收到，但似乎还需要更多数据支撑。",
      missing,
      milestoneReached,
      record,
    });
  }

  function handleTaskAction() {
    if (!activeTask || !actionMode) return;
    if (actionMode === "difficulty") {
      onUpdateTask({ ...activeTask, status: "failed", workflowStatus: "blocked", difficulty: actionText.trim() || "执行过程中遇到困难" });
    } else if (actionMode === "delay") {
      onUpdateTask({ ...activeTask, status: "pending", workflowStatus: "delayed", delayReason: actionText.trim() || "需要调整执行时间", delayedUntil: delayDate });
    } else {
      onUpdateTask({ ...activeTask, status: "failed", workflowStatus: "skipped", result: actionText.trim() || "用户选择跳过本任务" });
      onUnlockNext(activeTask.id);
    }
    setActionMode(null);
    setActionText("");
    setDelayDate("");
  }

  if (!activeTask) {
    return <div className="nextRouteScreen taskExecutionScreen"><section className="taskEmptyState"><ListChecks size={34} /><h1>还没有执行任务。</h1><p>请先在路口决策中确认路线地图。</p></section></div>;
  }

  return (
    <div className="nextRouteScreen taskExecutionScreen">
      <header className="taskExecutionHeader">
        <div><span>任务执行与证据提交</span><h1>一次完成一个真实任务，再用证据决定是否前进。</h1><p>任务打勾不等于验证成功。提交用户行为、数量和可复核材料后，系统才会判断是否解锁下一项任务。</p></div>
        <article><strong>{completedCount}<small>/{tasks.length}</small></strong><span>已通过任务</span><i><b style={{ width: `${tasks.length ? Math.round(completedCount / tasks.length * 100) : 0}%` }} /></i><button type="button" onClick={onOpenBackpack}><Backpack size={15} />查看证据背包</button></article>
      </header>

      <section className="missionNavigator" aria-label="任务里程碑导览">
        {milestoneGroups.map((group) => <article key={group.id}><header><Flag size={15} /><div><span>{group.title}</span><small>{group.completed}/{group.tasks.length} 完成</small></div></header><div>{group.tasks.map((task, index) => <button key={task.id} className={`${task.id === activeTask.id ? "active" : ""} status-${task.workflowStatus ?? "ready"}`} type="button" disabled={task.workflowStatus === "locked"} onClick={() => chooseTask(task)} title={cleanTaskTitle(task.title)}><i>{task.workflowStatus === "completed" ? <Check size={12} /> : task.workflowStatus === "locked" ? <LockKeyhole size={11} /> : index + 1}</i><span>{cleanTaskTitle(task.title)}</span><em>{workflowLabel(task)}</em></button>)}</div></article>)}
      </section>

      <article className={`executionTaskCard status-${activeTask.workflowStatus ?? "ready"}`}>
        <header className="executionTaskTitle"><div><span>任务 {taskNumber(tasks, activeTask)}</span><h2>{cleanTaskTitle(activeTask.title)}</h2></div><strong>{workflowLabel(activeTask)}</strong></header>

        <section className="taskCardBlock taskGoalBlock"><Target size={20} /><div><h3>目标</h3><p>{activeTask.target || activeTask.detail}</p></div></section>

        <section className="taskCardBlock"><ListChecks size={20} /><div><h3>具体动作</h3><ol>{(activeTask.actions?.length ? activeTask.actions : [activeTask.detail]).map((action) => <li key={action}>{action}</li>)}</ol></div></section>

        <section className="taskCardBlock taskToolsBlock"><Wrench size={20} /><div><h3>执行工具（点击获取）</h3><div className="executionToolList">{(activeTask.tools ?? []).map((tool) => <article key={tool.title}><button type="button" onClick={() => setOpenTool((current) => current === tool.title ? null : tool.title)}><FileText size={15} /><span>{tool.title}</span><ChevronDown size={14} /></button>{openTool === tool.title ? <div><p>{tool.content}</p><button type="button" onClick={() => void navigator.clipboard?.writeText(tool.content)}>复制模板</button></div> : null}</article>)}</div></div></section>

        <section className="taskFactsRow"><div><Clock3 size={16} /><span>预计耗时</span><strong>{activeTask.duration || "3天"}</strong></div><div><Hammer size={16} /><span>预计成本</span><strong>{activeTask.estimatedCost || "¥0（使用免费工具）"}</strong></div><div><Target size={16} /><span>成功标准</span><strong>{activeTask.passCriteria}</strong></div></section>

        <section className="evidenceSubmissionSection">
          <header><Upload size={19} /><div><h3>提交证据</h3><p>选择一种证明材料，并写清楚实际发生了什么。</p></div></header>
          <div className="submissionTypeTabs">{submissionOptions.map((option) => { const Icon = option.icon; return <button key={option.id} className={submissionType === option.id ? "active" : ""} type="button" onClick={() => { setSubmissionType(option.id); setAttachmentName(""); }}><Icon size={15} />{option.label}</button>; })}</div>
          <div className="evidenceSubmissionForm">
            <label className="wide"><span>实际发生了什么</span><textarea value={behavior} onChange={(event) => setBehavior(event.target.value)} placeholder="例如：访谈5位目标用户，其中4人说下单前会反复看买家秀，3人愿意上传照片体验。" /></label>
            <label><span>涉及人数或次数</span><input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></label>
            <label><span>用户原话或明确反馈</span><input value={userQuote} onChange={(event) => setUserQuote(event.target.value)} placeholder="例如：如果不用退货，我愿意先试一次。" /></label>
            {submissionType === "data" ? <label className="wide"><span>粘贴数据</span><textarea value={pastedData} onChange={(event) => setPastedData(event.target.value)} placeholder="姓名可匿名；粘贴人数、选项统计、访谈摘要或测试结果。" /></label> : <label className="wide fileEvidenceInput"><span>{submissionOptions.find((item) => item.id === submissionType)?.label}</span><input type="file" accept={submissionType === "screenshot" ? "image/*" : submissionType === "audio" ? "audio/*" : undefined} onChange={(event) => setAttachmentName(event.target.files?.[0]?.name ?? "")} /><i><Upload size={16} />{attachmentName || "选择本地文件（比赛版只记录文件名）"}</i></label>}
          </div>
          {taskEvidence.length > 0 ? <p className="taskEvidenceCount"><Backpack size={14} />本任务已产生 {taskEvidence.length} 条证据记录</p> : null}
        </section>

        {reviewResult ? <section className={`evidenceReviewResult ${reviewResult.sufficient ? "sufficient" : "insufficient"}`}>
          {reviewResult.sufficient ? <CheckCircle2 size={27} /> : <AlertTriangle size={27} />}
          <div><span>{reviewResult.sufficient ? "证据充分" : "证据不足"}</span><h3>{reviewResult.message}</h3>{reviewResult.missing.length ? <ul>{reviewResult.missing.map((item) => <li key={item}>{item}</li>)}</ul> : <p>行动积分 +20，项目车继续前进，下一任务已解锁。只有这条已确认的现实证据会影响后续灯号。</p>}</div>
          {!reviewResult.sufficient ? <div className="reviewResultActions"><button type="button" onClick={() => setReviewResult(null)}>补充证据</button><button type="button" onClick={() => { onUnlockNext(activeTask.id); setReviewResult(null); }}>先继续</button><button type="button" onClick={() => { setActionMode("difficulty"); setReviewResult(null); }}>求助</button></div> : <button type="button" onClick={() => { const next = nextAvailableTask(tasks, activeTask.id); if (next) chooseTask(next); }}>进入下一任务<ArrowRight size={15} /></button>}
        </section> : null}

        {actionMode ? <section className="taskActionComposer"><div><CircleHelp size={21} /><span><strong>{actionMode === "difficulty" ? "遇到困难" : actionMode === "delay" ? "延期执行" : "跳过这步"}</strong><small>{actionMode === "difficulty" ? "没关系，创业就是不断试错。我们来看看出了什么问题。" : "请留下原因，系统会保留这次决定。"}</small></span></div><textarea value={actionText} onChange={(event) => setActionText(event.target.value)} placeholder={actionMode === "difficulty" ? "例如：联系不到目标用户、用户拒绝上传照片、Demo效果不稳定。" : "填写延期或跳过原因。"} />{actionMode === "delay" ? <label><span>延期到</span><input type="date" value={delayDate} onChange={(event) => setDelayDate(event.target.value)} /></label> : null}<footer><button type="button" onClick={() => setActionMode(null)}>取消</button><button type="button" onClick={handleTaskAction}>确认记录</button></footer>{actionMode === "difficulty" ? <aside><Sparkles size={16} /><p><strong>比赛预设替代方案</strong>把目标从5人缩小到3人，先从已有朋友开始；如果仍无法完成，返回上一任务检查目标用户是否过宽。</p></aside> : null}</section> : null}

        <footer className="executionTaskActions"><button className="completeTaskButton" type="button" onClick={submitForReview}><Check size={15} />标记完成</button><button type="button" onClick={() => setActionMode("difficulty")}><CircleHelp size={15} />遇到困难</button><button type="button" onClick={() => setActionMode("delay")}><CalendarClock size={15} />延期执行</button><button type="button" onClick={() => setActionMode("skip")}><SkipForward size={15} />跳过这步</button></footer>
      </article>
    </div>
  );
}

function groupTasks(tasks: ValidationTask[]) {
  const groups = new Map<string, { id: string; title: string; tasks: ValidationTask[]; completed: number }>();
  tasks.forEach((task) => {
    const id = task.milestoneId || "m1";
    const group = groups.get(id) ?? { id, title: task.milestoneTitle || "M1 验证任务", tasks: [], completed: 0 };
    group.tasks.push(task);
    if (task.workflowStatus === "completed") group.completed += 1;
    groups.set(id, group);
  });
  return [...groups.values()];
}

function minimumQuantity(task: ValidationTask) {
  if (task.title.includes("20")) return 5;
  if (task.title.includes("10")) return 3;
  return 3;
}

function inferEvidenceType(task: ValidationTask): EvidenceType {
  if (task.milestoneId === "m1") return "interview";
  if (task.milestoneId === "m2") return "trial";
  if (task.milestoneId === "m3") return "active_interest";
  return task.title.includes("付费") ? "payment" : "quote";
}

function taskNumber(tasks: ValidationTask[], task: ValidationTask) {
  const sameMilestone = tasks.filter((item) => item.milestoneId === task.milestoneId);
  const milestoneIndex = [...new Set(tasks.map((item) => item.milestoneId))].indexOf(task.milestoneId) + 1;
  return `${Math.max(1, milestoneIndex)}.${sameMilestone.findIndex((item) => item.id === task.id) + 1}`;
}

function cleanTaskTitle(title: string) {
  return title.replace(/^M\d+[^·]*·\s*/, "").replace(/^第\s*\d+\s*天\s*·\s*/, "");
}

function workflowLabel(task: ValidationTask) {
  const labels: Record<NonNullable<ValidationTask["workflowStatus"]>, string> = {
    locked: "未解锁",
    ready: "当前任务",
    needs_evidence: "需要补证",
    delayed: "已延期",
    blocked: "遇到困难",
    skipped: "已跳过",
    completed: "证据已通过",
  };
  return labels[task.workflowStatus ?? "ready"];
}

function nextAvailableTask(tasks: ValidationTask[], taskId: string) {
  const index = tasks.findIndex((task) => task.id === taskId);
  return tasks[index + 1];
}
