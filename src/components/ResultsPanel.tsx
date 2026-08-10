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
          <div className="metric"><Search size={16} /><span>Runtime</span><strong>{formatNumber(metrics.runtime_ms, 2)} ms</strong></div>
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
            {searchPayload.result.path.length > 0 && (
              <details className="node-path">
                <summary>Graph node path</summary>
                <code>{searchPayload.result.path.join(" -> ")}</code>
              </details>
            )}
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
              {multiPayload.request.return_to_start
                ? multiPayload.request.start.name
                : multiPayload.request.end?.name ?? "Flexible end"}
            </strong>
          </p>
          <div className="multi-constraints" aria-label="Multi-route constraints">
            <div>
              <span>Fixed end</span>
              <strong>{multiPayload.request.end?.name ?? "None"}</strong>
            </div>
            <div>
              <span>Route closure</span>
              <strong>{multiPayload.request.return_to_start ? "Return to start" : "Open route"}</strong>
            </div>
          </div>
          <div className="requested-order">
            <strong>Requested order</strong>
            <span>{multiPayload.request.waypoints.map((item) => item.name).join(" -> ")}</span>
          </div>
          <ol className="visit-order">
            {multiPayload.visiting_landmarks.map((landmark, index) => (
              <li key={`${landmark.id}-${index}`}>
                <span>{index + 1}</span>
                <div><strong>{landmark.name}</strong><small>{landmark.category}</small></div>
              </li>
            ))}
          </ol>
          <p className="optimality-note">{multiPayload.explanation.optimality_note}</p>
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
