# Jenkins + Uptime Kuma setup

Assumes the same environment as your EVAT pipeline: Jenkins on Windows, Docker Desktop, SonarQube on `:9000`, Uptime Kuma on `:3001`.
Nothing needs installing on the agent beyond Docker – Node, Sonar scanner and Trivy all run as containers.

## 1. Jenkins credentials
| ID | Type | Status |
|---|---|---|
| `sonarqube-token` | Secret text | already have |
| `github-token` | Username + password (PAT) | already have |
| `dockerhub-creds` | Username + password | already have |
| `crud-kuma-push-token` | Secret text | **new** – push-monitor token (section 2) |
| `crud-db-root-password` | Secret text | **new** – any strong password |
| `crud-db-password` | Secret text | **new** – any strong password |

`uptime-kuma-push-token` belongs to EVAT's monitor, so this project uses its own.

## 2. Uptime Kuma (http://localhost:3001) – one-time
Create three monitors (*Add New Monitor*):

| Monitor | Type | Settings |
|---|---|---|
| **CRUD Web (prod)** | HTTP(s) | URL `http://host.docker.internal:3000`, interval 60 s, retries 2 |
| **CRUD API health (prod)** | HTTP(s) – Keyword | URL `http://host.docker.internal:3100/health`, keyword `ok`, interval 60 s, retries 2 |
| **CRUD Pipeline** | Push | copy the generated **push token** → Jenkins credential `crud-kuma-push-token`; heartbeat interval longer than your usual gap between builds |

Then *Settings → Notifications* → add a channel (Email/SMTP, Discord, Telegram, Slack …) and tick **Apply on all existing monitors** so all three alert you.
Use `host.docker.internal` because Kuma runs in Docker; if Kuma runs natively on Windows use `localhost`.
The two HTTP monitors will show DOWN until the first release deploys production – that is expected.

## 3. SonarQube
Nothing new: the token is already in `sonarqube-token`. The project `crud-react-nodejs-mysql` is auto-created on first scan.

## 4. Jenkins job
New Item → Pipeline → *Pipeline script from SCM* → your GitHub repo → script path `Jenkinsfile`.
Edit `GITHUB_REPO` at the top of the Jenkinsfile if your repo name differs.

## Ports on the Docker host
| | Web | API |
|---|---|---|
| staging | 4000 | 4100 |
| production | 3000 | 3100 |

(3001 is Kuma, 9000 SonarQube, 8080 Jenkins – no clashes.)

## Troubleshooting
* Script `sh\r: not found` or nginx entrypoint fails → CRLF line endings; `.gitattributes` forces LF – re-clone or `git add --renormalize .`
* Sonar shows 0 % coverage → check `reports/api/coverage/lcov.info` exists in the workspace after the Test stage.
* Kuma push returns 404 → wrong token, or the Push monitor was deleted.
* API container `unhealthy` with `ER_NOT_SUPPORTED_AUTH_MODE` -> old `mysql` driver vs MySQL 8.4's default login method; fixed by using `mysql2` (already in this version).
* `Could not find credentials entry with ID 'crud-kuma-push-token'` -> create that Secret text credential (the Kuma Push monitor token).
