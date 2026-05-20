import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TWILIC_CONTENT_TYPE,
  createTwilicHono,
  parseTwilic,
  twilicParser,
  twilicResponse,
} from "../dist/index.js";

test("TWILIC_CONTENT_TYPE is application/vnd.twilic", () => {
  assert.equal(TWILIC_CONTENT_TYPE, "application/vnd.twilic");
});

test("named exports are functions", () => {
  assert.equal(typeof createTwilicHono, "function");
  assert.equal(typeof parseTwilic, "function");
  assert.equal(typeof twilicParser, "function");
  assert.equal(typeof twilicResponse, "function");
});

test("createTwilicHono returns parse, response, and parser", () => {
  const twilic = createTwilicHono();
  assert.equal(typeof twilic.parse, "function");
  assert.equal(typeof twilic.response, "function");
  assert.equal(typeof twilic.parser, "function");
});

test("twilicParser and createTwilicHono().parser both return middleware", () => {
  const fromFactory = createTwilicHono().parser();
  const fromExport = twilicParser();
  assert.equal(typeof fromFactory, "function");
  assert.equal(typeof fromExport, "function");
});
