import { randomUUID } from "node:crypto";
import { reviewEssay } from "../lib/ai-reviewer/agent.js";
import { formatValidationError } from "../lib/ai-reviewer/schema.js";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 6;
const visitors = new Map();

function clientAddress(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return request.socket?.remoteAddress ?? "unknown";
}

function isRateLimited(address) {
  const now = Date.now();
  const recent = (visitors.get(address) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now);
  visitors.set(address, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

function setHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
}

function send(response, status, body) {
  setHeaders(response);
  response.status(status).json(body);
}

export default async function handler(request, response) {
  if (request.method === "GET") {
    return send(response, 200, {
      name: "DinoApply AI Reviewer",
      status: "ready",
      accepts: ["essay", "context", "options"],
      maxEssayCharacters: 12000,
    });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return send(response, 405, { error: "Method not allowed." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return send(response, 503, {
      error: "AI reviewer is not configured.",
      code: "OPENAI_API_KEY_MISSING",
    });
  }

  if (isRateLimited(clientAddress(request))) {
    return send(response, 429, { error: "Too many review requests. Please try again in one minute." });
  }

  const requestId = randomUUID();

  try {
    const payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const review = await reviewEssay(payload);
    return send(response, 200, { requestId, review });
  } catch (error) {
    const validation = formatValidationError(error);
    if (Array.isArray(validation)) {
      return send(response, 400, { requestId, error: "Invalid review request.", details: validation });
    }

    console.error("AI review failed", { requestId, code: error?.code, message: error?.message });
    return send(response, 500, {
      requestId,
      error: "The review could not be completed.",
      code: error?.code ?? "REVIEW_FAILED",
    });
  }
}
