import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

type PerfMode = "verify" | "predict" | "both";

type K6Metric = {
  thresholds?: Record<string, boolean | { ok?: boolean }>;
  [key: string]: number | string | Record<string, boolean | { ok?: boolean }> | undefined;
};

type K6Summary = {
  metrics?: Record<string, K6Metric>;
};

type TrendSnapshot = {
  avgMs: number | null;
  medMs: number | null;
  p90Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  maxMs: number | null;
};

type RunSummary = {
  maxVus: number;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  summaryFile: string;
  thresholdFailures: string[];
  httpReqs: number | null;
  httpReqRate: number | null;
  failRate: number | null;
  overall: TrendSnapshot;
  verify: TrendSnapshot | null;
  predict: TrendSnapshot | null;
};

type SweepReport = {
  generatedAt: string;
  mode: PerfMode;
  vus: number[];
  script: string;
  samplePath: string | null;
  outputDir: string;
  latencyThresholdMs: number | null;
  runs: RunSummary[];
};

const currentFile = fileURLToPath(import.meta.url);
const scriptsDir = dirname(currentFile);
const serverDir = resolve(scriptsDir, "..");

function timestampId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parsePositiveInt(rawValue: string, label: string): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new Error(`Invalid ${label}: ${rawValue}`);
  }

  return parsed;
}

function parsePerfMode(rawMode: string): PerfMode {
  switch (rawMode.trim().toLowerCase()) {
    case "verify":
      return "verify";
    case "predict":
      return "predict";
    case "both":
      return "both";
    default:
      throw new Error(`Invalid mode: ${rawMode}`);
  }
}

function parseVus(rawValue: string): number[] {
  const uniqueValues = new Set<number>();

  for (const part of rawValue.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    uniqueValues.add(parsePositiveInt(trimmed, "VUs"));
  }

  const values = Array.from(uniqueValues).sort((left, right) => left - right);
  if (values.length === 0) {
    throw new Error("At least one VU value is required");
  }

  return values;
}

function parseOptionalPositiveInt(rawValue: string | undefined): number | null {
  if (!rawValue) {
    return null;
  }

  return parsePositiveInt(rawValue, "latency threshold");
}

function readSummary(summaryPath: string): K6Summary {
  return JSON.parse(readFileSync(summaryPath, "utf8")) as K6Summary;
}

function metricValues(
  metric: K6Metric | null | undefined,
): Record<string, number | string | undefined> {
  if (!metric) {
    return {};
  }

  const values: Record<string, number | string | undefined> = {};
  for (const [key, value] of Object.entries(metric)) {
    if (key === "thresholds") {
      continue;
    }
    if (typeof value === "number" || typeof value === "string") {
      values[key] = value;
    }
  }

  return values;
}

