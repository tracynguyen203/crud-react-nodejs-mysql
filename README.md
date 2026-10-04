# CRUD App – React + Node.js + MySQL with a Jenkins CI/CD pipeline

Based on [gespinal/crud-react-nodejs-mysql](https://github.com/gespinal/crud-react-nodejs-mysql).
A small items CRUD app (React front-end, Express API, MySQL) with a 7-stage Jenkins pipeline.

```
 git push ─► Jenkins ─► Build ─► Test ─► Code Quality ─► Security ─► Deploy ─► Release ─► Monitoring
                         Docker   Jest    SonarQube       Trivy      staging    prod      Uptime Kuma
                         images   RTL     quality gate    gate       + smoke    + rollback  + alerts
                                                                     tests
```

## Repository layout
| Path | Purpose |
|---|---|
| `api/` | Express REST API (`app.js` = routes, `index.js` = bootstrap), Jest tests, multi-stage `Dockerfile` |
| `web/` | React app, RTL tests, `Dockerfile` (build → unprivileged nginx), runtime config |
| `sql/` | DB schema loaded by MySQL on first start |
| `docker-compose.yml` | Local dev stack |
| `docker-compose.deploy.yml` | Parameterised stack Jenkins uses for **staging and production** |
| `Jenkinsfile` | The pipeline |
| `tests/smoke.js` | Post-deploy integration test (full CRUD through web → API → MySQL) |
| `sonar-project.properties` | SonarQube analysis config |
| `.trivyignore` | Documented, expiring Trivy exceptions |
| `scripts/` | Test / audit scripts run inside throw-away Node containers by the pipeline |
| `docs/JENKINS_SETUP.md` | One-time Jenkins/tool configuration |
| `docs/SECURITY_REPORT.md` | Vulnerabilities found, severity, and how each was handled |

## Run locally
```bash
docker compose up --build
# web http://localhost:3000   api http://localhost:3001/health   adminer http://localhost:8080
(cd api && npm ci && npm test)
(cd web && npm ci && CI=true npm test)
```

## Stage by stage
| # | Stage | What it does | Fails the build when |
|---|---|---|---|
| 1 | **Build** | `docker build` for `crud-api` and `crud-web` (multi-stage) – the images are the artefacts, tagged with the build number | a build error |
| 2 | **Test** | Jest + Supertest (API, 16 tests) and React Testing Library (web, 6 tests) run in Node containers; JUnit published, lcov coverage kept for Sonar | any test fails |
| 3 | **Code Quality** | SonarQube scanner container + `sonar.qualitygate.wait=true` (smells, duplication, complexity, coverage) | quality gate red → build **UNSTABLE** |
| 4 | **Security** | `npm audit` (prod deps), Trivy `fs` (secrets, Dockerfile misconfig), Trivy `image` for both images; reports archived | findings → build **UNSTABLE** |
| 5 | **Deploy** | `docker compose -p crud-staging up` with the local images, then `tests/smoke.js` (full CRUD through web → API → MySQL) | a smoke check fails |
| 6 | **Release** | (optional approval) → push images to Docker Hub → git tag `v1.0.N` → pull and run `crud-prod` → smoke test → **automatic rollback** on failure | prod verification fails |
| 7 | **Monitoring** | Confirms prod is answering, sends an `up` heartbeat to the Uptime Kuma push monitor; failed builds send `down`. Kuma's HTTP monitors watch prod 24/7 | prod/Kuma unreachable |

### Design decisions worth mentioning in your report
* **Build once, promote the same artefact.** The web image reads `API_URL` at container start (`web/nginx/40-runtime-config.sh` → `/config.js`), so staging and production run byte-identical images.
* **`/health` endpoint** pings MySQL; used by Docker healthchecks, smoke tests and Uptime Kuma.
* **Compose healthchecks** (`service_healthy`) make the API wait for MySQL – the original compose file only waited for the container to *start*.
* **Secrets** (DB passwords, Docker Hub token, Kuma login) live in Jenkins credentials; the original code had `user/user` hard-coded in `api/index.js`.
* **Code fixes made while preparing the project:** API no longer hangs on DB errors or crashes on a missing `item`; input validation; connection pool; `class`→`className`, `==`→`===`, list `key`s in React; non-root containers; pinned image tags instead of `node:latest`.

See **docs/JENKINS_SETUP.md** to get it running and **docs/SECURITY_REPORT.md** for the security write-up.
