import { Copy } from "lucide-react";
import { getEvidenceLevelLabel } from "../lib/labels";
import type { DecisionReport, Project } from "../types";

interface DecisionReportViewProps {
  report: DecisionReport;
  project: Project;
  onCopy: () => void;
  copyState: string;
}

export function DecisionReportView({ report, project, onCopy, copyState }: DecisionReportViewProps) {
  return (
    <div className="screenStack">
      <div className="screenHeader">
        <div>
          <p className="microLabel">节奏校准单</p>
          <h3>{project.name || "未命名项目"}：{report.lightLabel}</h3>
        </div>
        <button className="copyButton" onClick={onCopy}>
          <Copy size={16} />
          {copyState}
        </button>
      </div>

      <div className="reportGrid">
        <article className="reportBlock spanTwo">
          <span>校准依据</span>
          <p>{report.lightReason}</p>
        </article>

        <article className="reportBlock">
          <span>项目可行性</span>
          <strong>{report.feasibilityScore}/100</strong>
        </article>

        <article className="reportBlock">
          <span>证据阶梯</span>
          <strong>{getEvidenceLevelLabel(report.evidenceLevel)}</strong>
        </article>

        <article className="reportBlock">
          <span>补证计划可信度</span>
          <strong>{report.planCredibility}</strong>
          <p>{report.planScore}/100</p>
        </article>

        <article className="reportBlock spanTwo">
          <span>现实路口</span>
          <ul>
            {report.roadtestChecks.map((item) => (
              <li key={item.id}>
                {item.title}：{item.status}
              </li>
            ))}
          </ul>
        </article>

        <article className="reportBlock">
          <span>最大风险</span>
          <ul>{report.mainRisks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
        </article>

        <article className="reportBlock">
          <span>缺失证据</span>
          <ul>{report.missingEvidence.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>
        </article>

        <article className="reportBlock spanTwo">
          <span>7 天最小验证任务</span>
          <ol>{report.sevenDayTasks.map((task) => <li key={task}>{task}</li>)}</ol>
        </article>

        <article className="reportBlock spanTwo">
          <span>停止条件</span>
          <ul>{report.stopConditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
        </article>
      </div>
    </div>
  );
}
