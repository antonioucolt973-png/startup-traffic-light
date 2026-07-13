import { useMemo, useState } from "react";
import { ClipboardList, FileText, Home, Radar } from "lucide-react";
import { DecisionReportView } from "./components/DecisionReport";
import { HomeScreen } from "./components/HomeScreen";
import { ProjectInput } from "./components/ProjectInput";
import { RealityIntersections } from "./components/RealityIntersections";
import { StepRail } from "./components/StepRail";
import { TrafficLight } from "./components/TrafficLight";
import { exampleCases } from "./data/examples";
import {
  buildReport,
  emptyEvidence,
  emptyProject,
  emptyRoadtestPlan,
  normalizeEvidence,
  normalizeProject,
  normalizeRoadtestPlan,
} from "./lib/decisionEngine";
import { getStageLabel } from "./lib/labels";
import {
  loadEvidence,
  loadCalibrationHistory,
  loadProject,
  loadRoadtestPlan,
  saveCalibrationHistory,
  saveEvidence,
  saveProject,
  saveRoadtestPlan,
} from "./lib/storage";
import type { CalibrationSnapshot, Evidence, Project, RoadtestPlan } from "./types";

type StepId = "home" | "input" | "intersections" | "report";

const steps: Array<{ id: StepId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "home", label: "首页", icon: Home },
  { id: "input", label: "项目上路", icon: ClipboardList },
  { id: "intersections", label: "现实路口", icon: Radar },
  { id: "report", label: "节奏校准单", icon: FileText },
];

export default function App() {
  const [project, setProjectState] = useState<Project>(() => normalizeProject(loadProject() ?? emptyProject));
  const [evidence, setEvidenceState] = useState<Evidence>(() => normalizeEvidence(loadEvidence() ?? emptyEvidence));
  const [roadtestPlan, setRoadtestPlanState] = useState<RoadtestPlan>(() =>
    normalizeRoadtestPlan(loadRoadtestPlan()),
  );
  const [activeStep, setActiveStep] = useState<StepId>("home");
  const [activeGate, setActiveGate] = useState<keyof RoadtestPlan>("user");
  const [copyState, setCopyState] = useState("复制报告");
  const [saveState, setSaveState] = useState("保存本轮");
  const [calibrationHistory, setCalibrationHistory] = useState<CalibrationSnapshot[]>(() => loadCalibrationHistory());

  const report = useMemo(() => buildReport(project, evidence, roadtestPlan), [project, evidence, roadtestPlan]);
  const projectHistory = useMemo(
    () => calibrationHistory.filter((snapshot) => snapshot.projectId === project.id),
    [calibrationHistory, project.id],
  );
  const currentIndex = steps.findIndex((step) => step.id === activeStep);

  function setProject(next: Project) {
    setProjectState(next);
    saveProject(next);
  }

  function setEvidence(next: Evidence) {
    setEvidenceState(next);
    saveEvidence(next);
  }

  function setRoadtestPlan(next: RoadtestPlan) {
    setRoadtestPlanState(next);
    saveRoadtestPlan(next);
  }

  function loadExample(index: number) {
    const example = exampleCases[index];
    setProject(example.project);
    setEvidence(example.evidence);
    setRoadtestPlan(emptyRoadtestPlan);
    setActiveGate("user");
    setActiveStep("intersections");
  }

  function goNext() {
    const next = steps[Math.min(currentIndex + 1, steps.length - 1)];
    setActiveStep(next.id);
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopyState("已复制");
      window.setTimeout(() => setCopyState("复制报告"), 1600);
    } catch {
      setCopyState("复制失败");
      window.setTimeout(() => setCopyState("复制报告"), 1600);
    }
  }

  function saveCurrentCalibration() {
    const snapshot: CalibrationSnapshot = {
      id: `${Date.now()}-${report.light}`,
      projectId: project.id,
      projectName: project.name || "未命名项目",
      createdAt: new Date().toISOString(),
      stage: project.currentStage,
      light: report.light,
      lightLabel: report.lightLabel,
      evidenceScore: report.evidenceScore,
      evidenceLevel: report.evidenceLevel,
      projectStructureScore: report.projectStructureScore,
      currentFocus: report.currentFocus,
    };
    const next = [snapshot, ...calibrationHistory].slice(0, 12);
    setCalibrationHistory(next);
    saveCalibrationHistory(next);
    setSaveState("已保存");
    window.setTimeout(() => setSaveState("保存本轮"), 1600);
  }

  return (
    <main className="appShell">
      <aside className="sidePanel">
        <div className="brandBlock">
          <div className="brandMark">
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>创业红绿灯</h1>
            <p>用证据校准创业节奏</p>
          </div>
        </div>

        <StepRail steps={steps} activeStep={activeStep} onStepChange={setActiveStep} />

        <div className="exampleBox">
          <div className="sectionTitle">演示案例</div>
          {exampleCases.map((item, index) => (
            <button key={item.project.id} className="exampleButton" onClick={() => loadExample(index)}>
              <span>{item.project.name}</span>
              <small>{getStageLabel(item.project.currentStage)}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="workbench">
        <header className="topBar">
          <div>
            <p className="microLabel">最小闭环版</p>
            <h2>{steps[currentIndex].label}</h2>
          </div>
          <div className="topActions">
            <button className="ghostButton" onClick={() => setActiveStep("report")}>
              查看校准
            </button>
            <button className="primaryButton" onClick={goNext}>
              下一步
            </button>
          </div>
        </header>

        <div className="contentGrid">
          <section className="mainStage">
            {activeStep === "home" && (
              <HomeScreen onStart={() => setActiveStep("input")} calibrationCount={calibrationHistory.length} />
            )}
            {activeStep === "input" && (
              <ProjectInput project={project} onChange={setProject} assumptions={report.assumptions} />
            )}
            {activeStep === "intersections" && (
              <RealityIntersections
                report={report}
                evidence={evidence}
                onEvidenceChange={setEvidence}
                plan={roadtestPlan}
                onPlanChange={setRoadtestPlan}
                activeGate={activeGate}
                onActiveGateChange={setActiveGate}
              />
            )}
            {activeStep === "report" && (
              <DecisionReportView
                report={report}
                project={project}
                onCopy={copyReport}
                copyState={copyState}
                onSaveCalibration={saveCurrentCalibration}
                saveState={saveState}
                history={projectHistory}
              />
            )}
          </section>

          <aside className={`decisionRail ${activeStep === "report" ? "compactRail" : ""}`}>
            <TrafficLight light={report.light} label={report.lightLabel} reason={report.lightReason} />
            <div className="scorePanel">
              <div>
                <span className="scoreValue">{report.evidenceScore}</span>
                <span className="scoreUnit">/100</span>
              </div>
              <p>证据充分度</p>
              <div className="meterTrack">
                <span style={{ width: `${report.evidenceScore}%` }} />
              </div>
            </div>
            <div className="limitPanel">
              <div className="sectionTitle">路测可信度</div>
              <div className="planScoreLine">
                <strong>{report.planCredibility}</strong>
                <span>{report.planScore}/100</span>
              </div>
            </div>
            <div className="limitPanel">
              <div className="sectionTitle">投入上限</div>
              <div className="limitGrid">
                <div>
                  <strong>{report.investmentLimit.days}</strong>
                  <span>天</span>
                </div>
                <div>
                  <strong>{report.investmentLimit.money}</strong>
                  <span>元</span>
                </div>
              </div>
              <ul>
                {report.investmentLimit.bans.map((ban) => (
                  <li key={ban}>{ban}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
