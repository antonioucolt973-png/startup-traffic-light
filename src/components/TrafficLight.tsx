import type { Light } from "../types";

interface TrafficLightProps {
  light: Light;
  label: string;
  reason: string;
}

const lights: Light[] = ["red", "yellow", "green", "blue"];

export function TrafficLight({ light, label, reason }: TrafficLightProps) {
  return (
    <div className={`trafficPanel ${light}`}>
      <div className="trafficHead">
        <span>当前灯号</span>
        <strong>{label}</strong>
      </div>
      <div className="trafficBody" aria-label={label}>
        {lights.map((item) => (
          <span key={item} className={`signal ${item} ${item === light ? "on" : ""}`} />
        ))}
      </div>
      <p>{reason}</p>
    </div>
  );
}
