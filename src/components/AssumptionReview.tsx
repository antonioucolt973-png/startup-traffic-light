import type { DecisionReport, RoadtestPlan } from "../types";

interface AssumptionReviewProps {
  report: DecisionReport;
  plan: RoadtestPlan;
  onPlanChange: (plan: RoadtestPlan) => void;
}

export function AssumptionReview({ report, plan, onPlanChange }: AssumptionReviewProps) {
  function update(key: keyof RoadtestPlan, value: string) {
    onPlanChange({ ...plan, [key]: value });
  }

  return (
    <div className="screenStack">
      <div className="screenHeader">
        <div>
          <p className="microLabel">现实路测</p>
          <h3>把项目放进现实里跑一遍</h3>
        </div>
        <p>每一站都分清楚：已经发生的证据，和接下来准备怎么补证。</p>
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
            <div className="roadtestEvidence">
              <span>当前证据</span>
              <p>{item.evidence}</p>
            </div>
            <label className="roadtestPlan">
              <span>我的补证办法</span>
              <textarea
                value={plan[item.id]}
                placeholder="写清楚：找谁、几个人、怎么触达、用什么结果判断继续或停止。"
                onChange={(event) => update(item.id, event.target.value)}
              />
            </label>
            <p className="roadtestFeedback">{item.feedback}</p>
          </article>
        ))}
      </div>

      <div className="deliveryBox">
        <span>计划体检</span>
        <p>
          补证计划可信度：{report.planCredibility}（{report.planScore}/100）。{report.deliveryPath}
        </p>
      </div>
    </div>
  );
}