function toNumber(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function findMetric(
  metrics: Record<string, K6Metric> | undefined,
  metricName: string,
  endpoint?: "verify" | "predict",
): K6Metric | null {
  if (!metrics) {
    return null;
  }

  if (!endpoint) {
    return metrics[metricName] ?? null;
  }

  for (const [key, metric] of Object.entries(metrics)) {
    if (
      key.startsWith(`${metricName}{`) &&
      key.includes(`endpoint:${endpoint}`)
    ) {
      return metric;
    }
  }

  return null;
}

function trendSnapshot(metric: K6Metric | null): TrendSnapshot {
  const values = metricValues(metric);

  return {
    avgMs: toNumber(values.avg),
    medMs: toNumber(values.med),
    p90Ms: toNumber(values["p(90)"]),
    p95Ms: toNumber(values["p(95)"]),
    p99Ms: toNumber(values["p(99)"]),
    maxMs: toNumber(values.max),
  };
}

function thresholdFailures(
  metrics: Record<string, K6Metric> | undefined,
): string[] {
  if (!metrics) {
    return [];
  }

  const failures: string[] = [];
  for (const [metricName, metric] of Object.entries(metrics)) {
    for (const [thresholdName, threshold] of Object.entries(
      metric.thresholds ?? {},
    )) {
      const isOk =
        typeof threshold === "boolean" ? threshold : threshold.ok !== false;
      if (!isOk) {
        failures.push(`${metricName} -> ${thresholdName}`);
      }
    }
  }

  return failures;
}

function summarizeRun(
  summary: K6Summary,
  run: Omit<
    RunSummary,
    | "thresholdFailures"
    | "httpReqs"
    | "httpReqRate"
    | "failRate"
    | "overall"
    | "verify"
    | "predict"
  >,
): RunSummary {
  const metrics = summary.metrics;
  const httpReqsMetric = findMetric(metrics, "http_reqs");
  const failedMetric = findMetric(metrics, "http_req_failed");

  return {
    ...run,
    thresholdFailures: run.exitCode === 0 ? [] : thresholdFailures(metrics),
    httpReqs: toNumber(metricValues(httpReqsMetric).count),
    httpReqRate: toNumber(metricValues(httpReqsMetric).rate),
    failRate:
      toNumber(metricValues(failedMetric).rate) ??
      toNumber(metricValues(failedMetric).value),
    overall: trendSnapshot(findMetric(metrics, "http_req_duration")),
    verify: trendSnapshot(findMetric(metrics, "verify_duration")),
    predict: trendSnapshot(findMetric(metrics, "predict_duration")),
  };
}

function formatMs(value: number | null): string {
  if (value === null) {
    return "-";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }

  return `${value.toFixed(0)}ms`;
}

function formatRate(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${(value * 100).toFixed(2)}%`;
}

function formatCount(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return value.toFixed(0);
}

function formatNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return value.toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chartSvg(
  title: string,
  runs: RunSummary[],
  selectors: Array<{
    label: string;
    color: string;
    value: (run: RunSummary) => number | null;
  }>,
  formatter: (value: number) => string,
): string {
  const width = 860;
  const height = 320;
  const marginTop = 24;
  const marginRight = 24;
  const marginBottom = 44;
  const marginLeft = 64;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;
  const xValues = runs.map((run) => run.maxVus);
  const allYValues = selectors
    .flatMap((selector) =>
      runs
        .map((run) => selector.value(run))
        .filter((value): value is number => value !== null),
    )
    .filter((value) => Number.isFinite(value));

  if (xValues.length === 0 || allYValues.length === 0) {
    return `<section class="chart-card"><h2>${escapeHtml(title)}</h2><p>No data.</p></section>`;
  }

  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMax = Math.max(...allYValues, 1);
  const yTickCount = 5;

  const scaleX = (value: number) => {
    if (xMin === xMax) {
      return marginLeft + plotWidth / 2;
    }
    return marginLeft + ((value - xMin) / (xMax - xMin)) * plotWidth;
  };

  const scaleY = (value: number) => {
    return marginTop + plotHeight - (value / yMax) * plotHeight;
  };

  const yTicks = Array.from({ length: yTickCount + 1 }, (_, index) => {
    return (yMax / yTickCount) * index;
  });

  const grid = yTicks
    .map((tick) => {
      const y = scaleY(tick);
      return `
        <line x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}" class="grid" />
        <text x="${marginLeft - 10}" y="${y + 4}" text-anchor="end" class="axis-label">${escapeHtml(formatter(tick))}</text>
      `;
    })
    .join("");

  const xTicks = xValues
    .map((value) => {
      const x = scaleX(value);
      return `
        <line x1="${x}" y1="${marginTop + plotHeight}" x2="${x}" y2="${marginTop + plotHeight + 6}" class="axis" />
        <text x="${x}" y="${height - 12}" text-anchor="middle" class="axis-label">${value}</text>
      `;
    })
    .join("");

  const lines = selectors
    .map((selector) => {
      const points = runs
        .map((run) => {
          const value = selector.value(run);
          if (value === null) {
            return null;
          }
          return `${scaleX(run.maxVus)},${scaleY(value)}`;
        })
        .filter((value): value is string => value !== null);

      const circles = runs
        .map((run) => {
          const value = selector.value(run);
          if (value === null) {
            return "";
          }
          return `<circle cx="${scaleX(run.maxVus)}" cy="${scaleY(value)}" r="4" fill="${selector.color}" />`;
        })
        .join("");

      if (points.length === 0) {
        return "";
      }

      return `
        <polyline fill="none" stroke="${selector.color}" stroke-width="3" points="${points.join(" ")}" />
        ${circles}
      `;
    })
    .join("");

  const legend = selectors
    .map(
      (selector) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${selector.color}"></span>
          <span>${escapeHtml(selector.label)}</span>
        </div>
      `,
    )
    .join("");

  return `
    <section class="chart-card">
      <h2>${escapeHtml(title)}</h2>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
        <line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${marginTop + plotHeight}" class="axis" />
        <line x1="${marginLeft}" y1="${marginTop + plotHeight}" x2="${width - marginRight}" y2="${marginTop + plotHeight}" class="axis" />
        ${grid}
        ${xTicks}
        ${lines}
      </svg>
      <div class="legend">${legend}</div>
    </section>
  `;
}

