import type { DecisionReport } from "../types";

interface RedTeamPanelProps {
  report: DecisionReport;
}

export function RedTeamPanel({ report }: RedTeamPanelProps) {
  return (
    <div className="screenStack">
      <div className="screenHeader">
        <div>
          <p className="microLabel">红队拦截</p>
          <h3>只拦截证据缺口，不制造焦虑</h3>
        </div>
        <p>这些拦截点的目标是逼出下一步行动，而不是证明想法不行。</p>
      </div>

      <div className="redTeamList">
        {report.redTeamQuestions.map((item) => (
          <article key={`${item.role}-${item.question}`} className="redTeamItem">
            <div>
              <span>{item.role}</span>
              <strong>{item.severity}</strong>
            </div>
            <p>{item.question}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
