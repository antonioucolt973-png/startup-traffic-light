import { Backpack, CalendarDays, Link2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { evidenceSourceLabels, evidenceTypeLabels } from "../lib/labels";
import type { EvidenceRecord, EvidenceSource, EvidenceType, Project } from "../types";

interface EvidenceBackpackProps {
  project: Project;
  records: EvidenceRecord[];
  onAdd: (record: EvidenceRecord) => void;
  onRemove: (recordId: string) => void;
}

const defaultSource: EvidenceSource = "user_behavior";

export function EvidenceBackpack({ project, records, onAdd, onRemove }: EvidenceBackpackProps) {
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

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [records],
  );

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
    });
    setBehavior("");
    setActor("");
    setNote("");
    setUrl("");
    setQuantity(1);
    setVerifiable(false);
    setError("");
  }

  return (
    <div className="evidenceBackpackScreen">
      <header className="backpackHeader">
        <div><span className="routeEyebrow">证据背包</span><h1>只收集已经发生的行为，不收藏漂亮推测。</h1><p>每条证据都记录来源、对象、时间和可复核性。请不要填写真实姓名、手机号或其他敏感信息。</p></div>
        <div className="backpackCount"><Backpack size={26} /><strong>{records.length}</strong><span>条记录</span></div>
      </header>

      <section className="evidenceComposer">
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
      </section>

      <section className="evidenceTimeline">
        <div className="timelineHeading"><div><span className="routeEyebrow">证据时间线</span><h2>{project.name || "当前项目"}的现实记录</h2></div><span>越接近试用、付款、复用，证据越强</span></div>
        {sortedRecords.length === 0 ? (
          <div className="evidenceEmpty"><Backpack size={30} /><strong>背包还是空的</strong><p>先完成一次访谈、公开测试或演示，再回来记录结果。</p></div>
        ) : (
          <div className="evidenceRecordList">
            {sortedRecords.map((record) => (
              <article key={record.id} className={`evidenceRecord source-${record.source}`}>
                <div className="evidenceRecordHead"><span>{evidenceTypeLabels[record.type]}</span><button type="button" onClick={() => onRemove(record.id)} aria-label={`删除${evidenceTypeLabels[record.type]}`}><Trash2 size={15} /></button></div>
                <strong>{record.behavior}</strong>
                <div className="evidenceMeta">
                  <span><CalendarDays size={13} />{record.occurredAt}</span>
                  <span>{record.actor}</span>
                  <span>数量 {record.quantity}</span>
                  <span><ShieldCheck size={13} />{record.verifiable ? "可复核" : "未复核"}</span>
                  {record.url && <a href={record.url} target="_blank" rel="noreferrer"><Link2 size={13} />查看链接</a>}
                </div>
                <footer><span>{evidenceSourceLabels[record.source]}</span>{record.note && <p>{record.note}</p>}</footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