function buildTableRows(runs: RunSummary[]): string {
  return runs
    .map(
      (run) => `
        <tr>
          <td>${run.maxVus}</td>
          <td>${run.exitCode === 0 ? "ok" : run.exitCode === null ? "-" : run.exitCode}</td>
          <td>${formatNumber(run.httpReqRate)}</td>
          <td>${formatRate(run.failRate)}</td>
          <td>${formatMs(run.overall.p95Ms)}</td>
          <td>${formatMs(run.verify?.p95Ms ?? null)}</td>
          <td>${formatMs(run.predict?.p95Ms ?? null)}</td>
          <td>${formatMs(run.overall.p99Ms)}</td>
        </tr>
      `,
    )
    .join("");
}

function buildHtml(report: SweepReport): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Performance Sweep Report</title>
    <style>
      :root {
        font-family: Inter, system-ui, sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      body {
        margin: 0;
        padding: 24px;
        background: #f8fafc;
      }
      h1, h2 {
        margin: 0 0 10px;
      }
      .grid-layout {
        display: grid;
        gap: 16px;
      }
      .card, .chart-card, .table-card {
        background: #ffffff;
        border: 1px solid #dbe4ee;
        border-radius: 12px;
        padding: 18px;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
      }
      .meta {
        margin: 0;
        color: #475569;
      }
      .axis, .grid {
        stroke: #dbe4ee;
        stroke-width: 1;
      }
      .grid {
        stroke-dasharray: 4 4;
      }
      .axis-label {
        fill: #64748b;
        font-size: 12px;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 12px;
      }
      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #475569;
      }
      .legend-swatch {
        width: 12px;
        height: 12px;
        border-radius: 999px;
      }
      .table-card {
        overflow: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 10px 12px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
        white-space: nowrap;
      }
      th {
        color: #334155;
        font-weight: 600;
        background: #f8fafc;
        position: sticky;
        top: 0;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 0.95em;
        background: #eef2ff;
        padding: 0.1rem 0.35rem;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <main class="grid-layout">
      <section class="card">
        <h1>Performance Sweep Report</h1>
        <p class="meta">Generated at ${escapeHtml(report.generatedAt)}</p>
        <p class="meta">Mode: <code>${escapeHtml(report.mode)}</code> · Script: <code>${escapeHtml(report.script)}</code> · Output: <code>${escapeHtml(report.outputDir)}</code></p>
      </section>

      ${chartSvg(
        "Overall P95 Latency By MAX_VUS",
        report.runs,
        [
          {
            label: "Overall P95",
            color: "#2563eb",
            value: (run) => run.overall.p95Ms,
          },
        ],
        (value) => formatMs(value),
      )}

      <section class="table-card">
        <h2>Run Summary</h2>
        <table>
          <thead>
            <tr>
              <th>MAX_VUS</th>
              <th>Status</th>
              <th>Req/s</th>
              <th>Fail rate</th>
              <th>Overall P95</th>
              <th>Verify P95</th>
              <th>Predict P95</th>
              <th>Overall P99</th>
            </tr>
          </thead>
          <tbody>
            ${buildTableRows(report.runs)}
          </tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}

const { values } = parseArgs({
  options: {
    vus: { type: "string" },
    mode: { type: "string" },
    sample: { type: "string" },
    script: { type: "string" },
    outDir: { type: "string" },
    fromDir: { type: "string" },
    thresholdMs: { type: "string" },
    dryRun: { type: "boolean" },
  },
  allowPositionals: false,
});

const existingOutputDir = values.fromDir
  ? resolve(serverDir, values.fromDir)
  : null;
const vus = parseVus(values.vus ?? "1,2,5,10,20,50");
const mode = parsePerfMode(values.mode ?? "both");
const samplePath = values.sample ?? null;
const scriptPath = resolve(serverDir, values.script ?? "performanceTests.ts");
const outDir = resolve(
  serverDir,
  values.outDir ?? values.fromDir ?? `perf-results/${timestampId()}`,
);
const latencyThresholdMs = parseOptionalPositiveInt(values.thresholdMs);
const dryRun = values.dryRun ?? false;
const existingReportPath = existingOutputDir
  ? resolve(existingOutputDir, "report.json")
  : null;
const priorRunsByVus = new Map<number, RunSummary>();

