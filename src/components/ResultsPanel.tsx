import { Clock3, Gauge, Route, Search, Waypoints } from "lucide-react";
import type {
  Bootstrap,
  ComparePayload,
  MultiPayload,
  SearchPayload,
  SearchStep,
} from "../types";
import CompareTable from "./CompareTable";
import TraceControls from "./TraceControls";

interface ResultsPanelProps {
  bootstrap: Bootstrap;
  searchPayload: SearchPayload | null;
  multiPayload: MultiPayload | null;
  comparison: ComparePayload | null;
  selectedCompare: string | null;
  onSelectCompare: (payload: SearchPayload) => void;
  steps: SearchStep[];
  stepIndex: number;
  playing: boolean;
  onPlayingChange: (value: boolean) => void;
  onStepIndexChange: (value: number) => void;
}

const formatNumber = (value: number | null | undefined, digits = 2) =>
  value == null ? "-" : value.toFixed(digits);

const multiMethodLabel = (method: string) => ({
  nearest_neighbor: "Nearest Neighbor (approximate)",
  exact_bruteforce: "Exact Brute Force",
}[method] ?? method.replaceAll("_", " "));

const optimalityLabel = (value: string) => ({
  approximate_not_guaranteed: "Approximate route — fast, but not guaranteed globally optimal.",
  optimal_for_reduced_pairwise_problem: "Globally optimal visiting order for the computed pairwise route costs.",
  not_applicable: "Optimality is not applicable because no complete route was found.",
}[value] ?? value.replaceAll("_", " "));

