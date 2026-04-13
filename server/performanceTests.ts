import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

type SampleEmbedding = {
  userId?: string;
  customerId?: string;
  embeddings: unknown;
};

type PerfMode = "verify" | "predict" | "both";

function envInt(name: string, fallback: number): number {
  const rawValue = __ENV[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}: ${rawValue}`);
  }

  return Math.floor(parsed);
}

function parseMode(rawMode: string | undefined): PerfMode {
  switch ((rawMode || "both").trim().toLowerCase()) {
    case "verify":
      return "verify";
    case "predict":
      return "predict";
    case "both":
      return "both";
    default:
      throw new Error(`Invalid MODEL_PERF_MODE: ${rawMode}`);
  }
}

const sampleEmbeddingsPath =
  __ENV.SAMPLE_EMBEDDINGS_PATH || "./data/sampleEmbeddings.json";
const maxVus = Math.max(1, envInt("MAX_VUS", 50));
const latencyThresholdMs = envInt("LATENCY_THRESHOLD_MS", 0);
const mode = parseMode(__ENV.MODEL_PERF_MODE);

const sampleEmbeddings = new SharedArray("sample embeddings", () => {
  return JSON.parse(open(sampleEmbeddingsPath)) as SampleEmbedding[];
});

const usersToVerify = sampleEmbeddings.filter((embedding) => embedding.userId);
const customersToVerify = sampleEmbeddings.filter(
  (embedding) => embedding.customerId,
);

if (usersToVerify.length === 0) {
  throw new Error(
    "No user verification samples found in sampleEmbeddings.json",
  );
}

if (customersToVerify.length === 0) {
  throw new Error(
    "No customer prediction samples found in sampleEmbeddings.json",
  );
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

const verifyDuration = new Trend("verify_duration", true);
const predictDuration = new Trend("predict_duration", true);
const verifyFailRate = new Rate("verify_fail_rate");
const predictFailRate = new Rate("predict_fail_rate");
const verifyRequests = new Counter("verify_requests");
const predictRequests = new Counter("predict_requests");

function buildScenario(scenarioName: string) {
  const warmupVus = Math.min(2, maxVus);

  return {
    executor: "ramping-vus",
    exec: scenarioName,
    startVUs: 1,
    stages: [
      { duration: "15s", target: 1 },
      { duration: "15s", target: warmupVus },
      { duration: "30s", target: maxVus },
      { duration: "15s", target: 0 },
    ],
    gracefulRampDown: "10s",
  };
}

function buildScenarios() {
  if (mode === "verify") {
    return {
      verify: buildScenario("verifyUsers"),
    };
  }

  if (mode === "predict") {
    return {
      predict: buildScenario("predictCustomers"),
    };
  }

  return {
    verify: buildScenario("verifyUsers"),
    predict: buildScenario("predictCustomers"),
  };
}

function buildThresholds(): Record<string, string[]> {
  const thresholds: Record<string, string[]> = {
    http_req_failed: ["rate<0.01"],
  };

  if (latencyThresholdMs <= 0) {
    return thresholds;
  }

  if (mode !== "predict") {
    thresholds.verify_duration = [`p(95)<${latencyThresholdMs}`];
  }

  if (mode !== "verify") {
    thresholds.predict_duration = [`p(95)<${latencyThresholdMs}`];
  }

  return thresholds;
}

export const options = {
  scenarios: buildScenarios(),
  thresholds: buildThresholds(),
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

function sampleAtIndex<T>(items: T[]): T {
  const index = exec.scenario.iterationInTest % items.length;
  return items[index];
}

export function verifyUsers() {
  const user = sampleAtIndex(usersToVerify);
  const response = http.post(
    "http://localhost:5000/verify",
    JSON.stringify({
      embedding: user.embeddings,
      user_id: user.userId,
    }),
    {
      headers: jsonHeaders,
      tags: {
        endpoint: "verify",
      },
    },
  );

  verifyRequests.add(1);
  verifyDuration.add(response.timings.duration);
  verifyFailRate.add(response.status !== 200);

  check(response, {
    "verify status is 200": (r) => r.status === 200,
    "verify body is present": (r) =>
      typeof r.body === "string" && r.body.length > 0,
  });
}

export function predictCustomers() {
  const customer = sampleAtIndex(customersToVerify);
  const response = http.post(
    "http://localhost:5000/predict",
    JSON.stringify({
      embedding: customer.embeddings,
    }),
    {
      headers: jsonHeaders,
      tags: {
        endpoint: "predict",
      },
    },
  );

  predictRequests.add(1);
  predictDuration.add(response.timings.duration);
  predictFailRate.add(response.status !== 200);

  check(response, {
    "predict status is 200": (r) => r.status === 200,
    "predict body is present": (r) =>
      typeof r.body === "string" && r.body.length > 0,
  });
}
