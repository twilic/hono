import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { decode, encode } from "@twilic/core";
import {
  createTwilicHono,
  parseTwilic,
  twilicResponse,
} from "../dist/index.js";
import {
  TWILIC_CONTENT_TYPE,
  createJsonCodec,
  createTrackingCodec,
  encoder,
} from "./helpers.mjs";

test("createTwilicHono().parse reads body without middleware", async () => {
  const codec = createJsonCodec();
  const twilic = createTwilicHono(codec);
  const app = new Hono();
  app.post("/raw", async (c) => c.json(await twilic.parse(c)));

  const response = await app.request("http://localhost/raw", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: codec.encode({ direct: true }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { direct: true });
});

test("createTwilicHono().parse uses injected codec", async () => {
  const codec = createTrackingCodec();
  const twilic = createTwilicHono(codec);
  const app = new Hono();
  app.post("/raw", async (c) => c.json(await twilic.parse(c)));

  await app.request("http://localhost/raw", {
    method: "POST",
    body: codec.encode({ tracked: "parse" }),
  });

  assert.equal(codec.stats.decodeCalls, 1);
});

test("createTwilicHono().parse does not validate content-type", async () => {
  const twilic = createTwilicHono(createJsonCodec());
  const app = new Hono();
  app.post("/raw", async (c) => c.json(await twilic.parse(c)));

  const response = await app.request("http://localhost/raw", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: encoder.encode(JSON.stringify({ skippedValidation: true })),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { skippedValidation: true });
});

test("parseTwilic decodes @twilic/core wire bytes", async () => {
  const payload = { ok: true, count: 3n };
  const app = new Hono();
  app.post("/raw", async (c) => twilicResponse(c, await parseTwilic(c)));

  const response = await app.request("http://localhost/raw", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: encode(payload),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    decode(new Uint8Array(await response.arrayBuffer())),
    payload,
  );
});

test("parseTwilic round-trips through twilicResponse", async () => {
  const payload = { message: "hello" };
  const app = new Hono();
  app.post("/echo", async (c) => twilicResponse(c, await parseTwilic(c)));

  const response = await app.request("http://localhost/echo", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: encode(payload),
  });

  assert.deepEqual(
    decode(new Uint8Array(await response.arrayBuffer())),
    payload,
  );
});

test("end-to-end: parser middleware then response round-trip", async () => {
  const twilic = createTwilicHono(createJsonCodec());
  const app = new Hono();
  app.post("/echo", twilic.parser(), (c) =>
    twilic.response(c, { echo: c.var.twilicBody }),
  );

  const input = { message: "hello", count: 3 };
  const response = await app.request("http://localhost/echo", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: encoder.encode(JSON.stringify(input)),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), TWILIC_CONTENT_TYPE);
  const decoded = JSON.parse(
    new TextDecoder().decode(await response.arrayBuffer()),
  );
  assert.deepEqual(decoded, { echo: input });
});
