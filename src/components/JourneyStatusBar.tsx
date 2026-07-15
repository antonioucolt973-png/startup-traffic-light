import { Gauge, HardDrive, Route, Timer, WalletCards } from "lucide-react";
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

      <div className="statusBudget">
        <span>本轮投入上限</span>
        <strong><Timer size={15} />{report.investmentLimit.days}天</strong>
        <strong><WalletCards size={15} />{report.investmentLimit.money}元</strong>
      </div>

      <div className="statusSaved" title="当前项目会自动保存在这个浏览器中">
        <HardDrive size={15} /><span>本浏览器已保存</span>
      </div>
    </section>
  );
}
