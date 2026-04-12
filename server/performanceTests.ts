import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";

type SampleEmbedding = {
  userId?: string;
  customerId?: string;
  embeddings: unknown;
};

const sampleEmbeddingsPath = "./data/sampleEmbeddings.json";
const maxVus = Number(__ENV.MAX_VUS) || 50;

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

export const options = {
  scenarios: {
    verify: buildScenario("verifyUsers"),
    predict: buildScenario("predictCustomers"),
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:verify}": ["p(95)<2000"],
    "http_req_duration{endpoint:predict}": ["p(95)<2000"],
  },
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

  check(response, {
    "predict status is 200": (r) => r.status === 200,
    "predict body is present": (r) =>
      typeof r.body === "string" && r.body.length > 0,
  });
}
