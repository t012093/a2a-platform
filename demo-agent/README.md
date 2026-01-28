# A2A Demo Agent

Simple A2A agent server for local testing. Exposes AgentCard and JSON-RPC/REST endpoints.

## Setup
```bash
npm install
npm run dev
```

## Endpoints
- AgentCard: `http://localhost:4000/.well-known/agent-card.json`
- JSON-RPC: `http://localhost:4000/a2a/jsonrpc`
- REST: `http://localhost:4000/a2a/rest`

## Notes
- Override base URL with `AGENT_BASE_URL=http://127.0.0.1:4000` if needed.
- Emits a demo Offer artifact and completes the task.
