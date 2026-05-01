# Cloud Agent Driver

Generic HTTP/SSE client that drives any agent whose `AGENT.md` declares
`execution: cloud` or `execution: hybrid` with `cloud.*` routes.

## What it does

- Reads route templates from the agent's manifest:
  - `cloud.run`     — starts a session (usually `POST`, often streaming SSE)
  - `cloud.message` — sends a mid-run message (optional)
  - `cloud.cancel`  — cancels an active session (optional)
- Substitutes `{sessionId}` in path templates with the id captured from the
  first SSE `session` event or JSON response.
- Forwards events via an `onEvent` callback in the same shape the local worker
  uses, so renderer code stays execution-mode agnostic:
  `{ type: 'progress'|'error'|'done', agentId, message?, result?, cancelled? }`

## Base URL

The cloud service URL comes from user settings
(`settings.cloudAgents.apiBaseUrl`). No default is baked in — this client
ships safely on every branch.

## Using it from a different backend

The service must speak the same minimal protocol:
- Responds with `text/event-stream` or `application/json` to `POST cloud.run`
- Emits SSE `event:` names in `{progress, speech, log, error, done, cancelled, session}`
  (see `translateEvent` in `client.js`)
- Accepts JSON body `POST cloud.message` with whatever shape the agent chooses
- Accepts `DELETE cloud.cancel` to terminate a session

Point MAD at `https://your.server/` via Settings → Cloud Agents and drop an
`AGENT.md` in `agents/` with matching `cloud.*` routes.
