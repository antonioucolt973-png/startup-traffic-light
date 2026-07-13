import { useMemo, useState } from "react";
import { Backpack, ClipboardCheck, Flag, Map, Route, Sparkles } from "lucide-react";
import { DecisionReportView } from "./components/DecisionReport";
import { EvidenceBackpack } from "./components/EvidenceBackpack";
import { GateChallenge } from "./components/GateChallenge";
import { JourneyMapScreen } from "./components/JourneyMapScreen";
import { ProjectCar } from "./components/ProjectCar";
import { ProjectDeparture } from "./components/ProjectDeparture";
import { TrafficLight } from "./components/TrafficLight";
import { exampleCases } from "./data/examples";
import {
  buildReport,
  deriveEvidenceSummary,
  emptyGatePlans,
  normalizeGatePlans,
  normalizeProject,
  plansToRoadtestPlan,
} from "./lib/decisionEngine";
import {
  createEmptyWorkspace,
  evidenceSummaryToRecords,
  loadWorkspace,
  saveWorkspace,
} from "./lib/storage";
import type {
  CalibrationRound,
  CalibrationSnapshot,
  GateId,
  Project,
  ProjectWorkspace,
} from "./types";

type ViewId = "departure" | "map" | "gate" | "backpack" | "report";

const views: Array<{ id: ViewId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "departure", label: "项目出发", icon: Flag },
  { id: "map", label: "路线总览", icon: Map },
  { id: "gate", label: "现实路口", icon: Route },
  { id: "backpack", label: "证据背包", icon: Backpack },
  { id: "report", label: "下一程路线", icon: ClipboardCheck },
];

