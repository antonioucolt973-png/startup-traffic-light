import type { CSSProperties, ComponentType } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  Flag,
  HeartPulse,
  Repeat2,
  Send,
  UserRound,
  Wrench,
} from "lucide-react";
import { motion } from "motion/react";
import type { DecisionReport, GateId, Project, RoadtestStage } from "../types";
import { ProjectVehicle } from "./ProjectVehicle";

interface JourneyMapScreenProps {
  project: Project;
  report: DecisionReport;
  activeGate: GateId;
  onGateChange: (gate: GateId) => void;
  onEnterGate: () => void;
}

interface RoutePoint {
  id: GateId;
  x: number;
  y: number;
  icon: ComponentType<{ size?: number }>;
}

const routePoints: RoutePoint[] = [
  { id: "user", x: 7, y: 68, icon: UserRound },
  { id: "pain", x: 20, y: 39, icon: HeartPulse },
  { id: "alternative", x: 34, y: 65, icon: Repeat2 },
  { id: "acquisition", x: 49, y: 33, icon: Send },
  { id: "payment", x: 64, y: 58, icon: BadgeDollarSign },
  { id: "delivery", x: 79, y: 27, icon: Wrench },
];

const stageMeta: Array<{ id: RoadtestStage; label: string; detail: string }> = [
  { id: "demand", label: "用户村 · 需求森林", detail: "确认谁真的有问题" },
  { id: "transaction", label: "获客高架 · 付费港口", detail: "验证触达与交易" },
  { id: "delivery", label: "交付工厂", detail: "确认一人能兑现" },
];

