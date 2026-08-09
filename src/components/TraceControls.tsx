import {
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  StepForward,
} from "lucide-react";
import type { SearchStep } from "../types";

interface TraceControlsProps {
  steps: SearchStep[];
  index: number;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  onIndexChange: (index: number) => void;
}

export default function TraceControls({
  steps,
  index,
  playing,
  onPlayingChange,
  onIndexChange,
}: TraceControlsProps) {
  if (!steps.length) return null;
  const current = steps[Math.min(index, steps.length - 1)];
  const details = Object.entries(current.details)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 5);
  const formatDetail = (value: unknown) =>
    typeof value === "number" ? value.toFixed(3).replace(/\.?0+$/, "") : String(value);
  return (
    <section className="trace-section" aria-label="Search animation">
      <div className="section-heading">
        <span>Search trace</span>
        <span className="step-count">{index + 1} / {steps.length}</span>
      </div>
      <div className="trace-status">
        <strong>{current.event}</strong>
        <span>{current.current_node ?? "-"}</span>
      </div>
      <div className="trace-counts">
        <span><b>{current.visited.length}</b> visited</span>
        <span><b>{current.frontier.length}</b> frontier</span>
      </div>
      {details.length > 0 && (
        <dl className="trace-details">
          {details.map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace("_", " ")}</dt>
              <dd>{formatDetail(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      <input
        className="trace-slider"
        type="range"
        min={0}
        max={Math.max(0, steps.length - 1)}
        value={index}
        onChange={(event) => onIndexChange(Number(event.target.value))}
        aria-label="Trace step"
      />
      <div className="icon-row">
        <button className="icon-button" title="First step" onClick={() => onIndexChange(0)}>
          <SkipBack size={17} />
        </button>
        <button
          className="icon-button primary-icon"
          title={playing ? "Pause animation" : "Play animation"}
          onClick={() => onPlayingChange(!playing)}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button
          className="icon-button"
          title="Next step"
          onClick={() => onIndexChange(Math.min(index + 1, steps.length - 1))}
        >
          <StepForward size={17} />
        </button>
        <button
          className="icon-button"
          title="Reset animation"
          onClick={() => {
            onPlayingChange(false);
            onIndexChange(0);
          }}
        >
          <RotateCcw size={17} />
        </button>
      </div>
    </section>
  );
}
