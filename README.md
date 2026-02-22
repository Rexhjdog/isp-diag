# ISP-Diag v2.0

Agent-powered network & ISP diagnostic tool. Each diagnostic category is handled by a specialized AI agent that runs real network tests and provides intelligent analysis.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-20+-green.svg)

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Browser (Frontend)                              │
│  ├─ SSE connection to /api/diagnose              │
│  ├─ Client-side: speed tests, WebRTC leak test   │
│  └─ Displays agent results as they stream in     │
└──────────────────┬───────────────────────────────┘
                   │ SSE
┌──────────────────▼───────────────────────────────┐
│  Express Server                                  │
│  ├─ Spawns 5 agents in parallel                  │
│  ├─ Each agent calls Claude with domain tools    │
│  ├─ Agents run tools → analyze results → respond │
│  └─ Results stream back via Server-Sent Events   │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│  Agents (Claude + Tools)                         │
│  ├─ IP & Location    → ipapi.co, IPv6 check     │
│  ├─ DNS Analysis     → DoH, DNSSEC, ECS, leaks  │
│  ├─ Security         → TLS, headers, certs      │
│  ├─ Network          → IPv6, HTTP/3, connectivity│
│  └─ Performance      → DNS latency, HTTP latency│
└──────────────────────────────────────────────────┘
```

## Agents

| Agent | Tools | What it checks |
|-------|-------|----------------|
| **IP & Location** | `lookup_ip`, `check_ipv6` | Public IP, ISP, geolocation, IPv6 availability |
| **DNS Analysis** | `query_doh`, `check_dnssec`, `check_ecs`, `test_dns_leak` | DNSSEC validation, DoH support, ECS exposure, DNS leak testing |
| **Security** | `check_tls`, `check_security_headers`, `check_certificate` | TLS/HTTPS config, security headers, certificate validity |
| **Network** | `check_ipv6`, `check_protocol_support`, `check_connectivity` | IPv6, HTTP/3, multi-endpoint connectivity |
| **Performance** | `measure_dns_latency`, `measure_http_latency` | DNS query latency, HTTP round-trip time, jitter |

Each agent is a Claude instance with domain-specific tools. The agent decides which tools to call, executes them, and provides analysis with recommendations.

## Setup

```bash
git clone https://github.com/Rexhjdog/isp-diag.git
cd isp-diag
npm install
```

Create a `.env` file with your Anthropic API key:

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Usage

```bash
npm start
# Server runs at http://localhost:3000
```

Open the URL in your browser and click **[run diagnostics]** to deploy all agents.

### How it works

1. Click "run diagnostics" — frontend opens SSE connection to the server
2. Server spawns 5 specialized agents in parallel
3. Each agent calls Claude with its tools and system prompt
4. Claude decides which tools to run, server executes them
5. Agent analyzes raw results and provides insights
6. Results stream back to the browser in real-time
7. After agents finish, client-side tests (speed, WebRTC) become available

## Client-Side Tests

Some tests must run in the browser (they test YOUR connection, not the server's):

- **Speed Test** — Download (10MB) and upload (5MB) via Cloudflare
- **WebRTC Leak Test** — Checks if your real IP is exposed via WebRTC/STUN

After running, speed results can optionally be sent to the server for AI analysis.

## Project Structure

```
isp-diag/
├── server.js              # Express server, SSE + analysis endpoints
├── agents/
│   ├── runner.js          # Generic agent execution loop
│   ├── ip-agent.js        # IP & Location agent
│   ├── dns-agent.js       # DNS Analysis agent
│   ├── security-agent.js  # Security agent
│   ├── network-agent.js   # Network Capabilities agent
│   └── performance-agent.js # Performance agent
├── public/
│   ├── index.html         # Frontend markup
│   ├── styles.css         # Monospace terminal aesthetic
│   └── app.js             # SSE client, speed tests, WebRTC
├── package.json
├── .env.example
└── .gitignore
```

## Privacy

- Network diagnostics run server-side (your IP is used for lookups)
- Speed tests and WebRTC checks run in your browser
- No data is stored or tracked
- AI analysis is stateless (no conversation history)

## Requirements

- Node.js 20+
- Anthropic API key

## License

MIT
