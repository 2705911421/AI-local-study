import assert from "node:assert/strict";
import test from "node:test";
import worker from "../sites/worker.mjs";

const indexHtml = "<!doctype html><html><body><div id=\"root\"></div></body></html>";

function createAssetsBinding() {
  return {
    async fetch(input) {
      const url = new URL(input.url);

      if (url.pathname === "/") {
        return new Response(indexHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (url.pathname === "/assets/app.js") {
        return new Response("export {};", {
          headers: { "Content-Type": "text/javascript; charset=utf-8" },
        });
      }

      return new Response("Not found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    },
  };
}

function request(path, destination = "document") {
  return new Request(`https://zhiye.example${path}`, {
    headers: {
      Accept: destination === "document" ? "text/html" : "*/*",
      "Sec-Fetch-Dest": destination,
    },
  });
}

test("网站导航路由返回 SPA 文档和安全响应头", async () => {
  const env = { ASSETS: createAssetsBinding() };

  for (const path of ["/", "/app", "/app/"]) {
    const response = await worker.fetch(request(path), env);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /id="root"/);
    assert.match(
      response.headers.get("Content-Security-Policy") || "",
      /frame-ancestors 'none'/,
    );
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(
      response.headers.get("Referrer-Policy"),
      "strict-origin-when-cross-origin",
    );
  }
});

test("静态资源保留正确类型且缺失资源不会回退成 HTML", async () => {
  const env = { ASSETS: createAssetsBinding() };
  const script = await worker.fetch(
    request("/assets/app.js", "script"),
    env,
  );
  assert.equal(script.status, 200);
  assert.match(script.headers.get("Content-Type") || "", /javascript/);

  const missing = await worker.fetch(
    request("/assets/missing.js", "script"),
    env,
  );
  assert.equal(missing.status, 404);
  assert.doesNotMatch(
    missing.headers.get("Content-Type") || "",
    /text\/html/,
  );
});
