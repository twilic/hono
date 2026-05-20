import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { decode, encode } from "@twilic/core";
import {
  TWILIC_CONTENT_TYPE,
  parseTwilic,
  twilicParser,
  twilicResponse,
} from "../dist/index.js";

test("twilicParser + twilicResponse round-trip with @twilic/core", async () => {
  const payload = {
    id: 42n,
    name: "alice",
    active: true,
    tags: ["a", "b"],
  };

  const app = new Hono();
  app.post("/users", twilicParser(), (c) =>
    twilicResponse(c, { received: c.var.twilicBody }),
  );

  const response = await app.request("http://localhost/users", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: encode(payload),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), TWILIC_CONTENT_TYPE);

  const decoded = decode(new Uint8Array(await response.arrayBuffer()));
  assert.equal(decoded.received.id, 42n);
  assert.equal(decoded.received.name, "alice");
  assert.equal(decoded.received.active, true);
  assert.deepEqual(decoded.received.tags, ["a", "b"]);
});

test("parseTwilic decodes @twilic/core wire bytes", async () => {
  const payload = { ok: true, value: 7n };
  const app = new Hono();
  app.post("/decode", async (c) => {
    const value = await parseTwilic(c);
    return twilicResponse(c, value);
  });

  const response = await app.request("http://localhost/decode", {
    method: "POST",
    headers: { "content-type": TWILIC_CONTENT_TYPE },
    body: encode(payload),
  });

  assert.deepEqual(
    decode(new Uint8Array(await response.arrayBuffer())),
    payload,
  );
});
