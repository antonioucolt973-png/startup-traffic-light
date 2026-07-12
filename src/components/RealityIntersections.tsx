import type { DecisionReport, Evidence, RoadtestPlan } from "../types";

interface RealityIntersectionsProps {
  report: DecisionReport;
  evidence: Evidence;
  onEvidenceChange: (evidence: Evidence) => void;
  plan: RoadtestPlan;
  onPlanChange: (plan: RoadtestPlan) => void;
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
}: RealityIntersectionsProps) {
  function updatePlan(key: keyof RoadtestPlan, value: string) {
    onPlanChange({ ...plan, [key]: value });
  }

  function updateEvidence<K extends keyof Evidence>(key: K, value: Evidence[K]) {
    onEvidenceChange({ ...evidence, [key]: value });
  }

  return (
    <div className="screenStack">
      <div className="screenHeader">
        <div>
          <p className="microLabel">现实路口</p>
          <h3>每到一个路口，要么拿证据，要么说清楚怎么验证</h3>
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

      <div className="roadtestList">
        {report.roadtestChecks.map((item) => (
          <article key={item.id} className={`roadtestCard status${item.status}`}>
            <div className="roadtestCardHead">
              <div>
                <span>{item.title}</span>
                <strong>{item.scene}</strong>
              </div>
              <em>{item.status}</em>
            </div>

            <div className="roadtestGrid">
              <section className="roadtestEvidence">
                <span>已有证据</span>
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
                  <span>我的验证计划</span>
                  <textarea
                    value={plan[item.id]}
                    placeholder="写清楚：找谁、做什么、几天内完成、什么结果算继续或停止。"
                    onChange={(event) => updatePlan(item.id, event.target.value)}
                  />
                </label>
              </section>
            </div>

            <div className="redTeamInline">
              <span>红队追问</span>
              <p>{item.redTeamPrompt}</p>
            </div>

            <p className="roadtestFeedback">{item.feedback}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
