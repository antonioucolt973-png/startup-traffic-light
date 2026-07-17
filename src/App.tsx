import { useEffect, useMemo, useRef, useState } from "react";
import { Backpack, BellRing, CarFront, ClipboardCheck, Flag, Flame, LayoutGrid, Map, RotateCcw, Route, Sparkles, UsersRound } from "lucide-react";
import { EvidenceBackpack } from "./components/EvidenceBackpack";
import { EvidenceRefill } from "./components/EvidenceRefill";
import { GateChallenge } from "./components/GateChallenge";
import { JourneyStatusBar } from "./components/JourneyStatusBar";
import { NextRoute } from "./components/NextRoute";
import { ProjectDeparture } from "./components/ProjectDeparture";
import { RouteOverview, type InitialValidationRoute } from "./components/RouteOverview";
import { AccountMenu } from "./components/AccountMenu";
import { ProjectManager } from "./components/ProjectManager";
import { ProjectVehicle } from "./components/ProjectVehicle";
import { exampleCases } from "./data/examples";
import {
  buildReport,
  deriveEvidenceSummary,
  emptyGatePlans,
  emptyProject,
  normalizeGatePlans,
  normalizeProject,
  plansToRoadtestPlan,
} from "./lib/decisionEngine";
import { ensureActiveCycle, transitionJourneyCycle } from "./lib/cycleEngine";
import {
  createEmptyWorkspace,
  createProjectLibraryEntry,
  evidenceSummaryToRecords,
  loadProjectLibrary,
  saveProjectLibrary,
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
  CycleOutcome,
  Project,
  ProjectLibrary,
  ProjectWorkspace,
} from "./types";

type ViewId = "departure" | "map" | "gate" | "backpack" | "route" | "refill";

const views: Array<{ id: ViewId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "departure", label: "项目出发", icon: Flag },
  { id: "map", label: "路线总览", icon: Map },
  { id: "gate", label: "路口决策", icon: Route },
  { id: "route", label: "任务执行", icon: ClipboardCheck },
  { id: "backpack", label: "证据背包", icon: Backpack },
  { id: "refill", label: "成长回顾", icon: RotateCcw },
];

