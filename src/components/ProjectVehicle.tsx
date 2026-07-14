interface ProjectVehicleProps {
  label?: string;
  size?: "tiny" | "small" | "large";
  loaded?: boolean;
}

export function ProjectVehicle({ label, size = "small", loaded = true }: ProjectVehicleProps) {
  return (
    <div className={`projectVehicle size-${size} ${loaded ? "loaded" : ""}`} aria-label={label ? `项目车：${label}` : "项目车"}>
      <div className="vehicleShadow" aria-hidden="true" />
      <div className="vehicleBody" aria-hidden="true">
        <div className="vehicleCargo">
          <i /><i /><i /><i />
        </div>
        <div className="vehicleCab"><span /></div>
        <div className="vehicleBumper" />
        <div className="vehicleLamp" />
      </div>
      <div className="vehicleWheel rear" aria-hidden="true"><i /></div>
      <div className="vehicleWheel front" aria-hidden="true"><i /></div>
      {label && <span className="vehicleLabel">{label}</span>}
    </div>
  );
}
