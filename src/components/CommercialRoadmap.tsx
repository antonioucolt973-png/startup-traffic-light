import { Background, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { BadgeDollarSign, Check, Flag, Rocket, UsersRound } from "lucide-react";
import "@xyflow/react/dist/style.css";
import type { GateId, Project, RoadtestCheck } from "../types";

type MilestoneState = "completed" | "active" | "locked";

interface MilestoneDefinition {
  icon: "flag" | "rocket" | "users" | "money";
  title: string;
  duration: string;
  detail: string;
  tasks: string[];
  state: MilestoneState;
  gate: GateId;
}

type MilestoneData = MilestoneDefinition & Record<string, unknown> & {
  onSelect: (gate: GateId) => void;
};

interface CommercialRoadmapProps {
  project: Project;
  checks: RoadtestCheck[];
  activeGate: GateId;
  onSelectGate: (gate: GateId) => void;
}

const iconMap = {
  flag: Flag,
  rocket: Rocket,
  users: UsersRound,
  money: BadgeDollarSign,
};

function MilestoneNode({ data }: NodeProps<Node<MilestoneData>>) {
  const Icon = iconMap[data.icon];
  return (
    <article className={`milestoneNode state-${data.state}`}>
      <Handle type="target" position={Position.Left} />
      <button type="button" onClick={() => data.onSelect(data.gate)}>
        <span className="milestoneNodeIcon"><Icon size={18} /></span>
        <span className="milestoneNodeCopy">
          <small>{data.state === "completed" ? "已解锁" : data.state === "active" ? "当前主线" : "后续里程碑"}</small>
          <strong>{data.title}</strong>
          <em>{data.duration}</em>
        </span>
        {data.state === "completed" && <Check className="milestoneDone" size={16} />}
      </button>
      <p>{data.detail}</p>
      <ul>{data.tasks.map((task) => <li key={task}>{task}</li>)}</ul>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}

const nodeTypes = { milestone: MilestoneNode };

function isPassed(checks: RoadtestCheck[], ids: GateId[]) {
  return ids.every((id) => checks.find((check) => check.id === id)?.status === "已通过");
}

export function CommercialRoadmap({ project, checks, activeGate, onSelectGate }: CommercialRoadmapProps) {
  const demandComplete = isPassed(checks, ["user", "pain", "alternative"]);
  const mvpComplete = checks.find((check) => check.id === "delivery")?.status === "已通过";
  const seedComplete = isPassed(checks, ["acquisition", "payment"]);
  const paidSignals = checks.find((check) => check.id === "payment")?.status === "已通过";

  const milestones: MilestoneDefinition[] = [
    {
      icon: "flag",
      title: "M1 验证需求",
      duration: "建议 1-2 周",
      detail: "先确认真实用户、痛点与替代方案，不用开发替代验证。",
      tasks: ["找到 5 位目标用户", "记录原话与现有替代方案"],
      state: demandComplete ? "completed" : "active",
      gate: activeGate === "user" || activeGate === "pain" || activeGate === "alternative" ? activeGate : "user",
    },
    {
      icon: "rocket",
      title: "M2 最小验证",
      duration: "建议 1 周",
      detail: "用手动服务、原型或演示验证价值，不先做完整产品。",
      tasks: ["定义最小交付物", "邀请至少 3 人体验"],
      state: mvpComplete ? "completed" : demandComplete ? "active" : "locked",
      gate: "delivery",
    },
    {
      icon: "users",
      title: "M3 种子用户",
      duration: "建议 1-2 周",
      detail: "跑通具体获客入口，获得主动反馈与持续试用。",
      tasks: ["发布一条可验证内容", "记录主动私信或预约"],
      state: seedComplete ? "completed" : demandComplete && mvpComplete ? "active" : "locked",
      gate: "acquisition",
    },
    {
      icon: "money",
      title: "M4 商业闭环",
      duration: "证据触发",
      detail: "用报价、预订或付费信号判断是否值得扩大投入。",
      tasks: ["明确为哪个结果报价", "记录接受或拒绝原因"],
      state: paidSignals ? "completed" : seedComplete ? "active" : "locked",
      gate: "payment",
    },
  ];

  const nodes: Array<Node<MilestoneData>> = milestones.map((milestone, index) => ({
    id: `milestone-${index + 1}`,
    type: "milestone",
    position: { x: index * 265, y: index % 2 === 0 ? 54 : 190 },
    draggable: false,
    selectable: false,
    data: { ...milestone, onSelect: onSelectGate },
  }));

  const edges: Edge[] = milestones.slice(0, -1).map((_, index) => ({
    id: `edge-${index + 1}`,
    source: `milestone-${index + 1}`,
    target: `milestone-${index + 2}`,
    animated: milestones[index].state === "completed" || milestones[index + 1].state === "active",
    style: { stroke: milestones[index + 1].state === "locked" ? "#cbd7d0" : "#2788d8", strokeWidth: 2 },
  }));

  const completeCount = milestones.filter((milestone) => milestone.state === "completed").length;
  const currentMilestone = milestones.find((milestone) => milestone.state === "active") ?? milestones[milestones.length - 1];

  return (
    <section className="commercialRoadmap" aria-label="商业化落地路径地图">
      <header>
        <div><span>商业化落地路径</span><h2>{project.name || "当前项目"} 的本轮路线</h2></div>
        <div className="roadmapHeaderStats"><strong>{completeCount}<small>/4</small></strong><span>已点亮里程碑</span></div>
      </header>
      <div className="roadmapCanvas">
        <ReactFlow<Node<MilestoneData>, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnDoubleClick={false}
          zoomOnPinch={false}
          zoomOnScroll={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e0ebe5" gap={18} size={1} />
        </ReactFlow>
      </div>
      <footer>
        <div><span>当前主线</span><strong>{currentMilestone.title}</strong><p>{currentMilestone.detail}</p></div>
        <button type="button" className="primaryButton" onClick={() => onSelectGate(currentMilestone.gate)}>进入当前验证站</button>
      </footer>
    </section>
  );
}
