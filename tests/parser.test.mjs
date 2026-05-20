import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { decode, encode } from "@twilic/core";
import {
  createTwilicHono,
  twilicParser,
  twilicResponse,
} from "../dist/index.js";
import {
  TWILIC_CONTENT_TYPE,
  createJsonCodec,
  createTrackingCodec,
  encoder,
  requestApp,
  twilicContentType,
} from "./helpers.mjs";

function createTestTwilic() {
  return createTwilicHono(createJsonCodec());
}

test("twilicParser decodes request body into c.var.twilicBody", async () => {
  const twilic = createTestTwilic();
  const app = new Hono();
  app.post("/users", twilic.parser(), (c) => c.json(c.var.twilicBody, 200));

  const { status, json } = await requestApp(app, "http://localhost/users", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: encoder.encode(JSON.stringify({ id: 1, name: "A" })),
  });

  assert.equal(status, 200);
  assert.deepEqual(json, { id: 1, name: "A" });
});

test("accepts content-type with parameters", async () => {
  const twilic = createTestTwilic();
  const app = new Hono();
  app.post("/users", twilic.parser(), (c) => c.json(c.var.twilicBody));

  const { status, json } = await requestApp(app, "http://localhost/users", {
    method: "POST",
    headers: { "content-type": twilicContentType("charset=utf-8") },
    body: encoder.encode(JSON.stringify({ ok: true })),
  });

  assert.equal(status, 200);
  assert.deepEqual(json, { ok: true });
});

test("returns 415 when content-type is missing", async () => {
  const twilic = createTestTwilic();
  const app = new Hono();
  app.post("/users", twilic.parser(), (c) => c.text("ok"));

  const { status, text } = await requestApp(app, "http://localhost/users", {
    method: "POST",
    body: encoder.encode(JSON.stringify({ id: 1 })),
  });

  assert.equal(status, 415);
  assert.equal(text, "Unsupported Media Type");
});

test("returns 415 when content-type is not Twilic", async () => {
  const twilic = createTestTwilic();
  const app = new Hono();
  app.post("/users", twilic.parser(), (c) => c.text("ok"));

  const { status, text } = await requestApp(app, "http://localhost/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: encoder.encode(JSON.stringify({ id: 1 })),
  });

  assert.equal(status, 415);
  assert.equal(text, "Unsupported Media Type");
});

test("returns 415 for similar but non-matching media types", async () => {
  for (const contentType of [
    "application/vnd.twilix",
    "application/json",
    "text/plain",
  ]) {
    const twilic = createTestTwilic();
    const app = new Hono();
    app.post("/users", twilic.parser(), (c) => c.text("ok"));

    const { status } = await requestApp(app, "http://localhost/users", {
      method: "POST",
      headers: { "content-type": contentType },
      body: encoder.encode(JSON.stringify({})),
    });
    assert.equal(status, 415, `expected 415 for ${contentType}`);
  }
});

test("does not call downstream handler when returning 415", async () => {
  const twilic = createTestTwilic();
  const app = new Hono();
  let handlerCalls = 0;
  app.post("/users", twilic.parser(), () => {
    handlerCalls += 1;
    return new Response("ok");
  });

  await app.request("http://localhost/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: encoder.encode(JSON.stringify({})),
  });

  assert.equal(handlerCalls, 0);
});

test("requireContentType false skips validation", async () => {
  const twilic = createTestTwilic();
  const app = new Hono();
  app.post("/users", twilic.parser({ requireContentType: false }), (c) =>
    c.json(c.var.twilicBody),
  );

  const { status, json } = await requestApp(app, "http://localhost/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: encoder.encode(JSON.stringify({ ok: true })),
  });

  assert.equal(status, 200);
  assert.deepEqual(json, { ok: true });
});

test("requireContentType false still decodes with missing content-type", async () => {
  const twilic = createTestTwilic();
  const app = new Hono();
  app.post("/users", twilic.parser({ requireContentType: false }), (c) =>
    c.json(c.var.twilicBody),
  );

  const { status, json } = await requestApp(app, "http://localhost/users", {
    method: "POST",
    body: encoder.encode(JSON.stringify({ noHeader: true })),
  });

  assert.equal(status, 200);
  assert.deepEqual(json, { noHeader: true });
});

test("decodes empty body when content-type is valid", async () => {
  const twilic = createTestTwilic();
  const app = new Hono();
  app.post("/users", twilic.parser(), (c) => c.json(c.var.twilicBody));

  const { status, json } = await requestApp(app, "http://localhost/users", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: new Uint8Array(0),
  });

  assert.equal(status, 200);
  assert.equal(json, null);
});

test("uses injected codec decode", async () => {
  const codec = createTrackingCodec();
  const twilic = createTwilicHono(codec);
  const app = new Hono();
  app.post("/users", twilic.parser(), (c) => c.json(c.var.twilicBody));

  await app.request("http://localhost/users", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: codec.encode({ tracked: true }),
  });

  assert.equal(codec.stats.decodeCalls, 1);
  assert.ok(codec.stats.lastDecoded instanceof Uint8Array);
});

test("propagates decode errors from codec", async () => {
  const twilic = createTwilicHono({
    encode: () => new Uint8Array(0),
    decode() {
      throw new Error("decode failed");
    },
  });
  const app = new Hono();
  app.post("/users", twilic.parser(), (c) => c.text("ok"));
  app.onError((err, c) => c.text(err.message, 500));

  const response = await app.request("http://localhost/users", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: new Uint8Array([1]),
  });

  assert.equal(response.status, 500);
  assert.equal(await response.text(), "decode failed");
});

test("default requireContentType is true", async () => {
  const twilic = createTestTwilic();
  const app = new Hono();
  app.post("/users", twilic.parser(), (c) => c.text("ok"));

  const response = await app.request("http://localhost/users", {
    method: "POST",
    body: encoder.encode(JSON.stringify({})),
  });

  assert.equal(response.status, 415);
});

test("twilicParser() decodes @twilic/core wire bytes", async () => {
  const app = new Hono();
  app.post("/users", twilicParser(), (c) =>
    twilicResponse(c, { received: c.var.twilicBody }),
  );

  const payload = { id: 1n, label: "core" };
  const response = await app.request("http://localhost/users", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: encode(payload),
  });

  assert.equal(response.status, 200);
  const decoded = decode(new Uint8Array(await response.arrayBuffer()));
  assert.equal(decoded.received.id, 1n);
  assert.equal(decoded.received.label, "core");
});
