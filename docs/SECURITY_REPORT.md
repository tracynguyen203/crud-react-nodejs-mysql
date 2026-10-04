# Security stage report

Scanners: **npm audit** (production deps) and **Trivy** (filesystem + image) in the Jenkins *Security* stage. Policy: any **fixable HIGH or CRITICAL**
finding marks the build UNSTABLE (visible, but later stages still run); findings are fixed, or – if a false positive – listed with a reason and expiry in `.trivyignore`.
Trivy skips npm `devDependencies` by default, so the gate covers what ships to production.

## Baseline: `npm audit` on the original project (production dependencies)
| Component | Total | Critical | High | Moderate | Low |
|---|---|---|---|---|---|
| API (original) | 16 | 0 | 11 | 2 | 3 |
| Web (original) | 78 | 6 | 36 | 21 | 15 |

## Findings and how each was addressed
| # | Issue | Severity | Action taken | Result |
|---|---|---|---|---|
| 1 | **axios ≤ 0.32** (API + Web) – known request-handling vulnerabilities | High | Web: upgraded to axios 1.x. API: **removed** – it was declared but never imported | Fixed |
| 2 | **express / body-parser** old 4.x versions | High | Upgraded express to ^4.21; removed `body-parser` (express 4.16+ has `express.json()` built in, already used) | Fixed |
| 3 | **nodemon 2.0.x** (shipped in the prod image) | High | Moved out of production: dev script now uses `node --watch`; prod image installs with `npm ci --omit=dev` | Fixed |
| 4 | **react-scripts / Create-React-App toolchain** (webpack, postcss, svgo, serialize-javascript …) – source of nearly all Web findings incl. the 6 criticals | Critical–High | These packages only run at **build time**: they are not in the final image (static files served by nginx). Moved `react-scripts` to `devDependencies`, upgraded to 5.0.1, multi-stage Docker build so none of it reaches production | Mitigated (not exploitable at runtime). Long-term fix: migrate from CRA to Vite |
| 5 | **Test tooling** (jest, jest-junit → `uuid`) | High / Moderate | Upgraded Jest to 30 and jest-junit to 17; dev-only | Fixed |
| 6 | **Hard-coded DB credentials** in `api/index.js` and committed `.env` files | High (secret exposure) | Credentials now come from environment variables supplied from Jenkins credentials; `.env` files removed from the repo and git-ignored | Fixed |
| 7 | **`node:latest` base image** – unpinned, large attack surface, ran as root | Medium | Pinned `node:22-alpine` / `nginx-unprivileged:1.27-alpine`; containers run as non-root | Fixed |

## After the fixes (local `npm audit`)
| Component | All deps | Production deps only |
|---|---|---|
| API | 0 | 0 |
| Web | 70 (all CRA build toolchain) | 0 |

## Findings from the first Jenkins Trivy run (images built from `node:20-alpine` / `nginx-unprivileged:1.27-alpine`)
| # | Image | What it is | Severity | Action |
|---|---|---|---|---|
| 8 | API | **npm's bundled libraries** inside the Node base image (`brace-expansion`, `cross-spawn`, `glob`, `ip-address`, `minimatch`, `pacote`, `sigstore`, `tar`) – 22 findings (21 HIGH, 1 CRITICAL: `tar` CVE-2026-59873, DoS via gzip bomb) | HIGH / CRITICAL | Not part of our app and never used at runtime. **Removed npm, yarn and corepack from the final image**; moved to `node:22-alpine` (Node 20 is end-of-life) |
| 9 | API | **OpenSSL** `libssl3` / `libcrypto3` (e.g. CVE-2026-45447 use-after-free in `PKCS7_verify`, CVE-2026-14456 QUIC DoS) – fixed versions exist | HIGH | `apk upgrade` in the image build pulls the patched Alpine packages |
| 10 | Web | **42 Alpine OS packages** in the old nginx base (Alpine 3.21.3): openssl (incl. CRITICAL CVE-2026-31789), c-ares, libexpat, libpng, libxml2, musl, nghttp2-libs, zlib – all with fixes available | 40 HIGH, 2 CRITICAL | Moved to `nginx-unprivileged:stable-alpine` (newer Alpine) and added `apk upgrade` |

Anything Trivy still reports after this must be either fixed or – if there is no upstream fix or it is not reachable – added to `.trivyignore` with a reason and an expiry date, and listed here.

## ⚠️ What you must add after your next run
1. Re-run the pipeline and open `reports/trivy-api.txt`, `reports/trivy-web.txt`, `reports/trivy-fs.txt` and `reports/npm-audit.txt`.
2. Add one row per remaining finding to the tables above: *what it is, severity, fixed (how) or ignored (why)*.
