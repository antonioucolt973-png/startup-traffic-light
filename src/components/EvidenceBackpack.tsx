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
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { evidenceTypeLabels } from "../lib/labels";
import type { EvidenceRecord, ValidationTask } from "../types";

interface EvidenceBackpackProps {
  records: EvidenceRecord[];
  tasks: ValidationTask[];
  onUpdate: (record: EvidenceRecord) => void;
  onExclude: (record: EvidenceRecord) => void;
  onOpenTask: (taskId?: string) => void;
}

export function EvidenceBackpack({ records, tasks, onUpdate, onExclude, onOpenTask }: EvidenceBackpackProps) {
  const [expandedId, setExpandedId] = useState<string | null>(records[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBehavior, setEditingBehavior] = useState("");
  const [editingNote, setEditingNote] = useState("");
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
    setEditingId(null);
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

      <aside className="backpackRule"><ShieldCheck size={17} /><p><strong>证据规则</strong>只有任务执行后提交的用户行为记录，经过审核确认后才会计入证据充分度。不能在背包里手动把证据改成“已确认”。</p></aside>

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
                          <section className="evidenceAssessment"><span>AI证据质量评估 · 比赛预设规则</span><p>{record.assessment || (record.reviewStatus === "confirmed" ? "该记录包含真实行为和数量，已作为现实证据确认。" : "该记录仍缺少足够的行为、数量或可复核材料。")}</p></section>
                        </>}
                        <footer className="backpackRecordActions">
                          <button type="button" onClick={() => startEdit(record)}><PencilLine size={14} />修改说明</button>
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
