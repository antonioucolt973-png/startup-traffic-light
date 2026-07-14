import { useEffect, useMemo, useRef, useState } from "react";
import { Backpack, ClipboardCheck, Flag, Map, RotateCcw, Route, Sparkles } from "lucide-react";
import { EvidenceBackpack } from "./components/EvidenceBackpack";
import { EvidenceRefill } from "./components/EvidenceRefill";
import { GateChallenge } from "./components/GateChallenge";
import { JourneyMapScreen } from "./components/JourneyMapScreen";
import { JourneyStatusBar } from "./components/JourneyStatusBar";
import { NextRoute } from "./components/NextRoute";
import { ProjectDeparture } from "./components/ProjectDeparture";
import { AccountMenu } from "./components/AccountMenu";
import { exampleCases } from "./data/examples";
import {
  buildReport,
  deriveEvidenceSummary,
  emptyGatePlans,
  normalizeGatePlans,
  normalizeProject,
  plansToRoadtestPlan,
} from "./lib/decisionEngine";
import { createCalibrationRound, createValidationTasks } from "./lib/calibration";
import {
  createEmptyWorkspace,
  evidenceSummaryToRecords,
  loadWorkspace,
  saveWorkspace,
} from "./lib/storage";
import {
  getCloudSession,
  loadCloudWorkspace,
  requestEmailSignIn,
  saveCloudWorkspace,
  signOutCloud,
  subscribeToCloudSession,
  type CloudSession,
} from "./lib/cloud";
import type {
  GateId,
  Project,
  ProjectWorkspace,
} from "./types";

type ViewId = "departure" | "map" | "gate" | "backpack" | "route" | "refill";

const views: Array<{ id: ViewId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "departure", label: "项目出发", icon: Flag },
  { id: "map", label: "路线总览", icon: Map },
  { id: "gate", label: "路口与红队", icon: Route },
  { id: "backpack", label: "证据背包", icon: Backpack },
  { id: "route", label: "下一程路线", icon: ClipboardCheck },
  { id: "refill", label: "证据回填", icon: RotateCcw },
];

