import assert from "node:assert/strict";
import { TWILIC_CONTENT_TYPE } from "../dist/index.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export { encoder, decoder, TWILIC_CONTENT_TYPE };

export function createJsonCodec() {
  return {
    encode(value) {
      return encoder.encode(JSON.stringify(value));
    },
    decode(bytes) {
      if (bytes.length === 0) {
        return null;
      }
      return JSON.parse(decoder.decode(bytes));
    },
  };
}

export function createTrackingCodec(inner = createJsonCodec()) {
  const stats = {
    encodeCalls: 0,
    decodeCalls: 0,
    lastEncoded: null,
    lastDecoded: null,
  };
  return {
    stats,
    encode(value) {
      stats.encodeCalls += 1;
      stats.lastEncoded = value;
      return inner.encode(value);
    },
    decode(bytes) {
      stats.decodeCalls += 1;
      stats.lastDecoded = bytes;
      return inner.decode(bytes);
    },
  };
}

export function twilicContentType(extra = "") {
  return extra ? `${TWILIC_CONTENT_TYPE}; ${extra}` : TWILIC_CONTENT_TYPE;
}

export async function requestApp(app, path, init = {}) {
  const response = await app.request(path, init);
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  return {
    response,
    status: response.status,
    contentType,
    text,
    json: isJson && text ? JSON.parse(text) : undefined,
  };
}

export async function requestTwilicBody(app, path, bodyValue, headers = {}) {
  const codec = createJsonCodec();
  return app.request(path, {
    method: "POST",
    headers: {
      "content-type": TWILIC_CONTENT_TYPE,
      ...headers,
    },
    body: codec.encode(bodyValue),
  });
}

export function assertTwilicResponse(response, expectedStatus = 200) {
  assert.equal(response.status, expectedStatus);
  assert.equal(response.headers.get("content-type"), TWILIC_CONTENT_TYPE);
}
