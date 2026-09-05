import assert from "node:assert/strict";
import { test } from "node:test";

import { Hono } from "hono";

import { createTwilicHono, DEFAULT_BODY_LIMIT } from "../dist/index.js";

async function check(chunks, limit, expected) {
  let calls = 0;
  const twilic = createTwilicHono({
    encode: () => new Uint8Array(),
    decode: (b) => {
      calls++;
      return b.length;
    },
  });
  const app = new Hono();
  app.post("/", twilic.parser({ limit }), (c) => c.json(c.get("twilicBody")));
  const body = new ReadableStream({
    start(c) {
      for (const size of chunks) c.enqueue(new Uint8Array(size));
      c.close();
    },
  });
  const init = {
    method: "POST",
    headers: { "content-type": "application/vnd.twilic" },
    body,
    duplex: "half",
  };
  assert.equal((await app.request("/", init)).status, expected);
  assert.equal(calls, expected === 200 ? 1 : 0);
}
test("streamed body limits reject before decoding and accept exact boundary", async () => {
  await check([2, 3], 4, 413);
  await check([2, 2], 4, 200);
  await check([1], 0, 413);
  await check([DEFAULT_BODY_LIMIT, 1], undefined, 413);
});
test("invalid parser limits fail at configuration", () => {
  for (const limit of [-1, 1.5, Infinity, NaN])
    assert.throws(() => createTwilicHono().parser({ limit }), RangeError);
});
