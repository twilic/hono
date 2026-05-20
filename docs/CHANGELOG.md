# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-20

Initial public release of `@twilic/hono`.

### Added

- `TWILIC_CONTENT_TYPE` (`application/vnd.twilic`) constant.
- `parseTwilic(c)` helper to decode Twilic request bodies.
- `twilicResponse(c, value, init?)` helper to return Twilic-encoded responses.
- `twilicParser(options?)` middleware that sets `c.var.twilicBody` with optional content-type validation.
- `createTwilicHono(codec?)` factory for injectable encode/decode (runtime-neutral usage).
- Node integration tests with Hono `app.request()`.
- CI workflows for format, lint, typecheck, tests, commitlint, and PR body validation.
- npm publish workflow with [trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers/).
