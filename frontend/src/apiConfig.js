/**
 * Centralized API Base URL Configuration for PricePilot AI
 *
 * Resolves the backend base URL dynamically:
 * 1. If VITE_API_URL is explicitly configured, sanitize (trim trailing slash) and use it.
 * 2. When running in a browser:
 *    - If running on Vercel (*.vercel.app), default to the deployed Render backend URL
 *      (https://ai-dynamic-pricing-backend.onrender.com).
 *    - If running on Render (*.onrender.com) or served directly by FastAPI (port 8000),
 *      return "" (empty string) to use same-origin relative paths.
 * 3. When running on Vite dev server (localhost / 127.0.0.1),
 *    fallback to "http://127.0.0.1:8000".
 */
const DEFAULT_RENDER_BACKEND_URL = "https://ai-dynamic-pricing-backend.onrender.com";

export const getApiBaseUrl = () => {
  // 1. Explicit environment variable takes precedence
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_URL !== undefined &&
    import.meta.env.VITE_API_URL !== ""
  ) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, "");
  }

  // 2. Runtime browser environment detection
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;

    // Vercel deployment -> point to the deployed Render backend
    if (hostname.endsWith(".vercel.app") || hostname === "pricepilot-mrunal17.vercel.app") {
      return DEFAULT_RENDER_BACKEND_URL;
    }

    // Render single-service combined deployment or served directly by FastAPI
    if (port === "8000" || hostname.endsWith(".onrender.com")) {
      return "";
    }

    // Other non-localhost custom domains default to Render backend
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return DEFAULT_RENDER_BACKEND_URL;
    }
  }

  // 3. Local development default (Vite dev server -> FastAPI)
  return "http://127.0.0.1:8000";
};

export const API = getApiBaseUrl();
export default API;