export default function App() {
  const [workspace, setWorkspaceState] = useState<ProjectWorkspace>(() => loadWorkspace());
  const [activeView, setActiveView] = useState<ViewId>("departure");
  const [activeGate, setActiveGate] = useState<GateId>("user");
  const [copyState, setCopyState] = useState("复制报告");
  const [saveState, setSaveState] = useState("重新校准");
  const [cloudSession, setCloudSession] = useState<CloudSession>({ user: null, enabled: false });
  const [syncState, setSyncState] = useState("本地游客数据");
  const initialWorkspaceRef = useRef(workspace);

  const evidence = useMemo(() => deriveEvidenceSummary(workspace.evidenceRecords), [workspace.evidenceRecords]);
  const roadtestPlan = useMemo(() => plansToRoadtestPlan(workspace.plans), [workspace.plans]);
  const report = useMemo(
    () => buildReport(workspace.project, evidence, roadtestPlan),
    [workspace.project, evidence, roadtestPlan],
  );

  useEffect(() => {
    void getCloudSession().then(async (session) => {
      setCloudSession(session);
      if (!session.user) return;
      try {
        const cloudWorkspace = await loadCloudWorkspace(session.user.id);
        if (cloudWorkspace) replaceWorkspace(cloudWorkspace);
        else await saveCloudWorkspace(session.user.id, initialWorkspaceRef.current);
        setSyncState("云端已同步");
      } catch {
        setSyncState("云端同步失败，已保留本地数据");
      }
    });
    return subscribeToCloudSession(setCloudSession);
  }, []);

  useEffect(() => {
    if (!cloudSession.user) return;
    const timer = window.setTimeout(() => {
      void saveCloudWorkspace(cloudSession.user!.id, workspace)
        .then(() => setSyncState("云端已同步"))
        .catch(() => setSyncState("云端同步失败，已保留本地数据"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [cloudSession.user, workspace]);
  function navigate(view: ViewId) {
    if (view === "route" || view === "refill") {
      updateWorkspace((current) => ensureExecutionState(current));
    }
    setActiveView(view);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function replaceWorkspace(next: ProjectWorkspace) {
    const normalized = ensureWorkspaceVersion(next);
    setWorkspaceState(normalized);
    saveWorkspace(normalized);
  }

  function updateWorkspace(updater: (current: ProjectWorkspace) => ProjectWorkspace) {
    setWorkspaceState((current) => {
      const next = ensureWorkspaceVersion(updater(current));
      saveWorkspace(next);
      return next;
    });
  }

  function setProject(project: Project) {
    const normalized = normalizeProject(project);
    updateWorkspace((current) => ({
      ...current,
      project: normalized,
      tasks: projectInputsChanged(current.project, normalized) ? [] : current.tasks,
    }));
  }

  function confirmProject(project: Project, initialProject: Project) {
    const normalized = normalizeProject(project);
    updateWorkspace((current) => ({
      ...current,
      project: normalized,
      initialProject: normalizeProject(initialProject),
      tasks: projectInputsChanged(current.project, normalized) ? [] : current.tasks,
    }));
  }

  function loadExample(index: number) {
    const example = exampleCases[index];
    const next = createEmptyWorkspace(example.project);
    next.initialProject = example.project;
    next.evidenceRecords = evidenceSummaryToRecords(example.project.id, example.evidence);
    next.plans = normalizeGatePlans(emptyGatePlans);
    replaceWorkspace(next);
    setActiveGate("user");
    navigate("map");
  }

  function enterGate(gate: GateId = activeGate) {
    setActiveGate(gate);
    navigate("gate");
  }

  function updateActivePlan(plan: ProjectWorkspace["plans"][GateId]) {
    updateWorkspace((current) => ({ ...current, plans: { ...current.plans, [activeGate]: plan } }));
  }

  function addEvidenceRecord(record: ProjectWorkspace["evidenceRecords"][number]) {
    updateWorkspace((current) => ({ ...current, evidenceRecords: [record, ...current.evidenceRecords] }));
  }

  function saveSurvey(survey: ProjectWorkspace["surveys"][number]) {
    updateWorkspace((current) => ({
      ...current,
      surveys: [survey, ...current.surveys.filter((item) => item.id !== survey.id && !(item.gateId === survey.gateId && item.status === "published"))],
    }));
  }

  function updateEvidenceRecord(record: ProjectWorkspace["evidenceRecords"][number]) {
    updateWorkspace((current) => ({
      ...current,
      evidenceRecords: current.evidenceRecords.map((item) => item.id === record.id ? record : item),
    }));
  }

  function removeEvidenceRecord(recordId: string) {
    updateWorkspace((current) => ({
      ...current,
      evidenceRecords: current.evidenceRecords.filter((record) => record.id !== recordId),
      tasks: current.tasks.map((task) => ({ ...task, evidenceIds: task.evidenceIds.filter((id) => id !== recordId) })),
    }));
  }

  function addRedTeamTurn(turn: ProjectWorkspace["redTeamTurns"][number]) {
    updateWorkspace((current) => ({ ...current, redTeamTurns: [...current.redTeamTurns, turn].slice(-24) }));
  }

  function updateTask(task: ProjectWorkspace["tasks"][number]) {
    updateWorkspace((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? task : item) }));
  }

  function resetTasks() {
    updateWorkspace((current) => {
      const currentReport = buildWorkspaceReport(current);
      return { ...current, tasks: createValidationTasks(current.project.id, currentReport) };
    });
  }

  function replaceTasks(tasks: ProjectWorkspace["tasks"]) {
    updateWorkspace((current) => ({ ...current, tasks }));
  }

  async function copyReport() {
    try {
      const taskNotes = workspace.tasks.length > 0
        ? `\n## 任务执行记录\n${workspace.tasks.map((task) => `- 第 ${task.day} 天：${task.status === "completed" ? "已完成" : task.status === "failed" ? "未通过" : "待执行"}${task.result ? `；结果：${task.result}` : ""}`).join("\n")}`
        : "";
      await navigator.clipboard.writeText(`${report.markdown}${taskNotes}`);
      setCopyState("已复制");
    } catch {
      setCopyState("复制失败");
    }
    window.setTimeout(() => setCopyState("复制报告"), 1600);
  }

  function saveCurrentCalibration() {
    updateWorkspace((current) => {
      const currentReport = buildWorkspaceReport(current);
      const round = createCalibrationRound(current, currentReport, current.rounds[0]);
      return { ...current, rounds: [round, ...current.rounds].slice(0, 12) };
    });
    setSaveState("校准已保存");
    window.setTimeout(() => setSaveState("重新校准"), 1600);
  }

  return (
    <main className="journeyApp">
      <header className="journeyHeader">
        <button className="journeyBrand" type="button" onClick={() => navigate("departure")}>
          <span className="brandSignal" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>OPC创业红绿灯</strong><small>AI验证陪跑系统</small></span>
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
        <div className="headerUtilities">
          <button className="headerProject" type="button" onClick={() => navigate("departure")}>
            <Sparkles size={15} /><span>{workspace.project.name || "未命名项目"}</span>
          </button>
          <AccountMenu
            session={cloudSession}
            syncState={syncState}
            onRequestSignIn={requestEmailSignIn}
            onSignOut={signOutCloud}
          />
        </div>
      </header>

      {activeView !== "departure" && <JourneyStatusBar project={workspace.project} report={report} />}

      <div className={`journeyWorkspace view-${activeView}`}>
        <section className="journeyMain">
          {activeView === "departure" && (
            <ProjectDeparture
              project={workspace.project}
              onChange={setProject}
              onConfirm={confirmProject}
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
              userId={cloudSession.user?.id}
              surveys={workspace.surveys}
              onSaveSurvey={saveSurvey}
              onAddEvidence={addEvidenceRecord}
            />
          )}
          {activeView === "backpack" && (
            <EvidenceBackpack
              project={workspace.project}
              records={workspace.evidenceRecords}
              onAdd={addEvidenceRecord}
              onRemove={removeEvidenceRecord}
              onUpdate={updateEvidenceRecord}
            />
          )}
          {activeView === "route" && (
            <NextRoute
              report={report}
              project={workspace.project}
              evidence={evidence}
              records={workspace.evidenceRecords}
              tasks={workspace.tasks}
              rounds={workspace.rounds}
              redTeamTurns={workspace.redTeamTurns}
              onCopy={copyReport}
              copyState={copyState}
              onResetTasks={resetTasks}
              onReplaceTasks={replaceTasks}
              onOpenRefill={() => navigate("refill")}
              onOpenRedTeam={() => navigate("gate")}
              initialProject={workspace.initialProject}
              surveys={workspace.surveys}
            />
          )}
          {activeView === "refill" && (
            <EvidenceRefill
              report={report}
              tasks={workspace.tasks}
              records={workspace.evidenceRecords}
              rounds={workspace.rounds}
              onTaskChange={updateTask}
              onOpenBackpack={() => navigate("backpack")}
              onRecalibrate={saveCurrentCalibration}
              saveState={saveState}
            />
          )}
        </section>

      </div>
    </main>
  );
}

function ensureExecutionState(workspace: ProjectWorkspace): ProjectWorkspace {
  const report = buildWorkspaceReport(workspace);
  const hasCurrentTasks = workspace.tasks.length === 7 && workspace.tasks.every((task) => task.projectId === workspace.project.id);
  const withTasks = hasCurrentTasks ? workspace : { ...workspace, tasks: createValidationTasks(workspace.project.id, report) };
  const hasCurrentRound = withTasks.rounds.some((round) => round.projectId === workspace.project.id);
  if (hasCurrentRound) return withTasks;
  return { ...withTasks, rounds: [createCalibrationRound(withTasks, report)] };
}

function buildWorkspaceReport(workspace: ProjectWorkspace) {
  return buildReport(
    workspace.project,
    deriveEvidenceSummary(workspace.evidenceRecords),
    plansToRoadtestPlan(workspace.plans),
  );
}

function ensureWorkspaceVersion(workspace: ProjectWorkspace): ProjectWorkspace {
  return { ...workspace, schemaVersion: 4 };
}

function projectInputsChanged(previous: Project, current: Project) {
  return [
    "description",
    "targetUser",
    "painPoint",
    "alternative",
    "acquisition",
    "monetization",
    "currentStage",
    "existingArtifact",
  ].some((key) => previous[key as keyof Project] !== current[key as keyof Project]);
}
