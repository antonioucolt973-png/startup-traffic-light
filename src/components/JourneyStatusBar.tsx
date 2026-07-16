import { Gauge, Layers3, Route, Timer, WalletCards } from "lucide-react";
import { stageLabels } from "../lib/labels";
import type { DecisionReport, JourneyCycle, Light, Project } from "../types";
import { ProjectVehicle } from "./ProjectVehicle";

interface JourneyStatusBarProps {
  project: Project;
  report: DecisionReport;
  activeCycle?: JourneyCycle;
}

const lights: Array<{ id: Light; label: string }> = [
  { id: "red", label: "暂停" },
  { id: "yellow", label: "验证" },
  { id: "green", label: "推进" },
  { id: "blue", label: "行动" },
];

export function JourneyStatusBar({ project, report, activeCycle }: JourneyStatusBarProps) {
  return (
    <section className="journeyStatusBar" aria-label="项目当前状态">
      <div className="statusProject">
        <ProjectVehicle size="tiny" />
        <div><span>第 {activeCycle?.cycleNumber ?? 1} 轮旅程</span><strong>{project.name || "未命名项目"}</strong></div>
      </div>

      <div className="statusDecision">
        <div className="miniSignals" aria-label={report.lightLabel}>
          {lights.map((light) => <i key={light.id} className={`${light.id} ${report.light === light.id ? "on" : ""}`} title={light.label} />)}
        </div>
        <div><span>本轮灯号</span><strong>{report.lightLabel}</strong></div>
      </div>

      <div className="statusMetric">
        <Gauge size={17} />
        <div><span>证据充分度</span><strong>{report.evidenceScore}<small>/100</small></strong></div>
        <div className="statusMeter"><i style={{ width: `${report.evidenceScore}%` }} /></div>
      </div>

      <div className="statusMetric compact">
        <Route size={17} />
        <div><span>路线可信度</span><strong>{report.planCredibility}<small>{report.planScore}/100</small></strong></div>
      </div>

      <div className="statusStage">
        <Layers3 size={17} />
        <div><span>当前阶段</span><strong>{stageLabels[project.currentStage]}</strong></div>
      </div>

      <div className="statusBudget">
        <span>本轮投入上限</span>
        <strong><Timer size={15} />{report.investmentLimit.days}天</strong>
        <strong><WalletCards size={15} />{report.investmentLimit.money}元</strong>
        <small>{budgetReason(report)}</small>
      </div>

    </section>
  );
}

function budgetReason(report: DecisionReport) {
  if (report.light === "green") return "已有交易或强留存证据，可受控增加验证投入。";
  if (report.light === "red") return "投入已经跑在证据前面，本轮应冻结新增开支。";
  if (report.light === "blue") return "长期缺少外部行动，只允许低成本快速触达用户。";
  if (report.evidenceLevel >= 4) return `证据达到第 ${report.evidenceLevel} 级，但尚无足够交易或留存信号。`;
  if (report.evidenceLevel >= 3) return `证据达到第 ${report.evidenceLevel} 级，可扩大验证样本，但不能扩大开发。`;
  if (report.evidenceLevel >= 1) return `证据处于第 ${report.evidenceLevel} 级，只允许低成本补齐关键行为。`;
  return "当前只有项目假设，先获得第一条真实用户证据。";
}
