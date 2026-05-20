import { decode, encode, type TwilicValue } from "@twilic/core";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

export const TWILIC_CONTENT_TYPE = "application/vnd.twilic";

export interface TwilicCodec {
  encode: (value: TwilicValue) => Uint8Array;
  decode: (bytes: Uint8Array) => TwilicValue;
}

export interface TwilicParserOptions {
  requireContentType?: boolean;
}

export interface TwilicHono<T = TwilicValue> {
  parse: (c: Context) => Promise<T>;
  response: (c: Context, value: TwilicValue, init?: ResponseInit) => Response;
  parser: (
    options?: TwilicParserOptions,
  ) => ReturnType<typeof createMiddleware<{ Variables: { twilicBody: T } }>>;
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

function parseWithCodec<T>(codec: TwilicCodec, c: Context): Promise<T> {
  return c.req
    .arrayBuffer()
    .then((body) => codec.decode(new Uint8Array(body)) as T);
}

function responseWithCodec(
  codec: TwilicCodec,
  _c: Context,
  value: TwilicValue,
  init?: ResponseInit,
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

  return createMiddleware<{ Variables: { twilicBody: T } }>(async (c, next) => {
    const contentType = c.req.header("content-type");
    if (requireContentType && !hasTwilicContentType(contentType)) {
      return c.text("Unsupported Media Type", 415);
    }

    const value = await parseWithCodec<T>(codec, c);
    c.set("twilicBody", value);
    await next();
  });
}

const defaultCodec: TwilicCodec = {
  encode,
  decode,
};

export function createTwilicHono<T = TwilicValue>(
  codec: TwilicCodec = defaultCodec,
): TwilicHono<T> {
  return {
    parse: (c) => parseWithCodec<T>(codec, c),
    response: (c, value, init) => responseWithCodec(codec, c, value, init),
    parser: (options) => parserWithCodec<T>(codec, options),
  };
}

export function parseTwilic<T = TwilicValue>(c: Context): Promise<T> {
  return parseWithCodec<T>(defaultCodec, c);
}

export function twilicResponse(
  c: Context,
  value: TwilicValue,
  init?: ResponseInit,
): Response {
  return responseWithCodec(defaultCodec, c, value, init);
}

export function twilicParser<T = TwilicValue>(options?: TwilicParserOptions) {
  return parserWithCodec<T>(defaultCodec, options);
}
