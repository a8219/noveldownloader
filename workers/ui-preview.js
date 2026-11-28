import readHtml from "../static/read.html";
import materialTheme from "../static/material-theme.txt";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Same-origin reader API; authentication and limits remain in the existing backend.
    if (url.pathname.startsWith("/api/")) {
      if (!env.READER_API) return new Response("Reader backend unavailable", { status: 503 });
      const response = await env.READER_API.fetch(request);
      const headers = new Headers(response.headers);
      headers.set("cache-control", "no-store");
      headers.set("x-robots-tag", "noindex, nofollow");
      return new Response(response.body, { status: response.status, headers });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    if (url.pathname === "/material-theme.js") {
      return new Response(request.method === "HEAD" ? null : materialTheme, { headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      } });
    }
    if (url.pathname !== "/" && url.pathname !== "/read" && url.pathname !== "/read/" && url.pathname !== "/read/index.html") {
      return new Response("Not Found", { status: 404 });
    }

    const headers = {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    };
    return new Response(request.method === "HEAD" ? null : readHtml, { headers });
  },
};
