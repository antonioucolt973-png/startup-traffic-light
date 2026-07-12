interface StepRailProps<T extends string> {
  steps: Array<{ id: T; label: string; icon: React.ComponentType<{ size?: number }> }>;
  activeStep: T;
  onStepChange: (step: T) => void;
}

export function StepRail<T extends string>({ steps, activeStep, onStepChange }: StepRailProps<T>) {
  return (
    <nav className="stepRail" aria-label="P0流程">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <button
            key={step.id}
            className={`stepItem ${activeStep === step.id ? "active" : ""}`}
            onClick={() => onStepChange(step.id)}
          >
            <span className="stepIndex">{String(index + 1).padStart(2, "0")}</span>
            <Icon size={18} />
            <span>{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
