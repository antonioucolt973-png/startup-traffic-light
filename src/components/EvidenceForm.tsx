import type { Evidence } from "../types";

interface EvidenceFormProps {
  evidence: Evidence;
  onChange: (evidence: Evidence) => void;
}

const numberFields: Array<{ key: keyof Evidence; label: string; hint: string }> = [
  { key: "interviewCount", label: "访谈人数", hint: "3-5 人才算进入第 2 级证据" },
  { key: "testPostCount", label: "测试内容发布次数", hint: "朋友圈/小红书/社群/短视频都算" },
  { key: "messageCount", label: "留言/私信人数", hint: "必须是外部主动反馈" },
  { key: "signupCount", label: "加微信/登记人数", hint: "比点赞更强的意向信号" },
  { key: "demoTrialCount", label: "试用原型人数", hint: "手动演示也算" },
  { key: "paymentSignalCount", label: "付费/预订人数", hint: "包括报价接受、定金、预售" },
];

export function EvidenceForm({ evidence, onChange }: EvidenceFormProps) {
  function update<K extends keyof Evidence>(key: K, value: Evidence[K]) {
    onChange({ ...evidence, [key]: value });
  }

  return (
    <div className="screenStack">
      <div className="screenHeader">
        <div>
          <p className="microLabel">证据上车</p>
          <h3>只记录真实用户行为，不记录脑内推演</h3>
        </div>
        <p>证据越接近付费、复用、转介绍，越允许增加投入。</p>
      </div>

      <div className="evidenceGrid">
        <label className="toggleRow">
          <input
            type="checkbox"
            checked={evidence.competitorResearch}
            onChange={(event) => update("competitorResearch", event.target.checked)}
          />
          <span>
            <strong>做过竞品/资料搜索</strong>
            <small>确认用户当前如何解决，而不是凭空想差异化。</small>
          </span>
        </label>

        {numberFields.map((field) => (
          <label key={field.key} className="evidenceItem">
            <span>{field.label}</span>
            <input
              type="number"
              min={0}
              value={Number(evidence[field.key])}
              onChange={(event) => update(field.key, Number(event.target.value) as Evidence[typeof field.key])}
            />
            <small>{field.hint}</small>
          </label>
        ))}

        <label className="toggleRow wide">
          <input
            type="checkbox"
            checked={evidence.retentionSignal}
            onChange={(event) => update("retentionSignal", event.target.checked)}
          />
          <span>
            <strong>已有复用、留存或转介绍信号</strong>
            <small>这是第 6 级证据，代表可以考虑系统投入。</small>
          </span>
        </label>
      </div>
    </div>
  );
}