export default function ResultsPanel(props: ResultsPanelProps) {
  const {
    bootstrap,
    searchPayload,
    multiPayload,
    comparison,
    selectedCompare,
    onSelectCompare,
    steps,
    stepIndex,
    playing,
    onPlayingChange,
    onStepIndexChange,
  } = props;

  const metrics = searchPayload?.result ?? multiPayload?.result;
  const runtimeLabel = searchPayload && steps.length > 0
    ? "Runtime + trace"
    : "Runtime";
  const lastVisitedLandmark = multiPayload?.visiting_landmarks[
    Math.max(0, (multiPayload?.visiting_landmarks.length ?? 1) - 1)
  ];
  const multiEndName = multiPayload
    ? multiPayload.request.return_to_start
      ? multiPayload.request.start.name
      : multiPayload.request.end?.name
        ?? lastVisitedLandmark?.name
        ?? multiPayload.request.start.name
    : "";
  const constrainedFinalStop = multiPayload
    ? multiPayload.request.return_to_start
      ? multiPayload.request.start
      : multiPayload.request.end
    : null;
  const displayedMultiStops = multiPayload
    ? [
        ...multiPayload.visiting_landmarks.filter(
          (landmark) => landmark.id !== constrainedFinalStop?.id,
        ),
        ...(constrainedFinalStop ? [constrainedFinalStop] : []),
      ]
    : [];
  const routeRoads = searchPayload
    ? Array.from(
        new Set(
          searchPayload.route_segments
            .map((segment) => segment.name)
            .filter((name) => name && name !== "Unnamed road"),
        ),
      )
    : [];
  return (
    <aside className="results-panel">
      <div className="panel-title-row">
        <h2>Route analysis</h2>
        <span className="network-badge">
          {String(bootstrap.network_summary.routable_nodes)} nodes
        </span>
      </div>

      {!metrics && !comparison && !steps.length && (
        <div className="empty-results">
          <Search size={28} />
          <strong>Network ready</strong>
          <span>{String(bootstrap.network_summary.routable_edges)} directed edges</span>
          <span>{bootstrap.landmarks.length} landmarks</span>
        </div>
      )}

      {metrics && (
        <div className="metrics-grid">
          <div className="metric"><Route size={16} /><span>Distance</span><strong>{formatNumber(metrics.total_distance_km)} km</strong></div>
          <div className="metric"><Clock3 size={16} /><span>Time</span><strong>{formatNumber(metrics.total_time_min, 1)} min</strong></div>
          <div className="metric"><Gauge size={16} /><span>Cost</span><strong>{formatNumber(metrics.total_cost)}</strong></div>
          <div className="metric" title={runtimeLabel === "Runtime + trace" ? "Includes trace-event generation for the animation" : undefined}>
            <Search size={16} /><span>{runtimeLabel}</span><strong>{formatNumber(metrics.runtime_ms, 2)} ms</strong>
          </div>
        </div>
      )}

      {searchPayload && (
        <>
          <div className="search-stats" aria-label="Search statistics">
            <span><b>{searchPayload.result.path.length}</b> path nodes</span>
            <span><b>{searchPayload.result.expanded_nodes}</b> expanded</span>
            <span><b>{searchPayload.result.generated_nodes}</b> generated</span>
          </div>
          <section className="result-section">
            <div className="section-heading">
              <span>{searchPayload.result.success ? "Path found" : "No path found"}</span>
            </div>
            <p className="route-endpoints">
              <strong>{searchPayload.request.start.name}</strong>
              <span>to</span>
              <strong>{searchPayload.request.goal.name}</strong>
            </p>
            <div className="road-chain">
              {routeRoads.slice(0, 7).map((name) => <span key={name}>{name}</span>)}
              {routeRoads.length > 7 && <span>+{routeRoads.length - 7} roads</span>}
            </div>
          </section>
          <section className="result-section">
            <div className="section-heading"><span>Why this route</span></div>
            <p className="result-headline">{searchPayload.explanation.headline}</p>
            <ul className="reason-list">
              {searchPayload.explanation.reasons?.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            {(searchPayload.explanation.high_congestion_segments?.length ?? 0) > 0 && (
              <div className="congestion-list">
                <strong>High-congestion segments</strong>
                {searchPayload.explanation.high_congestion_segments?.slice(0, 5).map((segment, index) => (
                  <span key={`${segment.name}-${index}`}>
                    {segment.name} ({segment.segment_count} segment{segment.segment_count === 1 ? "" : "s"}): level {segment.congestion.toFixed(1)}
                  </span>
                ))}
              </div>
            )}
            <p className="optimality-note">{searchPayload.explanation.optimality_note}</p>
          </section>
          {searchPayload.alternative && searchPayload.explanation.alternative_comparison && (
            <section className="result-section">
              <div className="section-heading"><span>Alternative baseline</span></div>
              <p className="result-headline">
                {searchPayload.explanation.alternative_comparison.label}
              </p>
              <div className="alternative-metrics">
                <span><b>{formatNumber(searchPayload.alternative.result.total_cost)}</b> cost</span>
                <span><b>{formatNumber(searchPayload.alternative.result.total_distance_km)}</b> km</span>
                <span><b>{formatNumber(searchPayload.alternative.result.total_time_min, 1)}</b> min</span>
                <span><b>{searchPayload.alternative.result.expanded_nodes}</b> expanded</span>
              </div>
            </section>
          )}
        </>
      )}

      {steps.length > 0 && (
        <TraceControls
          steps={steps}
          index={stepIndex}
          playing={playing}
          onPlayingChange={onPlayingChange}
          onIndexChange={onStepIndexChange}
        />
      )}

      {multiPayload && (
        <section className="result-section">
          <div className="section-heading"><span>Optimized visiting order</span><Waypoints size={16} /></div>
          <p className="route-endpoints">
            <strong>Start: {multiPayload.request.start.name}</strong>
            <span>to</span>
            <strong>
              {multiEndName}
            </strong>
          </p>
          <div className="multi-constraints" aria-label="Multi-route constraints">
            <div>
              <span>End rule</span>
              <strong>
                {multiPayload.request.return_to_start
                  ? `Start: ${multiPayload.request.start.name}`
                  : multiPayload.request.end
                    ? `Fixed: ${multiPayload.request.end.name}`
                    : "Flexible end"}
              </strong>
            </div>
            <div>
              <span>Route closure</span>
              <strong>{multiPayload.request.return_to_start ? "Closed loop" : "Open route"}</strong>
            </div>
          </div>
          <div className="multi-method-summary">
            <span>Method</span>
            <strong>{multiMethodLabel(multiPayload.request.method)}</strong>
          </div>
          <div className="requested-order">
            <strong>Selected waypoints</strong>
            <span>{multiPayload.request.waypoints.map((item) => item.name).join(" -> ")}</span>
          </div>
          <ol className="visit-order">
            {displayedMultiStops.map((landmark, index) => (
              <li key={`${landmark.id}-${index}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{landmark.name}</strong>
                  <small>
                    {landmark.category}
                    {constrainedFinalStop?.id === landmark.id
                      ? multiPayload.request.return_to_start
                        ? " · return"
                        : " · fixed end"
                      : ""}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          <p className="optimality-note">
            {optimalityLabel(multiPayload.explanation.optimality_note)}
          </p>
          {multiPayload.comparison && (
            <div className="multi-comparison">
              <strong>Method comparison</strong>
              <table>
                <thead><tr><th>Method</th><th>Cost</th><th>km</th><th>ms</th></tr></thead>
                <tbody>
                  <tr>
                    <td>Nearest</td>
                    <td>{formatNumber(multiPayload.comparison.nearest_neighbor.total_cost)}</td>
                    <td>{formatNumber(multiPayload.comparison.nearest_neighbor.total_distance_km)}</td>
                    <td>{formatNumber(multiPayload.comparison.nearest_neighbor.runtime_ms)}</td>
                  </tr>
                  <tr>
                    <td>Exact</td>
                    <td>{formatNumber(multiPayload.comparison.exact_bruteforce.total_cost)}</td>
                    <td>{formatNumber(multiPayload.comparison.exact_bruteforce.total_distance_km)}</td>
                    <td>{formatNumber(multiPayload.comparison.exact_bruteforce.runtime_ms)}</td>
                  </tr>
                </tbody>
              </table>
              <p>
                Nearest-neighbor gap: {formatNumber(
                  multiPayload.comparison.nearest_neighbor.comparison_gap_percent,
                )}%
              </p>
            </div>
          )}
        </section>
      )}

      {comparison && (
        <CompareTable
          comparison={comparison}
          algorithms={bootstrap.algorithms}
          selected={selectedCompare}
          onSelect={onSelectCompare}
        />
      )}
    </aside>
  );
}
