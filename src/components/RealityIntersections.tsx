import type { DecisionReport, Evidence, RoadtestPlan } from "../types";
import { RoadMap } from "./RoadMap";

interface RealityIntersectionsProps {
  report: DecisionReport;
  evidence: Evidence;
  onEvidenceChange: (evidence: Evidence) => void;
  plan: RoadtestPlan;
  onPlanChange: (plan: RoadtestPlan) => void;
  activeGate: keyof RoadtestPlan;
  onActiveGateChange: (gate: keyof RoadtestPlan) => void;
}

const evidenceControls: Record<
  keyof RoadtestPlan,
  Array<{ key: keyof Evidence; label: string; type?: "checkbox" }>
> = {
  user: [{ key: "interviewCount", label: "已访谈人数" }],
  pain: [
    { key: "messageCount", label: "主动留言/私信人数" },
    { key: "demoTrialCount", label: "愿意试用人数" },
  ],
  alternative: [{ key: "competitorResearch", label: "做过替代方案搜索", type: "checkbox" }],
  acquisition: [
    { key: "testPostCount", label: "测试内容次数" },
    { key: "signupCount", label: "加微信/登记人数" },
  ],
  payment: [{ key: "paymentSignalCount", label: "付费/预订信号" }],
  delivery: [
    { key: "demoTrialCount", label: "原型试用人数" },
    { key: "retentionSignal", label: "已有复用/留存", type: "checkbox" },
  ],
};

export function RealityIntersections({
  report,
  evidence,
  onEvidenceChange,
  plan,
  onPlanChange,
  activeGate,
  onActiveGateChange,
}: RealityIntersectionsProps) {
  function updatePlan(key: keyof RoadtestPlan, value: string) {
    onPlanChange({ ...plan, [key]: value });
  }

  function updateEvidence<K extends keyof Evidence>(key: K, value: Evidence[K]) {
    onEvidenceChange({ ...evidence, [key]: value });
  }

  const item = report.roadtestChecks.find((check) => check.id === activeGate) ?? report.roadtestChecks[0];

  return (
    <div className="screenStack">
      <div className="screenHeader">
        <div>
          <p className="microLabel">现实路口</p>
          <h3>先过需求，再过交易，最后确认能否交付</h3>
        </div>
        <p>红绿灯只认真实证据；好计划只能让你进入路测，不能直接当作已经通过。</p>
      </div>

      <div className="intersectionSummary">
        <div>
          <span>当前灯号</span>
          <strong>{report.lightLabel}</strong>
        </div>
        <div>
          <span>证据充分度</span>
          <strong>{report.evidenceScore}/100</strong>
        </div>
        <div>
          <span>路测计划</span>
          <strong>
            {report.planCredibility} · {report.planScore}/100
          </strong>
        </div>
      </div>

      <RoadMap checks={report.roadtestChecks} activeGate={activeGate} onGateChange={onActiveGateChange} />

      <article className={`roadtestCard focusGate status${item.status}`}>
        <div className="roadtestCardHead">
          <div>
            <span>当前检查点 · {item.stage === "demand" ? "需求阶段" : item.stage === "transaction" ? "交易阶段" : "交付阶段"}</span>
            <strong>{item.title}</strong>
          </div>
          <em>{item.status}</em>
        </div>
        <p className="gateScene">{item.scene}</p>

        <div className="roadtestGrid">
          <section className="roadtestEvidence">
            <span>回填真实证据</span>
            <p>{item.evidence}</p>
            <div className="inlineEvidence">
              {evidenceControls[item.id].map((control) =>
                control.type === "checkbox" ? (
                  <label key={control.key} className="miniCheck">
                    <input
                      type="checkbox"
                      checked={Boolean(evidence[control.key])}
                      onChange={(event) => updateEvidence(control.key, event.target.checked as Evidence[typeof control.key])}
                    />
                    <span>{control.label}</span>
                  </label>
                ) : (
                  <label key={control.key} className="miniNumber">
                    <span>{control.label}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={Number(evidence[control.key])}
                      onChange={(event) => updateEvidence(control.key, Number(event.target.value) as Evidence[typeof control.key])}
                    />
                  </label>
                ),
              )}
            </div>
          </section>

          <section className="roadtestPlanBlock">
            <label className="roadtestPlan">
              <span>我的应对方案</span>
              <textarea
                value={plan[item.id]}
                placeholder="写清楚：找谁、做什么、何时完成、什么结果算通过、失败后如何调整。"
                onChange={(event) => updatePlan(item.id, event.target.value)}
              />
            </label>
          </section>
        </div>

        <div className="redTeamInline">
          <span>红队检查员</span>
          <p>{item.redTeamPrompt}</p>
        </div>

        <p className="roadtestFeedback">{item.feedback}</p>
      </article>
    </div>
  );
}
