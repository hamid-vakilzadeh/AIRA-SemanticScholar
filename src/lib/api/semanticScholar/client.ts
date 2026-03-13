import { AsyncLocalStorage } from "node:async_hooks";
import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from "axios";

type SemanticScholarRequestContext = {
  apiKey?: string;
};

const requestContext = new AsyncLocalStorage<SemanticScholarRequestContext>();

export const runWithSemanticScholarRequestContext = <T>(
  context: SemanticScholarRequestContext,
  callback: () => T
): T => requestContext.run(context, callback);

const setHeader = (
  config: InternalAxiosRequestConfig,
  name: string,
  value?: string
) => {
  const headers = AxiosHeaders.from(config.headers);
  config.headers = headers;

  if (value) {
    headers.set(name, value);
    return;
  }

  headers.delete(name);
};

// Create an axios instance with the base URL for Semantic Scholar API
const semanticScholarClient = axios.create({
  baseURL: "https://api.semanticscholar.org/graph/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Track last request time for rate-limited endpoints
const lastRequestTime: Record<string, number> = {
  "/paper/batch": 0,
  "/paper/search": 0,
  "/author/batch": 0,
  "/recommendations": 0,
  default: 0,
};

// Add request interceptor for rate limiting
semanticScholarClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const apiKey =
      requestContext.getStore()?.apiKey || process.env.SEMANTIC_SCHOLAR_API_KEY;
    setHeader(config, "x-api-key", apiKey);

    // Determine which rate limit applies
    let endpoint = "default";
    const url = config.url || "";

    if (url.startsWith("/paper/batch")) {
      endpoint = "/paper/batch";
    } else if (url.startsWith("/paper/search")) {
      endpoint = "/paper/search";
    } else if (url.startsWith("/author/batch")) {
      endpoint = "/author/batch";
    } else if (url.startsWith("/recommendations")) {
      endpoint = "/recommendations";
    }

    const now = Date.now();
    const lastRequest = lastRequestTime[endpoint];

    // Calculate delay needed based on endpoint
    const minInterval = endpoint === "default" ? 100 : 1000; // 10 req/sec or 1 req/sec
    const timeElapsed = now - lastRequest;
    const delayNeeded = Math.max(0, minInterval - timeElapsed);

    if (delayNeeded > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayNeeded));
    }

    // Update last request time
    lastRequestTime[endpoint] = Date.now();

    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for handling rate limit errors
semanticScholarClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Check if error is due to rate limiting (429 Too Many Requests)
    if (error.response?.status === 429 && originalRequest) {
      console.warn(
        "Rate limit exceeded for Semantic Scholar API. Retrying after delay..."
      );

      // Wait for appropriate time based on endpoint
      const url = originalRequest.url || "";
      const delay =
        url.startsWith("/paper/batch") ||
        url.startsWith("/paper/search") ||
        url.startsWith("/author/batch") ||
        url.startsWith("/recommendations")
          ? 1000
          : 100;

      await new Promise((resolve) => setTimeout(resolve, delay));

      // Retry the request
      return semanticScholarClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default semanticScholarClient;
