import type { AlgorithmMeta, ComparePayload, SearchPayload } from "../types";

interface CompareTableProps {
  comparison: ComparePayload;
  algorithms: Record<string, AlgorithmMeta>;
  selected: string | null;
  onSelect: (payload: SearchPayload) => void;
}

const routeKey = (payload: SearchPayload) => payload.request.algorithm;

export default function CompareTable({
  comparison,
  algorithms,
  selected,
  onSelect,
}: CompareTableProps) {
  return (
    <div className="comparison-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Algorithm</th>
            <th>Cost</th>
            <th>km</th>
            <th>min</th>
            <th>Expanded</th>
            <th>ms</th>
          </tr>
        </thead>
        <tbody>
          {comparison.algorithms.map((payload) => {
            const key = routeKey(payload);
            const result = payload.result;
            return (
              <tr
                key={key}
                className={selected === key ? "selected-row" : ""}
                onClick={() => onSelect(payload)}
              >
                <td>{algorithms[key]?.label ?? result.algorithm}</td>
                <td>{result.total_cost?.toFixed(2) ?? "-"}</td>
                <td>{result.total_distance_km?.toFixed(2) ?? "-"}</td>
                <td>{result.total_time_min?.toFixed(1) ?? "-"}</td>
                <td>{result.expanded_nodes}</td>
                <td>{result.runtime_ms.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="comparison-notes">
        {comparison.summary.observations.map((note) => <p key={note}>{note}</p>)}
      </div>
    </div>
  );
}