export default function App() {
  const [projectLibrary, setProjectLibraryState] = useState<ProjectLibrary>(() => loadProjectLibrary());
  const [activeView, setActiveView] = useState<ViewId>("departure");
  const [focusedTaskId, setFocusedTaskId] = useState<string>();
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [cloudSession, setCloudSession] = useState<CloudSession>({ user: null, enabled: false });
  const [syncState, setSyncState] = useState("本地游客数据");
  const workspace = useMemo(
    () => projectLibrary.projects.find((entry) => entry.id === projectLibrary.activeProjectId)?.workspace ?? projectLibrary.projects[0].workspace,
    [projectLibrary],
  );
  const initialWorkspaceRef = useRef(workspace);

  const evidence = useMemo(() => deriveEvidenceSummary(workspace.evidenceRecords), [workspace.evidenceRecords]);
  const roadtestPlan = useMemo(() => plansToRoadtestPlan(workspace.plans), [workspace.plans]);
  const report = useMemo(
    () => buildReport(workspace.project, evidence, roadtestPlan),
    [workspace.project, evidence, roadtestPlan],
  );
  const activeCycle = useMemo(
    () => workspace.cycles.find((cycle) => cycle.id === workspace.activeCycleId),
    [workspace.activeCycleId, workspace.cycles],
  );
  const completedTaskCount = workspace.tasks.filter((task) => task.status === "completed").length;
  const progressTotal = Math.max(workspace.tasks.length, 3);
  const confirmedEvidenceCount = workspace.evidenceRecords.filter((record) => record.reviewStatus === "confirmed").length;
  const actionEnergy = Math.min(100, 20 + completedTaskCount * 15 + confirmedEvidenceCount * 5);
  const coachPrompt = useMemo(
    () => buildCoachPrompt(activeView, workspace.tasks, workspace.evidenceRecords, activeCycle?.primaryGoal, report.nextActions[0]),
    [activeCycle?.primaryGoal, activeView, report.nextActions, workspace.evidenceRecords, workspace.tasks],
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
    if (view !== "departure") {
      updateWorkspace((current) => ensureActiveCycle(current, buildWorkspaceReport(current)));
    }
    setActiveView(view);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function replaceWorkspace(next: ProjectWorkspace) {
    const normalized = ensureWorkspaceVersion(next);
    setProjectLibraryState((current) => storeActiveWorkspace(current, normalized));
  }

  function updateWorkspace(updater: (current: ProjectWorkspace) => ProjectWorkspace) {
    setProjectLibraryState((current) => {
      const active = getActiveWorkspace(current);
      return storeActiveWorkspace(current, ensureWorkspaceVersion(updater(active)));
    });
  }

  function selectProject(projectId: string) {
    setProjectLibraryState((current) => {
      if (!current.projects.some((entry) => entry.id === projectId)) return current;
      const next = { ...current, activeProjectId: projectId };
      saveProjectLibrary(next);
      return next;
    });
    setFocusedTaskId(undefined);
    setActiveView("departure");
    setShowProjectManager(false);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function createNewProject(kind: "demo" | "blank") {
    const id = crypto.randomUUID();
    const project: Project = kind === "demo"
      ? {
        ...emptyProject,
        id,
        name: "AI 试衣助手",
        description: "我想做一个 AI 一键试衣助手。用户上传自己的照片和衣服图，生成接近真实的试穿效果，帮助经常网购服装、担心上身效果的年轻女性在下单前判断衣服是否适合自己。目前已有一个可点击的换衣 Demo 和 5 位愿意试用的朋友。",
      }
      : { ...emptyProject, id };
    const entry = createProjectLibraryEntry(createEmptyWorkspace(project));
    setProjectLibraryState((current) => {
      const next: ProjectLibrary = {
        schemaVersion: 1,
        activeProjectId: entry.id,
        projects: [entry, ...current.projects.filter((item) => item.id !== entry.id)].slice(0, 24),
      };
      saveProjectLibrary(next);
      return next;
    });
    setFocusedTaskId(undefined);
    setActiveView("departure");
    setShowProjectManager(false);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function confirmProject(project: Project, initialProject: Project, initialRoute?: InitialValidationRoute) {
    const normalized = normalizeProject(project);
    const selectedPlans = initialRoute ? normalizeGatePlans({
      ...emptyGatePlans,
      user: {
        audience: initialRoute.audience,
        action: initialRoute.action,
        deadline: initialRoute.deadline,
        passCriteria: initialRoute.passCriteria,
        stopCriteria: initialRoute.stopCriteria,
      },
    }) : undefined;
    updateWorkspace((current) => {
      if (current.project.id !== normalized.id) {
        const next = createEmptyWorkspace(normalized);
        return {
          ...next,
          initialProject: normalizeProject(initialProject),
          plans: selectedPlans ?? next.plans,
        };
      }
      return {
        ...current,
        project: normalized,
        initialProject: current.initialProject ?? normalizeProject(initialProject),
        plans: selectedPlans ?? current.plans,
        tasks: projectInputsChanged(current.project, normalized) ? [] : current.tasks,
      };
    });
  }

  function confirmRouteAndEnterDecision(route: InitialValidationRoute) {
    updateWorkspace((current) => ({
      ...current,
      plans: normalizeGatePlans({
        ...current.plans,
        user: {
          audience: route.audience,
          action: route.action,
          deadline: route.deadline,
          passCriteria: route.passCriteria,
          stopCriteria: route.stopCriteria,
        },
      }),
    }));
    navigate("gate");
  }

  function loadExample(index: number) {
    const example = exampleCases[index];
    const next = createEmptyWorkspace(example.project);
    next.initialProject = example.project;
    next.evidenceRecords = evidenceSummaryToRecords(example.project.id, example.evidence);
    next.plans = normalizeGatePlans(emptyGatePlans);
    replaceWorkspace(next);
    navigate("map");
  }

  function updateEvidenceRecord(record: ProjectWorkspace["evidenceRecords"][number]) {
    updateWorkspace((current) => ({
      ...current,
      evidenceRecords: current.evidenceRecords.map((item) => item.id === record.id ? record : item),
    }));
  }

  function excludeEvidenceRecord(record: ProjectWorkspace["evidenceRecords"][number]) {
    updateWorkspace((current) => ({
      ...current,
      evidenceRecords: current.evidenceRecords.map((item) => item.id === record.id ? { ...item, reviewStatus: "rejected", assessment: "用户将该记录标记为无效证据，已从证据充分度中排除。" } : item),
      tasks: current.tasks.map((task) => task.id === record.taskId && task.workflowStatus === "completed" ? { ...task, status: "pending", workflowStatus: "needs_evidence" } : task),
    }));
  }

  function updateTask(task: ProjectWorkspace["tasks"][number]) {
    updateWorkspace((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? task : item) }));
  }

  function submitTaskEvidence(task: ProjectWorkspace["tasks"][number], record: ProjectWorkspace["evidenceRecords"][number], unlockNext: boolean) {
    updateWorkspace((current) => {
      const taskIndex = current.tasks.findIndex((item) => item.id === task.id);
      const tasks = current.tasks.map((item, index) => {
        if (item.id === task.id) return { ...task, cycleId: task.cycleId || current.activeCycleId || undefined };
        if (unlockNext && index === taskIndex + 1 && item.workflowStatus === "locked") return { ...item, workflowStatus: "ready" as const };
        return item;
      });
      return {
        ...current,
        tasks,
        evidenceRecords: [{ ...record, cycleId: record.cycleId || current.activeCycleId || undefined }, ...current.evidenceRecords],
      };
    });
  }

  function unlockNextTask(taskId: string) {
    updateWorkspace((current) => {
      const taskIndex = current.tasks.findIndex((task) => task.id === taskId);
      return { ...current, tasks: current.tasks.map((task, index) => index === taskIndex + 1 && task.workflowStatus === "locked" ? { ...task, workflowStatus: "ready" as const } : task) };
    });
  }

  function openTask(taskId?: string) {
    setFocusedTaskId(taskId);
    navigate("route");
  }

  function enterTaskExecution(tasks: ProjectWorkspace["tasks"]) {
    updateWorkspace((current) => ({
      ...current,
      tasks: tasks.map((task) => ({ ...task, cycleId: task.cycleId || current.activeCycleId || undefined })),
    }));
    setFocusedTaskId(tasks[0]?.id);
    navigate("route");
  }

  function startNextCycle(outcome: CycleOutcome, aiReview: string, nextGoal: string) {
    const next = transitionJourneyCycle(workspace, report, outcome, aiReview, nextGoal);
    replaceWorkspace(next);
    setActiveView("departure");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  return (
    <main className="journeyApp">
      <header className="journeyHeader">
        <button className="journeyBrand" type="button" onClick={() => navigate("departure")}>
          <span className="brandSignal" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>OPC创业红绿灯</strong><small>AI验证陪跑系统</small></span>
        </button>
        <nav className="topWorkspaceNav" aria-label="全局导航">
          <button className="active" type="button" onClick={() => navigate("departure")}><LayoutGrid size={15} />工作台</button>
          <button className={showProjectManager ? "active" : ""} type="button" onClick={() => setShowProjectManager(true)}><Flag size={15} />我的项目</button>
        </nav>
        <div className="headerUtilities">
          <AccountMenu
            session={cloudSession}
            syncState={syncState}
            onRequestSignIn={requestEmailSignIn}
            onSignOut={signOutCloud}
          />
          <button className="proEntry" type="button" title="Pro 能力将在后续版本开放"><Sparkles size={15} /><span>Pro</span><small>即将开放</small></button>
        </div>
      </header>

      {showProjectManager ? (
        <ProjectManager
          projects={projectLibrary.projects}
          activeProjectId={projectLibrary.activeProjectId}
          onClose={() => setShowProjectManager(false)}
          onSelect={selectProject}
          onCreateDemo={() => createNewProject("demo")}
          onCreateBlank={() => createNewProject("blank")}
        />
      ) : null}

      <div className="journeyAppShell">
        <aside className="journeySidebar" aria-label="创业旅程导航">
          <div className="sidebarHeading"><span>创业旅程</span><strong>第 {activeCycle?.cycleNumber ?? 1} 轮</strong></div>
          <nav className="journeyNav" aria-label="创业校准流程">
            {views.map((view, index) => {
              const Icon = view.icon;
              return (
                <button key={view.id} className={activeView === view.id ? "active" : ""} type="button" onClick={() => navigate(view.id)}>
                  <span>{String(index + 1).padStart(2, "0")}</span><Icon size={17} /><b>{view.label}</b>
                </button>
              );
            })}
          </nav>
          <article className="sidebarVehicle">
            <div><span>项目车状态</span><strong>{workspace.project.name || "等待装载想法"}</strong></div>
            <ProjectVehicle size="small" loaded={Boolean(workspace.project.description)} />
            <small>{workspace.project.description ? "已装载，等待现实反馈" : "输入一句想法即可启程"}</small>
          </article>
          <article className="sidebarEnergy">
            <Flame size={17} /><div><span>行动能量</span><strong>{actionEnergy}</strong></div><em>/100</em>
          </article>
          <article className="sidebarProgress" aria-label="本轮进度">
            <div><span>本轮进度</span><strong>{completedTaskCount}/{progressTotal}</strong></div>
            <i><b style={{ width: `${Math.min(100, Math.round(completedTaskCount / progressTotal * 100))}%` }} /></i>
            <small>完成现实任务后，项目车才会继续前进。</small>
          </article>
          <div className="sidebarFutureLinks" aria-label="后续能力入口">
            <button type="button" title="车辆成长与车库将在后续版本开放"><CarFront size={15} />项目车库<small>即将开放</small></button>
            <button type="button" title="任务提醒将在后续版本开放"><BellRing size={15} />提醒设置<small>即将开放</small></button>
            <button type="button" title="团队协作将在后续版本开放"><UsersRound size={15} />团队协作<small>即将开放</small></button>
          </div>
        </aside>

        <div className={`journeyWorkspace view-${activeView}`}>
          <section className="journeyMain">
          {activeView === "departure" && (
            <ProjectDeparture
              key={workspace.project.id}
              project={workspace.project}
              onConfirm={confirmProject}
              onLoadExample={loadExample}
              onReady={() => navigate("map")}
              activeCycle={activeCycle}
              completedCycles={workspace.cycles.filter((cycle) => cycle.status === "completed")}
            />
          )}
          {activeView === "map" && (
            <RouteOverview
              project={workspace.project}
              initialProject={workspace.initialProject}
              onBack={() => navigate("departure")}
              onConfirmRoute={confirmRouteAndEnterDecision}
            />
          )}
          {activeView === "gate" && (
            <GateChallenge
              project={workspace.project}
              selectedRoute={workspace.plans.user}
              onEnterTasks={enterTaskExecution}
            />
          )}
          {activeView === "backpack" && (
            <EvidenceBackpack
              records={workspace.evidenceRecords}
              tasks={workspace.tasks}
              onUpdate={updateEvidenceRecord}
              onExclude={excludeEvidenceRecord}
              onOpenTask={openTask}
            />
          )}
          {activeView === "route" && (
            <NextRoute
              project={workspace.project}
              records={workspace.evidenceRecords}
              tasks={workspace.tasks}
              initialTaskId={focusedTaskId}
              onUpdateTask={updateTask}
              onSubmitEvidence={submitTaskEvidence}
              onUnlockNext={unlockNextTask}
              onOpenBackpack={() => navigate("backpack")}
            />
          )}
          {activeView === "refill" && (
            <EvidenceRefill
              report={report}
              project={workspace.project}
              initialProject={workspace.initialProject}
              tasks={workspace.tasks}
              records={workspace.evidenceRecords}
              rounds={workspace.rounds}
              activeCycle={activeCycle}
              completedCycles={workspace.cycles.filter((cycle) => cycle.status === "completed")}
              onOpenBackpack={() => navigate("backpack")}
              onStartNextCycle={startNextCycle}
            />
          )}
          </section>
        </div>

        <aside className="journeyInsightRail" aria-label="项目实时状态">
          <JourneyStatusBar project={workspace.project} report={report} activeCycle={activeCycle} />
          <article className="aiPromptCard">
            <Sparkles size={17} />
            <div><span>AI 陪跑提示 · {coachPrompt.label}</span><strong>{coachPrompt.message}</strong></div>
          </article>
        </aside>
      </div>
    </main>
  );
}

function buildWorkspaceReport(workspace: ProjectWorkspace) {
  return buildReport(
    workspace.project,
    deriveEvidenceSummary(workspace.evidenceRecords),
    plansToRoadtestPlan(workspace.plans),
  );
}

function ensureWorkspaceVersion(workspace: ProjectWorkspace): ProjectWorkspace {
  return { ...workspace, schemaVersion: 5 };
}

function getActiveWorkspace(library: ProjectLibrary): ProjectWorkspace {
  return library.projects.find((entry) => entry.id === library.activeProjectId)?.workspace ?? library.projects[0].workspace;
}

function storeActiveWorkspace(library: ProjectLibrary, workspace: ProjectWorkspace): ProjectLibrary {
  const previousId = library.activeProjectId;
  const entry = createProjectLibraryEntry(workspace);
  const next: ProjectLibrary = {
    schemaVersion: 1,
    activeProjectId: entry.id,
    projects: [entry, ...library.projects.filter((item) => item.id !== previousId && item.id !== entry.id)].slice(0, 24),
  };
  saveProjectLibrary(next);
  return next;
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

function buildCoachPrompt(
  activeView: ViewId,
  tasks: ProjectWorkspace["tasks"],
  records: ProjectWorkspace["evidenceRecords"],
  cycleGoal: string | undefined,
  fallback: string | undefined,
) {
  const needsEvidence = tasks.find((task) => task.workflowStatus === "needs_evidence");
  if (needsEvidence) return {
    label: "需要补证",
    message: `“${compactTaskTitle(needsEvidence.title)}”证据不足，请补充用户原话、有效数量和可复核材料。`,
  };

  const blocked = tasks.find((task) => task.workflowStatus === "blocked");
  if (blocked) return {
    label: "任务受阻",
    message: `“${compactTaskTitle(blocked.title)}”遇到困难。先缩小样本或更换触达方式，不要直接增加开发投入。`,
  };

  const delayed = tasks.find((task) => task.workflowStatus === "delayed");
  if (delayed) return {
    label: "任务延期",
    message: `“${compactTaskTitle(delayed.title)}”已延期${delayed.delayedUntil ? `至 ${delayed.delayedUntil}` : ""}，到期前准备好对象和执行材料。`,
  };

  const pendingEvidence = records.filter((record) => record.reviewStatus === "pending");
  if (activeView === "backpack" && pendingEvidence.length > 0) return {
    label: "背包待处理",
    message: `证据背包有 ${pendingEvidence.length} 条记录需要补证。优先返回对应任务补齐材料。`,
  };

  if (activeView === "refill") return {
    label: "下一轮目标",
    message: cycleGoal || "根据本轮已确认证据，确认下一轮只验证一个最高风险假设。",
  };

  const ready = tasks.find((task) => task.workflowStatus === "ready" || (!task.workflowStatus && task.status === "pending"));
  if (ready) return {
    label: "当前任务",
    message: `${compactTaskTitle(ready.title)}。完成真实行动并提交证据后，才会解锁下一任务。`,
  };

  if (tasks.length > 0 && tasks.every((task) => task.workflowStatus === "completed" || task.workflowStatus === "skipped")) return {
    label: "本轮已结算",
    message: "本轮任务已经处理完毕，请进入成长回顾，结算假设并选择下一轮方向。",
  };

  return {
    label: "当前重点",
    message: fallback || "先输入一句想法，让 AI 帮你拆成可行动的路线。",
  };
}

function compactTaskTitle(title: string) {
  return title.replace(/^M\d+[^·]*·\s*/, "").replace(/^第\s*\d+\s*天\s*·\s*/, "");
}
