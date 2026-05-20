import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { decode } from "@twilic/core";
import { createTwilicHono, twilicResponse } from "../dist/index.js";
import {
  TWILIC_CONTENT_TYPE,
  assertTwilicResponse,
  createJsonCodec,
  createTrackingCodec,
  decoder,
} from "./helpers.mjs";

test("twilicResponse sets status, content-type, and custom headers", async () => {
  const twilic = createTwilicHono(createJsonCodec());
  const app = new Hono();
  app.get("/users", (c) =>
    twilic.response(c, { ok: true }, { status: 201, headers: { "x-id": "1" } }),
  );

  const response = await app.request("http://localhost/users");
  const body = await response.arrayBuffer();

  assertTwilicResponse(response, 201);
  assert.equal(response.headers.get("x-id"), "1");
  assert.deepEqual(JSON.parse(decoder.decode(body)), { ok: true });
});

test("twilicResponse encodes with @twilic/core", async () => {
  const app = new Hono();
  app.get("/users", (c) => twilicResponse(c, { ok: true, n: 1n }));

  const response = await app.request("http://localhost/users");
  assertTwilicResponse(response);
  assert.deepEqual(decode(new Uint8Array(await response.arrayBuffer())), {
    ok: true,
    n: 1n,
  });
});

test("twilicResponse defaults to status 200", async () => {
  const app = new Hono();
  app.get("/ping", (c) => twilicResponse(c, { pong: true }));

  const response = await app.request("http://localhost/ping");
  assertTwilicResponse(response, 200);
});

test("twilicResponse overwrites caller content-type with Twilic", async () => {
  const app = new Hono();
  app.get("/users", (c) =>
    twilicResponse(
      c,
      { ok: true },
      { headers: { "content-type": "application/json" } },
    ),
  );

  const response = await app.request("http://localhost/users");
  assert.equal(response.headers.get("content-type"), TWILIC_CONTENT_TYPE);
});

test("twilicResponse body is Uint8Array bytes from codec", async () => {
  const codec = createTrackingCodec();
  const twilic = createTwilicHono(codec);
  const payload = { nested: { items: [1, 2, 3] }, flag: false };

  const app = new Hono();
  app.get("/data", (c) => twilic.response(c, payload));

  const response = await app.request("http://localhost/data");
  const body = new Uint8Array(await response.arrayBuffer());

  assert.equal(codec.stats.encodeCalls, 1);
  assert.deepEqual(codec.stats.lastEncoded, payload);
  assert.deepEqual(JSON.parse(decoder.decode(body)), payload);
});

test("createTwilicHono().response uses injected codec", async () => {
  const codec = createTrackingCodec();
  const twilic = createTwilicHono(codec);
  const app = new Hono();
  app.get("/x", (c) => twilic.response(c, { via: "factory" }));

  await app.request("http://localhost/x");
  assert.equal(codec.stats.encodeCalls, 1);
});

test("twilicResponse encodes null", async () => {
  const codec = createJsonCodec();
  const twilic = createTwilicHono(codec);
  const app = new Hono();
  app.get("/null", (c) => twilic.response(c, null));

  const response = await app.request("http://localhost/null");
  const body = await response.arrayBuffer();
  assertTwilicResponse(response);
  assert.equal(decoder.decode(body), "null");
});

test("twilicResponse preserves statusText from init", async () => {
  const app = new Hono();
  app.get("/created", (c) =>
    twilicResponse(c, { ok: true }, { status: 201, statusText: "Created" }),
  );

  const response = await app.request("http://localhost/created");
  assert.equal(response.status, 201);
  assert.equal(response.statusText, "Created");
});
