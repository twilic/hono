# @twilic/hono

Hono helpers and middleware for Twilic binary request and response bodies.

## Install

```bash
pnpm add @twilic/hono hono @twilic/core
```

## Usage

```ts
import { Hono } from "hono";
import { twilicParser, twilicResponse } from "@twilic/hono";

const app = new Hono();

app.post("/users", twilicParser(), async (c) => {
  const input = c.var.twilicBody;
  return twilicResponse(c, { ok: true, received: input });
});
```

## API

- `TWILIC_CONTENT_TYPE`
- `parseTwilic(c, options?)`
- `twilicResponse(c, value, init?)`
- `twilicParser(options?)`
- `createTwilicHono(codec?)`

## Request body limits

`twilicParser()` and `parseTwilic()` limit the body to **1,048,576 bytes (1 MiB)** by default. The same options apply to factory-created `parser()` and `parse()` helpers. Set `limit` to a non-negative safe integer in bytes:

```ts
twilicParser({ limit: 256 * 1024 });
await parseTwilic(c, { limit: 256 * 1024 });
```

The reader counts received chunks, including requests without `Content-Length`, and stops before decoding an oversized body. Middleware responds with HTTP 413. A direct `parse()` call rejects with an error carrying `status: 413`. `limit: 0` permits an empty body only. Previously accepted larger requests now require an explicit higher limit; decoded collection limits still apply separately.

Mount the parser before other middleware consumes the request stream. Also configure request timeouts and authentication for the route.

## Runnable example

```bash
pnpm example:http-roundtrip:hono     # Hono server (in twilic/examples)
pnpm example:http-roundtrip:client
```

See [`http-roundtrip/`](https://github.com/twilic/examples/tree/main/http-roundtrip).

## Changelog

See [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Publish to npm

The package ships build artifacts from `dist/`.

Local dry run:

```bash
pnpm build
pnpm pack
```

GitHub Actions publish uses [npm trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers/)—no long-lived `NPM_TOKEN` secret.

One-time setup on [npmjs.com](https://www.npmjs.com/package/@twilic/hono): open the package → **Settings** → **Trusted Publisher** → **GitHub Actions**, then set **Organization or user** `twilic`, **Repository** `hono`, and **Workflow filename** `publish-npm.yml` (exact name, including `.yml`). See also [GitHub Actions OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect).

Release steps:

1. Update [docs/CHANGELOG.md](docs/CHANGELOG.md) and bump `version` in `package.json`.
2. Create and push matching tag `v<version>`.

Example:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow `.github/workflows/publish-npm.yml` verifies tag/version match, runs tests, and then runs `npm publish` (OIDC authentication via `id-token: write`).

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
