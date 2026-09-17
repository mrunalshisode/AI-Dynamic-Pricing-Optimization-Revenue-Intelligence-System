/**
 * Centralized API Base URL Configuration for PricePilot AI
 *
 * Resolves the backend base URL dynamically:
 * 1. If VITE_API_URL is explicitly set (e.g. for a separate backend service), use it.
 * 2. When running in a browser:
 *    - If served on port 8000 or any non-localhost domain (such as *.onrender.com),
 *      return "" (empty string) to use same-origin relative paths.
 * 3. When running on Vite dev server (e.g. localhost:5173), fallback to "http://127.0.0.1:8000".
 */
export const getApiBaseUrl = () => {
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_URL !== undefined &&
    import.meta.env.VITE_API_URL !== ""
  ) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    // When served directly by FastAPI (port 8000) or any deployed host (e.g. Render)
    if (port === "8000" || (hostname !== "localhost" && hostname !== "127.0.0.1")) {
      return "";
    }
  }

  // Local development default (Vite dev server -> FastAPI)
  return "http://127.0.0.1:8000";
};

export const API = getApiBaseUrl();
export default API;