if (existingReportPath && existsSync(existingReportPath)) {
  const existingReport = JSON.parse(
    readFileSync(existingReportPath, "utf8"),
  ) as Partial<SweepReport>;
  for (const run of existingReport.runs ?? []) {
    priorRunsByVus.set(run.maxVus, run as RunSummary);
  }
}

if (!existingOutputDir && !existsSync(scriptPath)) {
  throw new Error(`Performance test script not found: ${scriptPath}`);
}

if (existingOutputDir) {
  if (!existsSync(existingOutputDir)) {
    throw new Error(`Existing output directory not found: ${existingOutputDir}`);
  }
} else {
  mkdirSync(outDir, { recursive: true });
}

console.log(`Sweep mode: ${mode}`);
console.log(`VU values: ${vus.join(", ")}`);
if (!existingOutputDir) {
  console.log(`k6 script: ${relative(serverDir, scriptPath)}`);
}
console.log(`Output directory: ${relative(serverDir, outDir)}`);

const runs: RunSummary[] = [];

if (existingOutputDir) {
  const summaryFiles = readdirSync(existingOutputDir)
    .map((fileName) => {
      const match = /^summary-maxvus-(\d+)\.json$/.exec(fileName);
      if (!match) {
        return null;
      }
      return {
        fileName,
        maxVus: Number(match[1]),
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        fileName: string;
        maxVus: number;
      } => entry !== null,
    )
    .sort((left, right) => left.maxVus - right.maxVus);

  if (summaryFiles.length === 0) {
    throw new Error(`No summary-maxvus-*.json files found in ${existingOutputDir}`);
  }

  for (const summaryFile of summaryFiles) {
    const summaryPath = resolve(existingOutputDir, summaryFile.fileName);
    const summary = readSummary(summaryPath);
    const priorRun = priorRunsByVus.get(summaryFile.maxVus);
    const summarizedRun = summarizeRun(summary, {
      maxVus: summaryFile.maxVus,
      exitCode: priorRun?.exitCode ?? null,
      startedAt: priorRun?.startedAt ?? "",
      finishedAt: priorRun?.finishedAt ?? "",
      elapsedMs: priorRun?.elapsedMs ?? 0,
      summaryFile: relative(outDir, summaryPath),
    });
    if (priorRun?.exitCode && priorRun.thresholdFailures) {
      summarizedRun.thresholdFailures = priorRun.thresholdFailures;
    }
    runs.push(summarizedRun);
  }
} else {
  for (const maxVus of vus) {
  const summaryPath = resolve(outDir, `summary-maxvus-${maxVus}.json`);
  const args = ["run", "--summary-export", summaryPath, scriptPath];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MAX_VUS: String(maxVus),
    MODEL_PERF_MODE: mode,
  };

  if (samplePath) {
    env.SAMPLE_EMBEDDINGS_PATH = samplePath;
  }

  if (latencyThresholdMs !== null) {
    env.LATENCY_THRESHOLD_MS = String(latencyThresholdMs);
  }

  console.log(`\n=== MAX_VUS=${maxVus} ===`);
  console.log(
    `k6 ${args
      .slice(1)
      .map((arg) => JSON.stringify(arg))
      .join(" ")}`,
  );

  if (dryRun) {
    continue;
  }

  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const result = spawnSync("k6", args, {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });
  const finished = Date.now();
  const finishedAt = new Date(finished).toISOString();

  if (result.error) {
    throw result.error;
  }

  if (!existsSync(summaryPath)) {
    throw new Error(`k6 did not produce a summary file: ${summaryPath}`);
  }

  const summary = readSummary(summaryPath);
  runs.push(
    summarizeRun(summary, {
      maxVus,
      exitCode: result.status,
      startedAt,
      finishedAt,
      elapsedMs: finished - started,
      summaryFile: relative(outDir, summaryPath),
    }),
  );
}
}

if (dryRun) {
  console.log("\nDry run complete. No k6 commands were executed.");
  process.exit(0);
}

const report: SweepReport = {
  generatedAt: new Date().toISOString(),
  mode,
  vus: runs.map((run) => run.maxVus),
  script: relative(serverDir, scriptPath),
  samplePath,
  outputDir: relative(serverDir, outDir),
  latencyThresholdMs,
  runs,
};

const jsonPath = resolve(outDir, "report.json");
const htmlPath = resolve(outDir, "report.html");

writeFileSync(jsonPath, JSON.stringify(report, null, 2));
writeFileSync(htmlPath, buildHtml(report));

console.log(`\nReport JSON: ${relative(serverDir, jsonPath)}`);
console.log(`Report HTML: ${relative(serverDir, htmlPath)}`);
