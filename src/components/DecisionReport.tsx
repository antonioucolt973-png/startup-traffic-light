import { BookmarkCheck, Copy, History } from "lucide-react";
import { getEvidenceLevelLabel, getStageLabel } from "../lib/labels";
import type { CalibrationSnapshot, DecisionReport, Project } from "../types";

interface DecisionReportViewProps {
  report: DecisionReport;
  project: Project;
  onCopy: () => void;
  copyState: string;
  onSaveCalibration: () => void;
  saveState: string;
  history: CalibrationSnapshot[];
}

export function DecisionReportView({
  report,
  project,
  onCopy,
  copyState,
  onSaveCalibration,
  saveState,
  history,
}: DecisionReportViewProps) {
  return (
    <div className="screenStack">
      <div className="screenHeader">
        <div>
          <p className="microLabel">节奏校准单</p>
          <h3>{project.name || "未命名项目"}：{report.lightLabel}</h3>
        </div>
        <div className="reportActions">
          <button className="ghostButton saveCalibrationButton" onClick={onSaveCalibration}>
            <BookmarkCheck size={16} />
            {saveState}
          </button>
          <button className="copyButton" onClick={onCopy}>
            <Copy size={16} />
            {copyState}
          </button>
        </div>
      </div>

      <div className="reportGrid">
        <article className="reportBlock spanTwo">
          <span>校准依据</span>
          <p>{report.lightReason}</p>
        </article>

        <article className="reportBlock spanTwo focusReportBlock">
          <span>本轮重点</span>
          <strong>{report.currentFocus}</strong>
          <p>下次校准：{report.nextReviewTrigger}</p>
        </article>

        <article className="reportBlock">
          <span>项目结构清晰度</span>
          <strong>{report.projectStructureScore}/100</strong>
          <p>只说明信息是否完整，不代表项目可行。</p>
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

        <article className="reportBlock spanTwo">
          <span>关键假设</span>
          <div className="reportAssumptionGrid">
            {report.assumptions.map((assumption) => (
              <div key={assumption.title}>
                <strong>{assumption.title}</strong>
                <em>{assumption.risk}风险</em>
                <p>{assumption.summary}</p>
              </div>
            ))}
          </div>
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

        <article className="reportBlock spanTwo">
          <span className="historyTitle"><History size={15} /> 校准历程</span>
          {history.length === 0 ? (
            <p>保存本轮后，后续回填证据并再次校准，就能看见项目节奏如何变化。</p>
          ) : (
            <ol className="historyList">
              {history.map((snapshot) => (
                <li key={snapshot.id}>
                  <strong>{snapshot.lightLabel}</strong>
                  <span>{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(snapshot.createdAt))}</span>
                  <em>{getStageLabel(snapshot.stage)} · 证据 {snapshot.evidenceScore}/100</em>
                  <p>{snapshot.currentFocus}</p>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </div>
  );
}
