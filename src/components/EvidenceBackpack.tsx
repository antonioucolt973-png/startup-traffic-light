import { BadgeDollarSign, Backpack, CalendarDays, Check, Edit3, Link2, MessageSquareText, MousePointerClick, Plus, Repeat2, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { evidenceSourceLabels, evidenceTypeLabels } from "../lib/labels";
import type { EvidenceRecord, EvidenceSource, EvidenceType, Project } from "../types";

interface EvidenceBackpackProps {
  project: Project;
  records: EvidenceRecord[];
  onAdd: (record: EvidenceRecord) => void;
  onRemove: (recordId: string) => void;
  onUpdate: (record: EvidenceRecord) => void;
}

const defaultSource: EvidenceSource = "user_behavior";

export function EvidenceBackpack({ project, records, onAdd, onRemove, onUpdate }: EvidenceBackpackProps) {
  const [type, setType] = useState<EvidenceType>("interview");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [actor, setActor] = useState("");
  const [behavior, setBehavior] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [source, setSource] = useState<EvidenceSource>(defaultSource);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [verifiable, setVerifiable] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBehavior, setEditingBehavior] = useState("");
  const [editingNote, setEditingNote] = useState("");
  const [showComposer, setShowComposer] = useState(false);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [records],
  );
  const inventory = useMemo(() => [
    { label: "探索记录", types: ["research", "interview", "problem_story", "test_post"] as EvidenceType[], icon: Search, tone: "blue" },
    { label: "主动意向", types: ["active_interest", "signup"] as EvidenceType[], icon: MessageSquareText, tone: "yellow" },
    { label: "试用行为", types: ["trial"] as EvidenceType[], icon: MousePointerClick, tone: "green" },
    { label: "交易信号", types: ["quote", "payment"] as EvidenceType[], icon: BadgeDollarSign, tone: "red" },
    { label: "复用增长", types: ["repeat", "referral"] as EvidenceType[], icon: Repeat2, tone: "violet" },
  ].map((item) => ({
    ...item,
    count: records.filter((record) => record.reviewStatus === "confirmed" && item.types.includes(record.type)).reduce((total, record) => total + record.quantity, 0),
  })), [records]);

  function addRecord() {
    if (!behavior.trim()) {
      setError("请写清楚实际发生了什么行为。");
      return;
    }
    onAdd({
      id: `${Date.now()}-${type}`,
      projectId: project.id,
      type,
      occurredAt: occurredAt || new Date().toISOString().slice(0, 10),
      actor: actor.trim() || "匿名目标用户",
      behavior: behavior.trim(),
      quantity: Math.max(1, quantity),
      source,
      note: note.trim(),
      url: url.trim(),
      verifiable,
      reviewStatus: "confirmed",
      origin: "manual",
      rawRecordIds: [],
    });
    setBehavior("");
    setActor("");
    setNote("");
    setUrl("");
    setQuantity(1);
    setVerifiable(false);
    setError("");
  }

  function beginEdit(record: EvidenceRecord) {
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
    <div className="evidenceBackpackScreen">
      <header className="backpackHeader">
        <div><span className="routeEyebrow">证据背包</span><h1>把现实反馈收进背包，项目车才有继续前进的燃料。</h1><p>背包只收已经发生的行为。访谈、主动留言、试用、报价、付款与复用，会按强度成为不同等级的证据。</p></div>
        <div className="backpackShellVisual" aria-label={`背包中有 ${records.length} 条记录`}><Backpack size={54} /><strong>{records.length}</strong><span>条现实记录</span><i /><i /><i /></div>
      </header>

      <section className="evidenceInventory" aria-label="证据背包分类">
        <div className="inventoryHeading"><div><span>背包库存</span><strong>{project.name || "当前项目"}</strong></div><button className="primaryButton" type="button" onClick={() => setShowComposer((value) => !value)}><Plus size={16} />{showComposer ? "收起录入" : "装入新证据"}</button></div>
        <div className="inventoryShelf">
          {inventory.map((item) => {
            const Icon = item.icon;
            return <article key={item.label} className={`inventoryItem tone-${item.tone}`}><div><Icon size={19} /><span>{item.label}</span></div><strong>{item.count}</strong><small>{item.count > 0 ? "已确认行为" : "等待收集"}</small></article>;
          })}
        </div>
        <p className="inventoryRule"><ShieldCheck size={14} />AI推测不会自动进入背包；问卷结果需要你核对摘要后确认计入。</p>
      </section>

      {showComposer && <section className="evidenceComposer">
        <div className="composerHeading"><div><Plus size={18} /><strong>添加一条现实证据</strong></div><span>链接不会发送给 AI</span></div>
        <div className="evidenceComposerGrid">
          <label><span>证据类型</span><select value={type} onChange={(event) => setType(event.target.value as EvidenceType)}>{Object.entries(evidenceTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>发生时间</span><input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label>
          <label><span>对象身份</span><input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="例如：3 位中小电商店主" /></label>
          <label><span>数量</span><input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
          <label className="wide"><span>具体行为</span><textarea value={behavior} onChange={(event) => setBehavior(event.target.value)} placeholder="例如：看完 60 秒演示后，有 2 位店主主动提供退货表格并预约下一次沟通" /></label>
          <label><span>证据来源</span><select value={source} onChange={(event) => setSource(event.target.value as EvidenceSource)}>{Object.entries(evidenceSourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>备注</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="拒绝原因、原话或补充背景" /></label>
          <label className="wide"><span>可选链接</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="问卷、截图、公开页面或文档链接" /></label>
          <label className="switchField wide"><input type="checkbox" checked={verifiable} onChange={(event) => setVerifiable(event.target.checked)} /><span>这条证据有记录、截图、链接或第三方可以复核</span></label>
        </div>
        {error && <p className="departureValidation">{error}</p>}
        <div className="composerActions"><span>AI 推测与个人假设会保留，但不会提高证据等级。</span><button className="primaryButton" onClick={addRecord} type="button"><Plus size={16} />放入背包</button></div>
      </section>}

      <section className="evidenceTimeline">
        <div className="timelineHeading"><div><span className="routeEyebrow">证据时间线</span><h2>{project.name || "当前项目"}的现实记录</h2></div><span>越接近试用、付款、复用，证据越强</span></div>
        {sortedRecords.length === 0 ? (
          <div className="evidenceEmpty"><Backpack size={30} /><strong>背包还是空的</strong><p>先完成一次访谈、公开测试或演示，再回来记录结果。</p></div>
        ) : (
          <div className="evidenceRecordList">
            {sortedRecords.map((record) => (
              <article key={record.id} className={`evidenceRecord source-${record.source} review-${record.reviewStatus}`}>
                <div className="evidenceRecordHead"><span>{evidenceTypeLabels[record.type]}</span><div className="recordHeadActions"><em>{record.reviewStatus === "pending" ? "待确认" : record.reviewStatus === "rejected" ? "已排除" : record.origin === "survey" ? "问卷已确认" : "已确认"}</em><button type="button" onClick={() => beginEdit(record)} aria-label={`编辑${evidenceTypeLabels[record.type]}`}><Edit3 size={15} /></button><button type="button" onClick={() => onRemove(record.id)} aria-label={`删除${evidenceTypeLabels[record.type]}`}><Trash2 size={15} /></button></div></div>
                {editingId === record.id ? <div className="evidenceInlineEdit"><textarea value={editingBehavior} onChange={(event) => setEditingBehavior(event.target.value)} /><input value={editingNote} onChange={(event) => setEditingNote(event.target.value)} placeholder="备注" /><div><button type="button" onClick={() => setEditingId(null)}>取消</button><button className="confirm" type="button" onClick={() => saveEdit(record)}>保存修改</button></div></div> : <strong>{record.behavior}</strong>}
                <div className="evidenceMeta">
                  <span><CalendarDays size={13} />{record.occurredAt}</span>
                  <span>{record.actor}</span>
                  <span>数量 {record.quantity}</span>
                  <span><ShieldCheck size={13} />{record.verifiable ? "可复核" : "未复核"}</span>
                  {record.url && <a href={record.url} target="_blank" rel="noreferrer"><Link2 size={13} />查看链接</a>}
                </div>
                <footer><span>{evidenceSourceLabels[record.source]}</span>{record.note && <p>{record.note}</p>}</footer>
                {record.reviewStatus === "pending" && <div className="evidenceReviewActions"><p>确认代表AI总结与原始答卷一致，不代表第三方已经证明内容绝对真实。</p><button type="button" onClick={() => onUpdate({ ...record, reviewStatus: "rejected" })}><X size={14} />排除</button><button className="confirm" type="button" onClick={() => onUpdate({ ...record, reviewStatus: "confirmed" })}><Check size={14} />确认计入</button></div>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
