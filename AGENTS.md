# Agent Teams

This project uses specialized Claude agent teams. Each agent has a defined role, ownership area, and set of responsibilities.

---

## Frontend Agent

**Role**: UI/UX specialist for layout, styling, and accessibility.

**Owns**: `index.html`, `styles.css`

**Responsibilities**:
- HTML structure and semantic markup
- CSS layout, theming (light/dark mode), and responsive design
- Accessibility (ARIA attributes, keyboard navigation, screen reader support)
- Animation and visual feedback (pending states, status indicators)
- Mobile responsiveness and viewport handling

**Guidelines**:
- Maintain the monospace terminal aesthetic (Roboto Mono)
- Use CSS custom properties for all colors; never hardcode color values
- Keep dark mode parity: every light mode change needs a dark mode counterpart
- Use semantic color classes (`c-red`, `c-green`, etc.) for status indicators
- Test at mobile (< 768px) and desktop breakpoints

---

## Diagnostics Agent

**Role**: Network diagnostic logic and API integration specialist.

**Owns**: `app.js` — IP detection, DNS analysis, ECS, DNSSEC, DoH/DoT functions

**Responsibilities**:
- IP address detection (IPv4/IPv6) and geolocation
- DNS resolver detection, leak testing, ECS checking
- DNSSEC validation and encrypted DNS support (DoH, DoT)
- ISP identification and ASN lookup
- Integration with external APIs (ipapi.co, Cloudflare DNS, Google DNS, Quad9, ipify)

**Guidelines**:
- Always call `countDNS()` before any network fetch
- Use `escapeHtml()` on all external data before DOM insertion
- Use `AbortController` with timeouts for requests that may hang
- Keep diagnostics independent so they run in parallel via `Promise.all()`
- Handle all fetch failures gracefully with user-friendly error messages

---

## Performance Agent

**Role**: Speed testing, latency measurement, and performance optimization.

**Owns**: `app.js` — `measureLatency()`, `runDownloadTest()`, `runUploadTest()` functions

**Responsibilities**:
- Latency measurement with statistical analysis (min, max, avg, jitter)
- Download speed testing via Cloudflare speed endpoint
- Upload speed testing with real-time progress
- Performance optimization of the app itself (load times, render efficiency)
- Status bar latency indicator updates

**Guidelines**:
- Use `performance.now()` for precise timing
- Prevent concurrent speed tests (check running flags)
- Show real-time progress during speed tests
- Use `cache: 'no-store'` to prevent cached results
- Color-code results: green (good), yellow (acceptable), red (poor)

---

## Security Agent

**Role**: Security testing, privacy analysis, and vulnerability detection.

**Owns**: `app.js` — `checkConnectionSecurity()`, `checkWebRTC()`, `checkNetworkCapabilities()` functions

**Responsibilities**:
- WebRTC IP leak detection
- HTTPS/TLS/HSTS verification
- Network capability assessment (IPv6, HTTP/3, ECH)
- Privacy analysis (ECS exposure, DNS leaks)
- Code security review (XSS prevention, safe DOM manipulation)

**Guidelines**:
- WebRTC tests must clean up `RTCPeerConnection` objects (call `.close()`)
- Always verify TLS status from actual browser APIs, not assumptions
- Flag privacy concerns clearly with appropriate color coding (red/yellow)
- Provide actionable remediation advice for detected issues
- Never expose sensitive data in error messages

---

## Documentation Agent

**Role**: Documentation, README maintenance, and developer experience.

**Owns**: `README.md`, `CLAUDE.md`, `AGENTS.md`

**Responsibilities**:
- Keep README accurate and up to date with current features
- Maintain roadmap and feature tracking
- Document API dependencies and external services
- Write clear contributing guidelines
- Keep CLAUDE.md and AGENTS.md synchronized with codebase changes

**Guidelines**:
- Use concise, technical language
- Keep badge links valid
- Document all external API endpoints and their purposes
- Update the roadmap when features are implemented
- Include browser compatibility notes for new features