export default function App() {
  const [workspace, setWorkspaceState] = useState<ProjectWorkspace>(() => loadWorkspace());
  const [activeView, setActiveView] = useState<ViewId>("departure");
  const [activeGate, setActiveGate] = useState<GateId>("user");
  const [copyState, setCopyState] = useState("复制报告");
  const [saveState, setSaveState] = useState("保存本轮");

  const evidence = useMemo(() => deriveEvidenceSummary(workspace.evidenceRecords), [workspace.evidenceRecords]);
  const roadtestPlan = useMemo(() => plansToRoadtestPlan(workspace.plans), [workspace.plans]);
  const report = useMemo(
    () => buildReport(workspace.project, evidence, roadtestPlan),
    [workspace.project, evidence, roadtestPlan],
  );
  const history = useMemo(
    () => workspace.rounds.map(roundToSnapshot),
    [workspace.rounds],
  );

  function navigate(view: ViewId) {
    setActiveView(view);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function setWorkspace(next: ProjectWorkspace) {
    setWorkspaceState(next);
    saveWorkspace(next);
  }

  function setProject(project: Project) {
    setWorkspace({ ...workspace, project: normalizeProject(project) });
  }

  function loadExample(index: number) {
    const example = exampleCases[index];
    const next = createEmptyWorkspace(example.project);
    next.evidenceRecords = evidenceSummaryToRecords(example.project.id, example.evidence);
    next.plans = normalizeGatePlans(emptyGatePlans);
    setWorkspace(next);
    setActiveGate("user");
    navigate("map");
  }

  function enterGate(gate: GateId = activeGate) {
    setActiveGate(gate);
    navigate("gate");
  }

  function updateActivePlan(plan: ProjectWorkspace["plans"][GateId]) {
    setWorkspace({ ...workspace, plans: { ...workspace.plans, [activeGate]: plan } });
  }

  function addEvidenceRecord(record: ProjectWorkspace["evidenceRecords"][number]) {
    setWorkspace({ ...workspace, evidenceRecords: [record, ...workspace.evidenceRecords] });
  }

  function removeEvidenceRecord(recordId: string) {
    setWorkspace({ ...workspace, evidenceRecords: workspace.evidenceRecords.filter((record) => record.id !== recordId) });
  }

  function addRedTeamTurn(turn: ProjectWorkspace["redTeamTurns"][number]) {
    setWorkspace({ ...workspace, redTeamTurns: [...workspace.redTeamTurns, turn].slice(-24) });
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopyState("已复制");
    } catch {
      setCopyState("复制失败");
    }
    window.setTimeout(() => setCopyState("复制报告"), 1600);
  }

  function saveCurrentCalibration() {
    const round: CalibrationRound = {
      id: `${Date.now()}-${report.light}`,
      projectId: workspace.project.id,
      projectName: workspace.project.name || "未命名项目",
      createdAt: new Date().toISOString(),
      stage: workspace.project.currentStage,
      light: report.light,
      lightLabel: report.lightLabel,
      evidenceScore: report.evidenceScore,
      evidenceLevel: report.evidenceLevel,
      projectStructureScore: report.projectStructureScore,
      planScore: report.planScore,
      currentFocus: report.currentFocus,
      nextReviewTrigger: report.nextReviewTrigger,
      gateStatuses: Object.fromEntries(report.roadtestChecks.map((item) => [item.id, item.status])) as CalibrationRound["gateStatuses"],
      investmentLimit: { days: report.investmentLimit.days, money: report.investmentLimit.money },
      evidenceRecordIds: workspace.evidenceRecords.map((record) => record.id),
    };
    setWorkspace({ ...workspace, rounds: [round, ...workspace.rounds].slice(0, 12) });
    setSaveState("已保存");
    window.setTimeout(() => setSaveState("保存本轮"), 1600);
  }

  return (
    <main className="journeyApp">
      <header className="journeyHeader">
        <button className="journeyBrand" type="button" onClick={() => navigate("departure")}>
          <span className="brandSignal" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>创业红绿灯</strong><small>用证据校准创业节奏</small></span>
        </button>
        <nav className="journeyNav" aria-label="创业校准流程">
          {views.map((view, index) => {
            const Icon = view.icon;
            return (
              <button key={view.id} className={activeView === view.id ? "active" : ""} type="button" onClick={() => navigate(view.id)}>
                <span>{String(index + 1).padStart(2, "0")}</span><Icon size={16} />{view.label}
              </button>
            );
          })}
        </nav>
        <button className="headerProject" type="button" onClick={() => navigate("departure")}>
          <Sparkles size={15} /><span>{workspace.project.name || "未命名项目"}</span>
        </button>
      </header>

      <div className={`journeyWorkspace view-${activeView}`}>
        <section className="journeyMain">
          {activeView === "departure" && (
            <ProjectDeparture
              project={workspace.project}
              onChange={setProject}
              examples={exampleCases}
              onLoadExample={loadExample}
              onReady={() => navigate("map")}
            />
          )}
          {activeView === "map" && (
            <JourneyMapScreen
              project={workspace.project}
              report={report}
              activeGate={activeGate}
              onGateChange={setActiveGate}
              onEnterGate={() => enterGate()}
            />
          )}
          {activeView === "gate" && (
            <GateChallenge
              project={workspace.project}
              report={report}
              evidence={evidence}
              activeGate={activeGate}
              onActiveGateChange={setActiveGate}
              plan={workspace.plans[activeGate]}
              onPlanChange={updateActivePlan}
              turns={workspace.redTeamTurns}
              onAddTurn={addRedTeamTurn}
              onOpenBackpack={() => navigate("backpack")}
            />
          )}
          {activeView === "backpack" && (
            <EvidenceBackpack
              project={workspace.project}
              records={workspace.evidenceRecords}
              onAdd={addEvidenceRecord}
              onRemove={removeEvidenceRecord}
            />
          )}
          {activeView === "report" && (
            <DecisionReportView
              report={report}
              project={workspace.project}
              onCopy={copyReport}
              copyState={copyState}
              onSaveCalibration={saveCurrentCalibration}
              saveState={saveState}
              history={history}
            />
          )}
        </section>

        {activeView !== "departure" && (
          <aside className="journeySidebar">
            <TrafficLight light={report.light} label={report.lightLabel} reason={report.lightReason} />
            <ProjectCar project={workspace.project} compact />
            <section className="pulsePanel">
              <div><span>证据充分度</span><strong>{report.evidenceScore}<small>/100</small></strong></div>
              <div className="pulseMeter"><span style={{ width: `${report.evidenceScore}%` }} /></div>
            </section>
            <section className="pulsePanel split">
              <div><span>路测可信度</span><strong>{report.planCredibility}</strong><small>{report.planScore}/100</small></div>
              <Backpack size={24} />
            </section>
            <section className="pulsePanel">
              <span>投入上限</span>
              <div className="investmentPair"><strong>{report.investmentLimit.days}<small>天</small></strong><strong>{report.investmentLimit.money}<small>元</small></strong></div>
              <ul>{report.investmentLimit.bans.slice(0, 3).map((ban) => <li key={ban}>{ban}</li>)}</ul>
            </section>
          </aside>
        )}
      </div>
    </main>
  );
}

function roundToSnapshot(round: CalibrationRound): CalibrationSnapshot {
  return {
    id: round.id,
    projectId: round.projectId,
    projectName: round.projectName,
    createdAt: round.createdAt,
    stage: round.stage,
    light: round.light,
    lightLabel: round.lightLabel,
    evidenceScore: round.evidenceScore,
    evidenceLevel: round.evidenceLevel,
    projectStructureScore: round.projectStructureScore,
    currentFocus: round.currentFocus,
  };
}
