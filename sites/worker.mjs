const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http: https: ws: wss:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const INDEX_HTML = null;

function withSecurityHeaders(response) {
  const secured = new Response(response.body, response);
  secured.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("X-Frame-Options", "DENY");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return secured;
}

function isDocumentNavigation(request) {
  return (
    request.headers.get("Sec-Fetch-Dest") === "document" ||
    request.headers.get("Accept")?.includes("text/html")
  );
}

function indexRequest(request) {
  const url = new URL(request.url);
  // Cloudflare's asset server canonicalizes /index.html to /. Fetching the
  // public root directly preserves the browser's original /app URL.
  url.pathname = "/";
  url.search = "";
  return new Request(url, request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isWorkspaceRoute =
      url.pathname === "/app" || url.pathname === "/app/";
    const isNavigation =
      request.method === "GET" && isDocumentNavigation(request);
    let response =
      INDEX_HTML && isNavigation
        ? new Response(INDEX_HTML, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
        : await env.ASSETS.fetch(
            isWorkspaceRoute ? indexRequest(request) : request,
          );

    if (
      response.status === 404 &&
      request.method === "GET" &&
      isDocumentNavigation(request)
    ) {
      response = await env.ASSETS.fetch(indexRequest(request));
    }

    return withSecurityHeaders(response);
  },
};
