import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  GitCompareArrows,
  Layers,
  LoaderCircle,
  MapPinned,
  Navigation,
  RefreshCw,
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
import { stepWithVisitedHistory } from "./trace";

const DEFAULT_START = "notre_dame_cathedral";
const DEFAULT_GOAL = "saigon_zoo";
const DEFAULT_WAYPOINTS = [
  "ben_thanh_market",
  "nguyen_hue_walking_street",
  "bach_dang_wharf",
  "fine_arts_museum",
];
const BRUTE_FORCE_LIMIT = 8;
const HELD_KARP_LIMIT = 12;

const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
const isAbortError = (reason: unknown) => reason instanceof DOMException && reason.name === "AbortError";

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
  const [multiMethod, setMultiMethod] = useState("held_karp");
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
  const [colorRouteByConditions, setColorRouteByConditions] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);
  const activeRunId = useRef(0);
  const activeAbort = useRef<AbortController | null>(null);
  const initialLoadStarted = useRef(false);

  const resetOutputs = useCallback(() => {
    setSearchPayload(null);
    setMultiPayload(null);
    setComparison(null);
    setSelectedCompare(null);
    setSteps([]);
    setStepIndex(0);
    setPlaying(false);
  }, []);

  const cancelActiveRun = useCallback(() => {
    activeRunId.current += 1;
    activeAbort.current?.abort();
    activeAbort.current = null;
    setRunning(false);
  }, []);

  const invalidateOutputs = useCallback(() => {
    cancelActiveRun();
    resetOutputs();
    setError(null);
  }, [cancelActiveRun, resetOutputs]);

  const loadNetworkOverlay = useCallback(async () => {
    setNetworkWarning(null);
    try {
      setNetwork(await fetchNetwork());
    } catch (reason) {
      setNetwork(null);
      setNetworkWarning(`Road network overlay unavailable: ${errorMessage(reason)}`);
    }
  }, []);

  const loadApplication = useCallback(async () => {
    setInitialLoading(true);
    setError(null);
    void loadNetworkOverlay();
    try {
      setBootstrap(await fetchBootstrap());
    } catch (reason) {
      setBootstrap(null);
      setError(errorMessage(reason));
    } finally {
      setInitialLoading(false);
    }
  }, [loadNetworkOverlay]);

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void loadApplication();
  }, [loadApplication]);

  useEffect(() => () => activeAbort.current?.abort(), []);

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
    const exceedsMethodLimit =
      (multiMethod === "exact_bruteforce" && waypoints.length > BRUTE_FORCE_LIMIT)
      || (multiMethod === "held_karp" && waypoints.length > HELD_KARP_LIMIT);
    if (exceedsMethodLimit) {
      setMultiMethod("nearest_neighbor");
    }
  }, [multiMethod, waypoints.length]);

  const landmarkById = useMemo(
    () => new Map(bootstrap?.landmarks.map((item) => [item.id, item]) ?? []),
    [bootstrap],
  );

  const traceReachedFinalStep = steps.length === 0 || stepIndex >= steps.length - 1;
  const activeRoute: GeoJsonFeature | null = mode === "multi"
    ? multiPayload?.route_geojson ?? null
    : traceReachedFinalStep
      ? searchPayload?.route_geojson ?? null
      : null;
  const activeRouteSegments = activeRoute
    ? mode === "multi"
      ? multiPayload?.route_segments ?? []
      : searchPayload?.route_segments ?? []
    : [];
  const selectedLandmarks = useMemo(() => {
    const ids = mode === "multi"
      ? [start, ...waypoints, ...(end ? [end] : [])]
      : [start, goal];
    return Array.from(new Set(ids))
      .map((id) => landmarkById.get(id))
      .filter(Boolean) as Landmark[];
  }, [mode, start, goal, waypoints, end, landmarkById]);
  const currentStep = useMemo(
    () => stepWithVisitedHistory(steps, stepIndex),
    [steps, stepIndex],
  );

  const changeMode = (nextMode: Mode) => {
    if (nextMode === mode) return;
    invalidateOutputs();
    setMode(nextMode);
  };

  const changeStart = (nextStart: string) => {
    if (nextStart === start) return;
    invalidateOutputs();
    setStart(nextStart);
    setWaypoints((current) => current.filter((id) => id !== nextStart));
    setEnd((current) => current === nextStart ? "" : current);
  };

  const changeEnd = (nextEnd: string) => {
    if (nextEnd === end) return;
    invalidateOutputs();
    setEnd(nextEnd);
    if (nextEnd) setWaypoints((current) => current.filter((id) => id !== nextEnd));
  };

  const toggleFixedEnd = (enabled: boolean) => {
    if (!enabled) {
      changeEnd("");
      return;
    }
    const candidate = [...waypoints].reverse().find((id) => id !== start)
      ?? bootstrap?.landmarks.find((item) => item.id !== start)?.id
      ?? "";
    changeEnd(candidate);
  };

  const toggleWaypoint = (id: string) => {
    invalidateOutputs();
    setWaypoints((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const run = async () => {
    activeAbort.current?.abort();
    const controller = new AbortController();
    const runId = activeRunId.current + 1;
    const runMode = mode;
    activeRunId.current = runId;
    activeAbort.current = controller;
    const isCurrent = () => activeRunId.current === runId && !controller.signal.aborted;

    setRunning(true);
    setError(null);
    resetOutputs();
    try {
      if (runMode === "single") {
        const streamed: SearchStep[] = [];
        const payload = await streamSearch(
          { start, goal, algorithm, criterion, traffic_profile: traffic },
          (step) => {
            streamed.push(step);
            if (!isCurrent()) return;
            setSteps([...streamed]);
            setStepIndex(streamed.length - 1);
          },
          { signal: controller.signal },
        );
        if (!isCurrent()) return;
        setSteps([...streamed]);
        // Start the completed trace from its first expansion. The final route
        // is revealed only after the learner reaches the last step.
        setStepIndex(0);
        setSearchPayload(payload);
      } else if (runMode === "compare") {
        const payload = await compareRoutes(
          { start, goal, criterion, traffic_profile: traffic },
          controller.signal,
        );
        if (!isCurrent()) return;
        setComparison(payload);
        const first = payload.algorithms.find((item) => item.request.algorithm === "dijkstra")
          ?? payload.algorithms[0];
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
          compare_methods:
            waypoints.length <= BRUTE_FORCE_LIMIT
            && multiMethod !== "held_karp",
        }, controller.signal);
        if (!isCurrent()) return;
        setMultiPayload(payload);
      }
    } catch (reason) {
      if (isCurrent() && !isAbortError(reason)) setError(errorMessage(reason));
    } finally {
      if (activeRunId.current === runId) {
        activeAbort.current = null;
        setRunning(false);
      }
    }
  };

  if (!bootstrap) {
    return (
      <div className="loading-screen">
        {initialLoading && <LoaderCircle className="spin" size={30} />}
        <strong>Saigon Route Lab</strong>
        {!initialLoading && <span>{error ?? "Application data is unavailable."}</span>}
        {!initialLoading && (
          <button className="retry-button" onClick={() => void loadApplication()}>
            <RefreshCw size={16} />Retry
          </button>
        )}
      </div>
    );
  }

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
            <button role="tab" aria-selected={mode === "single"} className={mode === "single" ? "active" : ""} onClick={() => changeMode("single")}><Route size={16} />Single</button>
            <button role="tab" aria-selected={mode === "compare"} className={mode === "compare" ? "active" : ""} onClick={() => changeMode("compare")}><GitCompareArrows size={16} />Compare</button>
            <button role="tab" aria-selected={mode === "multi"} className={mode === "multi" ? "active" : ""} onClick={() => changeMode("multi")}><Waypoints size={16} />Multi</button>
          </div>

          <section className="control-section">
            <label htmlFor="start">Start</label>
            <select id="start" value={start} onChange={(event) => changeStart(event.target.value)}>
              {bootstrap.landmarks.map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.name}</option>)}
            </select>

            {mode !== "multi" && (
              <>
                <div className="label-row"><label htmlFor="goal">Destination</label><button className="icon-button" title="Swap locations" onClick={() => { const previousStart = start; changeStart(goal); setGoal(previousStart); }}><ArrowLeftRight size={16} /></button></div>
                <select id="goal" value={goal} onChange={(event) => { invalidateOutputs(); setGoal(event.target.value); }}>
                  {bootstrap.landmarks.map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.name}</option>)}
                </select>
              </>
            )}
          </section>

          {mode === "single" && (
            <section className="control-section">
              <label htmlFor="algorithm">Algorithm</label>
              <select id="algorithm" value={algorithm} onChange={(event) => { invalidateOutputs(); setAlgorithm(event.target.value); }}>
                {Object.entries(bootstrap.algorithms).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
              </select>
              <div className="algorithm-caption"><strong>{bootstrap.algorithms[algorithm].description}</strong><span>{bootstrap.algorithms[algorithm].guarantee}</span></div>
            </section>
          )}

          {mode === "multi" && (
            <section className="control-section multi-controls">
              <div className="label-row">
                <label>Waypoints</label>
                <span>
                  {waypoints.length} selected · {waypoints.length <= BRUTE_FORCE_LIMIT
                    ? "all methods available"
                    : waypoints.length <= HELD_KARP_LIMIT
                      ? "Held–Karp exact available"
                      : "approximate only"}
                </span>
              </div>
              <div className="waypoint-list">
                {bootstrap.landmarks.filter((item) => item.id !== start && item.id !== end).map((landmark) => (
                  <label className="check-row" key={landmark.id}>
                    <input type="checkbox" checked={waypoints.includes(landmark.id)} onChange={() => toggleWaypoint(landmark.id)} />
                    <span>{landmark.name}</span>
                  </label>
                ))}
              </div>
              <label htmlFor="multi-method">Method</label>
              <select id="multi-method" value={multiMethod} onChange={(event) => { invalidateOutputs(); setMultiMethod(event.target.value); }}>
                <option value="nearest_neighbor">Nearest Neighbor (approximate)</option>
                <option value="exact_bruteforce" disabled={waypoints.length > BRUTE_FORCE_LIMIT}>Exact Brute Force (max 8)</option>
                <option value="held_karp" disabled={waypoints.length > HELD_KARP_LIMIT}>Held–Karp Exact (max 12)</option>
              </select>
              <p className="method-note">
                {multiMethod === "nearest_neighbor"
                  ? waypoints.length <= HELD_KARP_LIMIT
                    ? "Fast greedy route; choose Held–Karp for a globally optimal visiting order."
                    : "Fast greedy route; global optimality is not guaranteed. Exact methods are limited to 12 waypoints."
                  : multiMethod === "held_karp"
                    ? "Exact dynamic programming over the pairwise landmark costs."
                    : "Exact permutation search intended for small teaching examples."}
              </p>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(end)}
                  disabled={returnToStart}
                  onChange={(event) => toggleFixedEnd(event.target.checked)}
                />
                <span>End at a specific place <small>(optional)</small></span>
              </label>
              {end && !returnToStart && (
                <>
                  <label htmlFor="end">Fixed end destination</label>
                  <select id="end" value={end} onChange={(event) => changeEnd(event.target.value)}>
                    {bootstrap.landmarks.filter((item) => item.id !== start).map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.name}</option>)}
                  </select>
                  <p className="method-note">All selected waypoints are visited first; the route then finishes here.</p>
                </>
              )}
              <label className="toggle-row"><input type="checkbox" checked={returnToStart} onChange={(event) => { invalidateOutputs(); setReturnToStart(event.target.checked); if (event.target.checked) setEnd(""); }} /><span>Return to start</span></label>
            </section>
          )}

          <section className="control-section">
            <label>Optimization</label>
            <div className="criterion-grid">
              {Object.keys(bootstrap.cost_presets).map((key) => (
                <button key={key} className={criterion === key ? "active" : ""} onClick={() => { invalidateOutputs(); setCriterion(key); }}>{key.replace("_", " ")}</button>
              ))}
            </div>
            <label htmlFor="traffic">Traffic profile</label>
            <select id="traffic" value={traffic} onChange={(event) => { invalidateOutputs(); setTraffic(event.target.value); }}>
              {Object.keys(bootstrap.traffic_profiles).map((key) => <option key={key} value={key}>{key.replace("_", " ")}</option>)}
            </select>
            <label className="toggle-row condition-toggle">
              <input
                type="checkbox"
                checked={colorRouteByConditions}
                onChange={(event) => setColorRouteByConditions(event.target.checked)}
              />
              <span>Color route by traffic &amp; risk</span>
            </label>
            <p className="method-note">Uses the selected simulated traffic profile, not live traffic.</p>
          </section>

          {networkWarning && (
            <div className="warning-banner">
              <span>{networkWarning}</span>
              <button onClick={() => void loadNetworkOverlay()}>
                <RefreshCw size={14} />Retry overlay
              </button>
            </div>
          )}
          {error && <div className="error-banner">{error}</div>}
          <button className="run-button" onClick={() => void run()} disabled={running || (mode === "multi" && !waypoints.length)}>
            {running ? <LoaderCircle className="spin" size={18} /> : <Navigation size={18} />}
            {running ? "Running" : mode === "compare" ? "Compare algorithms" : mode === "multi" ? "Optimize route" : "Find route"}
          </button>
        </aside>

        <section className="map-workspace">
          <button
            className={`map-overlay-toggle ${showBaseMap ? "active" : ""}`}
            onClick={() => setShowBaseMap((prev) => !prev)}
            title="Toggle minimal background map layer"
            aria-label="Toggle minimal background map layer"
          >
            <Layers size={16} />
            <span>{showBaseMap ? "Minimal map On" : "Minimal map Off"}</span>
          </button>
          <MapView
            bootstrap={bootstrap}
            network={network}
            route={activeRoute}
            currentStep={currentStep}
            selectedLandmarks={selectedLandmarks}
            showBaseMap={showBaseMap}
            routeSegments={activeRouteSegments}
            colorRouteByConditions={colorRouteByConditions}
          />
          <div className="map-legend">
            <span><i className="legend-line boundary" />Boundary</span>
            <span><i className="legend-line road" />Road network</span>
            {colorRouteByConditions
              ? <span className="condition-legend"><b>Low</b><i /><b>High traffic / risk</b></span>
              : <span><i className="legend-line route" />Selected route</span>}
            <span><i className="legend-dot landmark" />Landmark center</span>
            <span><i className="legend-dot access" />Entrance / road access</span>
            <span><i className="legend-line access" />Access connector</span>
            <span><i className="legend-dot visited" />Visited</span>
            <span><i className="legend-dot frontier" />Frontier</span>
          </div>
        </section>

        <ResultsPanel
          bootstrap={bootstrap}
          searchPayload={mode === "multi" ? null : searchPayload}
          multiPayload={mode === "multi" ? multiPayload : null}
          comparison={mode === "compare" ? comparison : null}
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
