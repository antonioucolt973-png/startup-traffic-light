import { useMemo, useState } from "react";
import { ClipboardList, FileText, Radar } from "lucide-react";
import { DecisionReportView } from "./components/DecisionReport";
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
  normalizeRoadtestPlan,
} from "./lib/decisionEngine";
import { getStageLabel } from "./lib/labels";
import {
  loadEvidence,
  loadProject,
  loadRoadtestPlan,
  saveEvidence,
  saveProject,
  saveRoadtestPlan,
} from "./lib/storage";
import type { Evidence, Project, RoadtestPlan } from "./types";

type StepId = "input" | "intersections" | "report";

const steps: Array<{ id: StepId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "input", label: "项目上路", icon: ClipboardList },
  { id: "intersections", label: "现实路口", icon: Radar },
  { id: "report", label: "节奏校准单", icon: FileText },
];

export default function App() {
  const [project, setProjectState] = useState<Project>(() => loadProject() ?? emptyProject);
  const [evidence, setEvidenceState] = useState<Evidence>(() => loadEvidence() ?? emptyEvidence);
  const [roadtestPlan, setRoadtestPlanState] = useState<RoadtestPlan>(() =>
    normalizeRoadtestPlan(loadRoadtestPlan()),
  );
  const [activeStep, setActiveStep] = useState<StepId>("input");
  const [copyState, setCopyState] = useState("复制报告");

  const report = useMemo(() => buildReport(project, evidence, roadtestPlan), [project, evidence, roadtestPlan]);
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
            {activeStep === "input" && <ProjectInput project={project} onChange={setProject} />}
            {activeStep === "intersections" && (
              <RealityIntersections
                report={report}
                evidence={evidence}
                onEvidenceChange={setEvidence}
                plan={roadtestPlan}
                onPlanChange={setRoadtestPlan}
              />
            )}
            {activeStep === "report" && (
              <DecisionReportView report={report} project={project} onCopy={copyReport} copyState={copyState} />
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
