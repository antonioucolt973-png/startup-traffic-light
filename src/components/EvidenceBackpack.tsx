import {
  ArrowRight,
  Backpack,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  FileAudio,
  FileImage,
  FileText,
  Flag,
  Link2,
  MessageSquareQuote,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { isCompetitionPresetIdea } from "../data/competitionPreset";
import { requestAiCoach } from "../lib/aiClient";
import { buildFallbackCoachResponse } from "../lib/aiFallback";
import type { AiCoachData, AiCoachRequest } from "../lib/aiSchemas";
import { evidenceTypeLabels } from "../lib/labels";
import type { EvidenceRecord, Project, ValidationTask } from "../types";

interface EvidenceBackpackProps {
  project: Project;
  records: EvidenceRecord[];
  tasks: ValidationTask[];
  onUpdate: (record: EvidenceRecord) => void;
  onConfirm: (record: EvidenceRecord) => void;
  onExclude: (record: EvidenceRecord) => void;
  onOpenTask: (taskId?: string) => void;
}

type EvidenceReview = NonNullable<AiCoachData["evidenceReview"]>;

export function EvidenceBackpack({ project, records, tasks, onUpdate, onConfirm, onExclude, onOpenTask }: EvidenceBackpackProps) {
  const [expandedId, setExpandedId] = useState<string | null>(records[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBehavior, setEditingBehavior] = useState("");
  const [editingNote, setEditingNote] = useState("");
  const [evaluations, setEvaluations] = useState<Record<string, EvidenceReview>>({});
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [evaluationMessages, setEvaluationMessages] = useState<Record<string, string>>({});
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const grouped = useMemo(() => groupEvidence(records, tasks), [records, tasks]);
  const stats = useMemo(() => ({
    total: records.length,
    confirmed: records.filter((record) => record.reviewStatus === "confirmed").length,
    pending: records.filter((record) => record.reviewStatus === "pending").length,
    rejected: records.filter((record) => record.reviewStatus === "rejected").length,
  }), [records]);

  function startEdit(record: EvidenceRecord) {
    setEditingId(record.id);
    setEditingBehavior(record.behavior);
    setEditingNote(record.note);
  }

  function saveEdit(record: EvidenceRecord) {
    if (!editingBehavior.trim()) return;
    onUpdate({ ...record, behavior: editingBehavior.trim(), note: editingNote.trim() });
    setEvaluations((current) => {
      const next = { ...current };
      delete next[record.id];
      return next;
    });
    setEvaluationMessages((current) => {
      const next = { ...current };
      delete next[record.id];
      return next;
    });
    setEditingId(null);
  }

  async function evaluateRecord(record: EvidenceRecord) {
    if (evaluatingId) return;
    setEvaluatingId(record.id);
    const task = record.taskId ? taskMap.get(record.taskId) : undefined;
    const request = buildEvidenceRequest(project, record, task);
    const immediate = buildFallbackCoachResponse(request, "已先显示本地证据预检，MiMo 正在后台核对结构化摘要。");
    if (immediate.data.evidenceReview) setEvaluations((current) => ({ ...current, [record.id]: immediate.data.evidenceReview! }));
    setEvaluationMessages((current) => ({ ...current, [record.id]: immediate.notice ?? "" }));
    const response = await requestAiCoach(request, {
      strategy: isCompetitionPresetIdea(project, project.description) ? "preset-only" : "live-first",
      cacheKey: `evidence:${project.id}:${record.id}:${record.behavior}:${record.quantity}:${record.userQuote ?? ""}:${record.attachmentName ?? ""}`,
    });
    if (response.data.evidenceReview) setEvaluations((current) => ({ ...current, [record.id]: response.data.evidenceReview! }));
    setEvaluationMessages((current) => ({ ...current, [record.id]: response.notice || (response.source === "ai" ? "MiMo 已更新证据质量建议。" : "当前使用本地证据预检。") }));
    setEvaluatingId(null);
  }

  function confirmStructuredEvidence(record: EvidenceRecord) {
    const evaluation = evaluations[record.id];
    if (!evaluation || !record.verifiable) return;
    onConfirm({
      ...record,
      behavior: evaluation.extracted.behavior,
      quantity: evaluation.extracted.quantity,
      userQuote: evaluation.extracted.userQuote,
      reviewStatus: "confirmed",
      assessment: `${qualityLabel(evaluation.quality)}：${evaluation.explanation} 用户已核对并确认该结构化证据。`,
    });
  }

  return (
    <div className="evidenceBackpackScreen taskEvidenceBackpack">
      <header className="taskBackpackHeader">
        <div><span>证据背包</span><h1>任务做完以后，把真实发生的结果收进来。</h1><p>这里只保存任务产生的现实记录。AI分析、项目计划和个人推测不会自动进入背包，也不会直接改变项目灯号。</p></div>
        <div className="backpackCounter"><Backpack size={44} /><strong>{stats.total}</strong><span>条证据记录</span></div>
      </header>

      <section className="evidenceStatusSummary">
        <article><Backpack size={18} /><div><span>证据总数</span><strong>{stats.total}</strong></div></article>
        <article className="confirmed"><ShieldCheck size={18} /><div><span>已确认</span><strong>{stats.confirmed}</strong></div></article>
        <article className="pending"><CircleAlert size={18} /><div><span>需要补证</span><strong>{stats.pending}</strong></div></article>
        <article className="rejected"><ShieldX size={18} /><div><span>已排除</span><strong>{stats.rejected}</strong></div></article>
      </section>

      <aside className="backpackRule"><ShieldCheck size={17} /><p><strong>证据规则</strong>AI只提取行为、数量、原话和材料类型并给出建议；只有通过本地规则预检、再由用户核对确认的记录，才会计入证据充分度并影响后续灯号。</p></aside>

      {records.length === 0 ? (
        <section className="taskBackpackEmpty"><Backpack size={38} /><h2>背包还是空的</h2><p>先完成访谈、试用、报价或付费验证任务，再提交截图、文件、数据或录音。</p><button className="primaryButton" type="button" onClick={() => onOpenTask()}>前往任务执行<ArrowRight size={16} /></button></section>
      ) : (
        <div className="milestoneEvidenceGroups">
          {grouped.map((group) => (
            <section key={group.id} className="milestoneEvidenceGroup">
              <header><Flag size={17} /><div><h2>{group.title}</h2><p>{group.records.length} 条任务证据</p></div></header>
              <div className="taskEvidenceRecordList">
                {group.records.map((record) => {
                  const task = record.taskId ? taskMap.get(record.taskId) : undefined;
                  const expanded = expandedId === record.id;
                  return (
                    <article key={record.id} className={`taskEvidenceRecord review-${record.reviewStatus}`}>
                      <button className="taskEvidenceRecordHeader" type="button" onClick={() => setExpandedId((current) => current === record.id ? null : record.id)}>
                        <span className="recordTypeIcon">{attachmentIcon(record)}</span>
                        <span className="recordMain"><small>{task ? `${task.milestoneTitle} · ${cleanTaskTitle(task.title)}` : "历史证据"}</small><strong>{evidenceTypeLabels[record.type]}</strong><em>{record.behavior}</em></span>
                        <span className={`recordReviewBadge ${record.reviewStatus}`}>{reviewLabel(record.reviewStatus)}</span>
                        <ChevronDown className={expanded ? "open" : ""} size={17} />
                      </button>

                      {expanded ? <div className="taskEvidenceRecordBody">
                        {editingId === record.id ? <div className="backpackEvidenceEdit"><label><span>实际发生了什么</span><textarea value={editingBehavior} onChange={(event) => setEditingBehavior(event.target.value)} /></label><label><span>补充说明</span><textarea value={editingNote} onChange={(event) => setEditingNote(event.target.value)} /></label><footer><button type="button" onClick={() => setEditingId(null)}>取消</button><button type="button" onClick={() => saveEdit(record)}>保存修改</button></footer></div> : <>
                          <div className="evidenceFactGrid">
                            <article><UsersRound size={16} /><span>样本数量</span><strong>{record.quantity} 人/次</strong></article>
                            <article><CalendarDays size={16} /><span>提交时间</span><strong>{formatDate(record.occurredAt)}</strong></article>
                            <article><Link2 size={16} /><span>证明材料</span><strong>{record.attachmentName || "未提供附件"}</strong></article>
                          </div>
                          <section className="evidenceRealityStory"><span>实际发生的行为</span><p>{record.behavior}</p></section>
                          {record.userQuote ? <section className="evidenceUserQuote"><MessageSquareQuote size={18} /><div><span>用户原话</span><blockquote>{record.userQuote}</blockquote></div></section> : null}
                          {record.note ? <section className="evidenceDataNote"><FileText size={17} /><div><span>数据或补充记录</span><p>{record.note}</p></div></section> : null}
                          <section className="evidenceAssessment"><span>AI证据质量评估 · 仅供用户审核</span><p>{record.assessment || (record.reviewStatus === "confirmed" ? "该记录已经用户确认并进入规则引擎。" : "该记录尚未经过结构化提取与用户确认。")}</p></section>
                          {evaluations[record.id] ? <EvidenceReviewCard review={evaluations[record.id]} message={evaluationMessages[record.id]} /> : null}
                        </>}
                        <footer className="backpackRecordActions">
                          <button type="button" onClick={() => startEdit(record)}><PencilLine size={14} />修改说明</button>
                          {record.reviewStatus === "pending" ? <button type="button" disabled={evaluatingId === record.id} onClick={() => void evaluateRecord(record)}><Sparkles size={14} />{evaluatingId === record.id ? "MiMo后台核对中…" : "AI整理并评估"}</button> : null}
                          {record.reviewStatus === "pending" && evaluations[record.id] && record.verifiable ? <button type="button" onClick={() => confirmStructuredEvidence(record)}><ShieldCheck size={14} />确认结构化证据</button> : null}
                          {record.reviewStatus === "pending" ? <button type="button" onClick={() => onOpenTask(record.taskId)}><RotateCcw size={14} />补充证据</button> : null}
                          {record.taskId ? <button type="button" onClick={() => onOpenTask(record.taskId)}>返回对应任务<ArrowRight size={14} /></button> : null}
                          {record.reviewStatus !== "rejected" ? <button className="rejectEvidenceButton" type="button" onClick={() => onExclude(record)}><ShieldX size={14} />排除无效证据</button> : null}
                        </footer>
                      </div> : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceReviewCard({ review, message }: { review: EvidenceReview; message?: string }) {
  return <section className={`structuredEvidenceReview quality-${review.quality}`}><header><Sparkles size={16} /><strong>{qualityLabel(review.quality)}</strong><span>{message}</span></header><dl><div><dt>提取行为</dt><dd>{review.extracted.behavior}</dd></div><div><dt>人数/次数</dt><dd>{review.extracted.quantity}</dd></div><div><dt>用户原话</dt><dd>{review.extracted.userQuote || "未提供"}</dd></div><div><dt>材料类型</dt><dd>{review.extracted.materialType}</dd></div></dl>{review.missing.length ? <div><strong>仍缺少</strong><ul>{review.missing.map((item) => <li key={item}>{item}</li>)}</ul></div> : <p>{review.explanation}</p>}{review.supplementation.length ? <aside><strong>补证建议</strong>{review.supplementation.join("；")}</aside> : null}</section>;
}

function buildEvidenceRequest(project: Project, record: EvidenceRecord, task?: ValidationTask): AiCoachRequest {
  return {
    mode: "evidence_review",
    project: pickAiProject(project),
    evidence: { interviewCount: 0, activeInterestCount: 0, trialCount: 0, paymentCount: 0, hasRetention: false },
    stageContext: {
      record: {
        behavior: record.behavior,
        quantity: record.quantity,
        frequency: `${record.quantity} 人/次`,
        userQuote: record.userQuote ?? "",
        materialType: record.attachmentName ? `${record.attachmentType ?? "file"}：${record.attachmentName}` : "未提供可复核材料",
        verifiable: record.verifiable,
      },
      task: task ? { title: task.title, passCriteria: task.passCriteria, stopCriteria: task.stopCriteria } : undefined,
    },
  };
}

function pickAiProject(project: Project): AiCoachRequest["project"] {
  return { name: project.name, description: project.description, targetUser: project.targetUser, painPoint: project.painPoint, alternative: project.alternative, acquisition: project.acquisition, monetization: project.monetization, currentStage: project.currentStage, existingArtifact: project.existingArtifact, biggestUncertainty: project.biggestUncertainty };
}

function qualityLabel(quality: EvidenceReview["quality"]) {
  return { insufficient: "证据不足", reviewable: "可人工确认", strong: "较强证据候选" }[quality];
}

function groupEvidence(records: EvidenceRecord[], tasks: ValidationTask[]) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const groups = new Map<string, { id: string; title: string; records: EvidenceRecord[] }>();
  records.forEach((record) => {
    const task = record.taskId ? taskMap.get(record.taskId) : undefined;
    const id = record.milestoneId || task?.milestoneId || "legacy";
    const title = task?.milestoneTitle || (id === "legacy" ? "历史与其他证据" : "验证里程碑");
    const group = groups.get(id) ?? { id, title, records: [] };
    group.records.push(record);
    groups.set(id, group);
  });
  return [...groups.values()].map((group) => ({ ...group, records: group.records.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) }));
}

function attachmentIcon(record: EvidenceRecord) {
  if (record.attachmentType === "audio") return <FileAudio size={18} />;
  if (record.attachmentType === "screenshot") return <FileImage size={18} />;
  return <FileText size={18} />;
}

function reviewLabel(status: EvidenceRecord["reviewStatus"]) {
  if (status === "confirmed") return "已确认";
  if (status === "rejected") return "已排除";
  return "需要补证";
}

function cleanTaskTitle(title: string) {
  return title.replace(/^M\d+[^·]*·\s*/, "").replace(/^第\s*\d+\s*天\s*·\s*/, "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
