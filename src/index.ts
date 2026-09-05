import { decode, encode, type TwilicValue } from "@twilic/core";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

export const TWILIC_CONTENT_TYPE = "application/vnd.twilic";

export interface TwilicCodec {
  encode: (value: TwilicValue) => Uint8Array;
  decode: (bytes: Uint8Array) => TwilicValue;
}

export const DEFAULT_BODY_LIMIT = 1_048_576;

export interface TwilicParserOptions {
  requireContentType?: boolean;
  /** Maximum request body bytes. Defaults to 1 MiB. */
  limit?: number;
}

export interface TwilicHono<T = TwilicValue> {
  parse: (c: Context, options?: TwilicParserOptions) => Promise<T>;
  response: (c: Context, value: TwilicValue, init?: ResponseInit) => Response;
  parser: (
    options?: TwilicParserOptions
  ) => ReturnType<typeof createMiddleware<{ Variables: { twilicBody: T } }>>;
}

function bodyLimit(options?: TwilicParserOptions): number {
  const limit = options?.limit ?? DEFAULT_BODY_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new RangeError("limit must be a non-negative safe integer");
  }
  return limit;
}

function hasTwilicContentType(contentType: string | undefined): boolean {
  return contentType?.startsWith(TWILIC_CONTENT_TYPE) ?? false;
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  const normalized: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => {
    normalized[key] = value;
  });
  return normalized;
}

async function parseWithCodec<T>(
  codec: TwilicCodec,
  c: Context,
  options?: TwilicParserOptions
): Promise<T> {
  const limit = bodyLimit(options);
  const stream = c.req.raw.body;
  if (!stream) return codec.decode(new Uint8Array()) as T;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.byteLength > limit - total) {
        // Cancellation failure must not replace the intended 413 response.
        void reader.cancel().catch(() => {});
        throw new HTTPException(413, {
          message: "Twilic request body exceeds limit",
        });
      }
      total += value.byteLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return codec.decode(body) as T;
}

function responseWithCodec(
  codec: TwilicCodec,
  _c: Context,
  value: TwilicValue,
  init?: ResponseInit
): Response {
  const body = new Uint8Array(codec.encode(value));
  const headers = new Headers(normalizeHeaders(init?.headers));
  headers.set("Content-Type", TWILIC_CONTENT_TYPE);

  return new Response(body, {
    ...init,
    status: init?.status ?? 200,
    headers,
  });
}

function parserWithCodec<T>(codec: TwilicCodec, options?: TwilicParserOptions) {
  const requireContentType = options?.requireContentType ?? true;
  bodyLimit(options);

  return createMiddleware<{ Variables: { twilicBody: T } }>(async (c, next) => {
    const contentType = c.req.header("content-type");
    if (requireContentType && !hasTwilicContentType(contentType)) {
      return c.text("Unsupported Media Type", 415);
    }

    const value = await parseWithCodec<T>(codec, c, options);
    c.set("twilicBody", value);
    await next();
  });
}

const defaultCodec: TwilicCodec = {
  encode,
  decode,
};

export function createTwilicHono<T = TwilicValue>(
  codec: TwilicCodec = defaultCodec
): TwilicHono<T> {
  return {
    parse: (c, options) => parseWithCodec<T>(codec, c, options),
    response: (c, value, init) => responseWithCodec(codec, c, value, init),
    parser: (options) => parserWithCodec<T>(codec, options),
  };
}

export function parseTwilic<T = TwilicValue>(
  c: Context,
  options?: TwilicParserOptions
): Promise<T> {
  return parseWithCodec<T>(defaultCodec, c, options);
}

export function twilicResponse(
  c: Context,
  value: TwilicValue,
  init?: ResponseInit
): Response {
  return responseWithCodec(defaultCodec, c, value, init);
}

export function twilicParser<T = TwilicValue>(options?: TwilicParserOptions) {
  return parserWithCodec<T>(defaultCodec, options);
}