export function JourneyMapScreen({ project, report, activeGate, onGateChange, onEnterGate }: JourneyMapScreenProps) {
  const compactMap = typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;
  const displayPoints = compactMap
    ? routePoints.map((point, index) => ({ ...point, x: 18, y: 17 + index * 13.5 }))
    : routePoints;
  const active = report.roadtestChecks.find((gate) => gate.id === activeGate) ?? report.roadtestChecks[0];
  const activePoint = displayPoints.find((point) => point.id === activeGate) ?? displayPoints[0];
  const passedCount = report.roadtestChecks.filter((gate) => gate.status === "已通过").length;

  return (
    <div className="mapScreen expeditionScreen">
      <header className="mapHeader expeditionHeader">
        <div>
          <span className="routeEyebrow">创业旅行地图</span>
          <h1>在地图上看见项目，正在被现实推向哪里。</h1>
          <p>选择一个地点，项目车会驶入对应挑战。AI负责规划路线，只有访谈、试用、报价和付款等真实行为能点亮道路。</p>
        </div>
        <div className="mapProgressSummary">
          <span>当前旅程</span>
          <strong>{passedCount}<small>/6 路口通过</small></strong>
          <div><i style={{ width: `${(passedCount / 6) * 100}%` }} /></div>
          <p>{project.name || "未命名项目"}</p>
        </div>
      </header>

      <section className="expeditionMap" aria-label="创业验证旅行地图">
        <div className="mapHudTitle"><span>OPC VALIDATION WORLD</span><strong>{project.name || "未命名项目"}</strong></div>
        <div className="mapRegionLabels" aria-hidden="true">
          {stageMeta.map((stage) => <div key={stage.id}><strong>{stage.label}</strong><span>{stage.detail}</span></div>)}
        </div>

        <svg className="mapArtwork" viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="worldRoad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#51ddff" /><stop offset=".56" stopColor="#35ace7" /><stop offset="1" stopColor="#20c86a" /></linearGradient>
            <linearGradient id="worldLand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#123b4f" /><stop offset="1" stopColor="#0a2432" /></linearGradient>
            <filter id="roadGlow"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <path className="mapHill far" d="M0 176 C130 86 245 147 340 100 C455 43 560 125 650 83 C760 31 865 98 962 61 C1060 23 1140 55 1200 19 L1200 560 L0 560 Z" />
          <path className="mapHill near" d="M0 324 C120 245 230 303 330 250 C450 186 555 291 660 223 C780 145 900 271 1010 204 C1080 162 1140 178 1200 151 L1200 560 L0 560 Z" />
          <g className="mapPlatform platform-one"><ellipse cx="155" cy="360" rx="118" ry="64" /><ellipse cx="155" cy="348" rx="118" ry="64" /></g>
          <g className="mapPlatform platform-two"><ellipse cx="523" cy="350" rx="126" ry="67" /><ellipse cx="523" cy="338" rx="126" ry="67" /></g>
          <g className="mapPlatform platform-three"><ellipse cx="873" cy="302" rx="132" ry="70" /><ellipse cx="873" cy="290" rx="132" ry="70" /></g>
          <g className="mapBuildings">
            <path d="M108 282 h70 v74 h-70z M122 259 h42 v23 h-42z M185 313 h42 v43 h-42z" />
            <path d="M620 158 h78 v105 h-78z M640 132 h38 v26 h-38z M706 203 h40 v60 h-40z" />
            <path d="M997 100 h88 v120 h-88z M1017 72 h48 v28 h-48z M1092 159 h40 v61 h-40z" />
          </g>
          <g className="mapTrees">
            <circle cx="58" cy="300" r="24" /><circle cx="318" cy="174" r="20" /><circle cx="520" cy="300" r="25" />
            <circle cx="820" cy="168" r="22" /><circle cx="940" cy="372" r="26" /><circle cx="1140" cy="262" r="22" />
          </g>
          <path className="mapRoadDepth" d="M95 382 C180 382 205 220 290 220 S405 362 480 362 S595 184 684 184 S808 324 888 324 S1015 150 1092 150" />
          <path className="mapRoadBorder" d="M95 382 C180 382 205 220 290 220 S405 362 480 362 S595 184 684 184 S808 324 888 324 S1015 150 1092 150" />
          <path className="mapRoad" d="M95 382 C180 382 205 220 290 220 S405 362 480 362 S595 184 684 184 S808 324 888 324 S1015 150 1092 150" />
          <path className="mapRoadDash" d="M95 382 C180 382 205 220 290 220 S405 362 480 362 S595 184 684 184 S808 324 888 324 S1015 150 1092 150" />
        </svg>

        <aside className="mapWorldRail" aria-label="当前路线状态">
          <div className={`worldRailLight light-${report.light}`}><span>当前灯号</span><strong>{report.lightLabel}</strong><div><i /><i /><i /><i /></div></div>
          <div><span>证据能量</span><strong>{report.evidenceScore}<small>/100</small></strong><progress max="100" value={report.evidenceScore} /></div>
          <div><span>地图进度</span><strong>{passedCount}<small>/6</small></strong><p>已通过现实路口</p></div>
        </aside>

        <motion.div
          className="mapVehicleMarker"
          animate={{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }}
          transition={{ type: "spring", stiffness: 72, damping: 17, mass: 0.9 }}
        >
          <ProjectVehicle size="small" label={project.name || "项目车"} />
        </motion.div>

        {displayPoints.map((point, index) => {
          const gate = report.roadtestChecks.find((item) => item.id === point.id)!;
          const Icon = point.icon;
          const style = { "--map-x": `${point.x}%`, "--map-y": `${point.y}%` } as CSSProperties;
          return (
            <button
              type="button"
              key={point.id}
              style={style}
              className={`mapStop status${gate.status} ${activeGate === point.id ? "active" : ""}`}
              onClick={() => onGateChange(point.id)}
              aria-label={`${gate.title}，${gate.status}`}
            >
              <span className="mapStopNumber">{String(index + 1).padStart(2, "0")}</span>
              <span className="mapStopIcon"><Icon size={20} /></span>
              <span className="mapStopCopy"><strong>{gate.title}</strong><small>{gate.status}</small></span>
            </button>
          );
        })}

        <div className="mapFinish" aria-hidden="true"><Flag size={22} /><span>持续交付</span></div>
      </section>

      <section className={`mapGateFocus expeditionGateFocus status${active.status}`}>
        <div><span>正在查看</span><strong>{active.title}</strong><p>{active.scene}</p></div>
        <div><span>当前路况</span><strong>{active.status}</strong><p>{active.feedback}</p></div>
        <button className="primaryButton" onClick={onEnterGate} type="button">驶入这个路口<ArrowRight size={17} /></button>
      </section>
    </div>
  );
}
