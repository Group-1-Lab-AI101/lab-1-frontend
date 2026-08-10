import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  GitCompareArrows,
  Layers,
  LoaderCircle,
  MapPinned,
  Navigation,
  Route,
  Waypoints,
} from "lucide-react";
import { compareRoutes, fetchBootstrap, fetchNetwork, optimizeMultiRoute, streamSearch } from "./api";
import MapView from "./components/MapView";
import ResultsPanel from "./components/ResultsPanel";
import type {
  Bootstrap,
  ComparePayload,
  GeoJsonFeature,
  Landmark,
  Mode,
  MultiPayload,
  SearchPayload,
  SearchStep,
} from "./types";

const DEFAULT_START = "notre_dame_cathedral";
const DEFAULT_GOAL = "saigon_zoo";
const DEFAULT_WAYPOINTS = [
  "ben_thanh_market",
  "nguyen_hue_walking_street",
  "bach_dang_wharf",
  "fine_arts_museum",
];

export default function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [network, setNetwork] = useState<Record<string, unknown> | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [start, setStart] = useState(DEFAULT_START);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [algorithm, setAlgorithm] = useState("dijkstra");
  const [criterion, setCriterion] = useState("balanced");
  const [traffic, setTraffic] = useState("normal");
  const [waypoints, setWaypoints] = useState<string[]>(DEFAULT_WAYPOINTS);
  const [multiMethod, setMultiMethod] = useState("nearest_neighbor");
  const [returnToStart, setReturnToStart] = useState(false);
  const [end, setEnd] = useState("");
  const [searchPayload, setSearchPayload] = useState<SearchPayload | null>(null);
  const [multiPayload, setMultiPayload] = useState<MultiPayload | null>(null);
  const [comparison, setComparison] = useState<ComparePayload | null>(null);
  const [selectedCompare, setSelectedCompare] = useState<string | null>(null);
  const [steps, setSteps] = useState<SearchStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showBaseMap, setShowBaseMap] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchBootstrap(), fetchNetwork()])
      .then(([bootstrapData, networkData]) => {
        setBootstrap(bootstrapData);
        setNetwork(networkData);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!playing || !steps.length) return;
    if (stepIndex >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStepIndex((current) => current + 1), 90);
    return () => window.clearTimeout(timer);
  }, [playing, stepIndex, steps.length]);

  useEffect(() => {
    if (waypoints.length > 8 && multiMethod === "exact_bruteforce") {
      setMultiMethod("nearest_neighbor");
    }
  }, [multiMethod, waypoints.length]);

  useEffect(() => {
    setWaypoints((current) => current.filter((id) => id !== start));
  }, [start]);

  const landmarkById = useMemo(
    () => new Map(bootstrap?.landmarks.map((item) => [item.id, item]) ?? []),
    [bootstrap],
  );

  const activeSearchPayload = searchPayload;
  const activeRoute: GeoJsonFeature | null =
    activeSearchPayload?.route_geojson ?? multiPayload?.route_geojson ?? null;
  const selectedLandmarks = useMemo(() => {
    const ids = mode === "multi"
      ? [start, ...waypoints, ...(end ? [end] : [])]
      : [start, goal];
    return ids.map((id) => landmarkById.get(id)).filter(Boolean) as Landmark[];
  }, [mode, start, goal, waypoints, end, landmarkById]);
  const currentStep = steps.length ? steps[Math.min(stepIndex, steps.length - 1)] : null;

  const resetOutputs = () => {
    setSearchPayload(null);
    setMultiPayload(null);
    setComparison(null);
    setSelectedCompare(null);
    setSteps([]);
    setStepIndex(0);
    setPlaying(false);
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    resetOutputs();
    try {
      if (mode === "single") {
        const streamed: SearchStep[] = [];
        const payload = await streamSearch(
          { start, goal, algorithm, criterion, traffic_profile: traffic },
          (step) => streamed.push(step),
        );
        setSteps(streamed);
        setSearchPayload(payload);
        setPlaying(streamed.length > 1);
      } else if (mode === "compare") {
        const payload = await compareRoutes({ start, goal, criterion, traffic_profile: traffic });
        setComparison(payload);
        const first = payload.algorithms.find((item) => item.request.algorithm === "dijkstra") ?? payload.algorithms[0];
        setSearchPayload(first);
        setSelectedCompare(first.request.algorithm);
      } else {
        const payload = await optimizeMultiRoute({
          start,
          waypoints,
          method: multiMethod,
          end: end || null,
          return_to_start: returnToStart,
          criterion,
          traffic_profile: traffic,
          compare_methods: waypoints.length <= 8,
        });
        setMultiPayload(payload);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  if (!bootstrap) {
    return (
      <div className="loading-screen">
        <LoaderCircle className="spin" size={30} />
        <strong>Saigon Route Lab</strong>
        {error && <span>{error}</span>}
      </div>
    );
  }

  const toggleWaypoint = (id: string) => {
    setWaypoints((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><MapPinned size={24} /><div><strong>Saigon Route Lab</strong><span>AI search explorer</span></div></div>
        <div className="topbar-stats">
          <span><b>{String(bootstrap.network_summary.routable_nodes)}</b> nodes</span>
          <span><b>{String(bootstrap.network_summary.routable_edges)}</b> edges</span>
          <span className="status-dot">API ready</span>
        </div>
      </header>

      <main className="workspace">
        <aside className="control-panel">
          <div className="mode-tabs" role="tablist">
            <button className={mode === "single" ? "active" : ""} onClick={() => { setMode("single"); resetOutputs(); }}><Route size={16} />Single</button>
            <button className={mode === "compare" ? "active" : ""} onClick={() => { setMode("compare"); resetOutputs(); }}><GitCompareArrows size={16} />Compare</button>
            <button className={mode === "multi" ? "active" : ""} onClick={() => { setMode("multi"); resetOutputs(); }}><Waypoints size={16} />Multi</button>
          </div>

          <section className="control-section">
            <label htmlFor="start">Start</label>
            <select id="start" value={start} onChange={(event) => setStart(event.target.value)}>
              {bootstrap.landmarks.map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.name}</option>)}
            </select>

            {mode !== "multi" && (
              <>
                <div className="label-row"><label htmlFor="goal">Destination</label><button className="icon-button" title="Swap locations" onClick={() => { setStart(goal); setGoal(start); }}><ArrowLeftRight size={16} /></button></div>
                <select id="goal" value={goal} onChange={(event) => setGoal(event.target.value)}>
                  {bootstrap.landmarks.map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.name}</option>)}
                </select>
              </>
            )}
          </section>

          {mode === "single" && (
            <section className="control-section">
              <label htmlFor="algorithm">Algorithm</label>
              <select id="algorithm" value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>
                {Object.entries(bootstrap.algorithms).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
              </select>
              <div className="algorithm-caption"><strong>{bootstrap.algorithms[algorithm].description}</strong><span>{bootstrap.algorithms[algorithm].guarantee}</span></div>
            </section>
          )}

          {mode === "multi" && (
            <section className="control-section multi-controls">
              <div className="label-row"><label>Waypoints</label><span>{waypoints.length}/8 exact</span></div>
              <div className="waypoint-list">
                {bootstrap.landmarks.filter((item) => item.id !== start).map((landmark) => (
                  <label className="check-row" key={landmark.id}>
                    <input type="checkbox" checked={waypoints.includes(landmark.id)} onChange={() => toggleWaypoint(landmark.id)} />
                    <span>{landmark.name}</span>
                  </label>
                ))}
              </div>
              <label htmlFor="multi-method">Method</label>
              <select id="multi-method" value={multiMethod} onChange={(event) => setMultiMethod(event.target.value)}>
                <option value="nearest_neighbor">Nearest Neighbor</option>
                <option value="exact_bruteforce" disabled={waypoints.length > 8}>Exact Brute Force</option>
              </select>
              <label htmlFor="end">Fixed end</label>
              <select id="end" value={end} onChange={(event) => setEnd(event.target.value)} disabled={returnToStart}>
                <option value="">None</option>
                {bootstrap.landmarks.filter((item) => item.id !== start).map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.name}</option>)}
              </select>
              <label className="toggle-row"><input type="checkbox" checked={returnToStart} onChange={(event) => { setReturnToStart(event.target.checked); if (event.target.checked) setEnd(""); }} /><span>Return to start</span></label>
            </section>
          )}

          <section className="control-section">
            <label>Optimization</label>
            <div className="criterion-grid">
              {Object.keys(bootstrap.cost_presets).map((key) => (
                <button key={key} className={criterion === key ? "active" : ""} onClick={() => setCriterion(key)}>{key.replace("_", " ")}</button>
              ))}
            </div>
            <label htmlFor="traffic">Traffic profile</label>
            <select id="traffic" value={traffic} onChange={(event) => setTraffic(event.target.value)}>
              {Object.keys(bootstrap.traffic_profiles).map((key) => <option key={key} value={key}>{key.replace("_", " ")}</option>)}
            </select>
          </section>

          {error && <div className="error-banner">{error}</div>}
          <button className="run-button" onClick={run} disabled={loading || (mode === "multi" && !waypoints.length)}>
            {loading ? <LoaderCircle className="spin" size={18} /> : <Navigation size={18} />}
            {loading ? "Running" : mode === "compare" ? "Compare algorithms" : mode === "multi" ? "Optimize route" : "Find route"}
          </button>
        </aside>

        <section className="map-workspace">
          <button
            className={`map-overlay-toggle ${showBaseMap ? "active" : ""}`}
            onClick={() => setShowBaseMap((prev) => !prev)}
            title="Toggle OpenStreetMap background map layer"
            aria-label="Toggle OpenStreetMap background map layer"
          >
            <Layers size={16} />
            <span>{showBaseMap ? "OpenStreetMap On" : "OpenStreetMap Off"}</span>
          </button>
          <MapView
            bootstrap={bootstrap}
            network={network}
            route={activeRoute}
            currentStep={currentStep}
            selectedLandmarks={selectedLandmarks}
            showBaseMap={showBaseMap}
          />
          <div className="map-legend">
            <span><i className="legend-line boundary" />Boundary</span>
            <span><i className="legend-line road" />Road network</span>
            <span><i className="legend-line route" />Selected route</span>
            <span><i className="legend-line access" />Landmark access</span>
            <span><i className="legend-dot visited" />Visited</span>
            <span><i className="legend-dot frontier" />Frontier</span>
          </div>
        </section>

        <ResultsPanel
          bootstrap={bootstrap}
          searchPayload={searchPayload}
          multiPayload={multiPayload}
          comparison={comparison}
          selectedCompare={selectedCompare}
          onSelectCompare={(payload) => { setSearchPayload(payload); setSelectedCompare(payload.request.algorithm); }}
          steps={steps}
          stepIndex={stepIndex}
          playing={playing}
          onPlayingChange={setPlaying}
          onStepIndexChange={setStepIndex}
        />
      </main>
    </div>
  );
}
