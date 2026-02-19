# ISP-Diag Project Guide

## Project Overview

ISP-Diag is a client-side network diagnostics tool that runs entirely in the browser. It detects IP addresses, ISP info, DNS resolvers, security posture, network capabilities, latency, speed, and WebRTC leaks.

## Architecture

- **Pure static site** - no build system, no bundler, no package manager
- **4 files**: `index.html`, `app.js`, `styles.css`, `README.md`
- **Zero dependencies** - vanilla HTML5, CSS3, JavaScript ES6+
- **Client-side only** - no server backend; uses public APIs (ipapi.co, Cloudflare DNS, Google DNS, ipify, Cloudflare speed)

## Code Conventions

- Vanilla JavaScript with async/await
- Functions organized by diagnostic category (IP, DNS, Security, Speed, etc.)
- DOM updates via `setEntry(id, html)` helper
- Status bar updates via `setStatusBar(id, state)` where state is `'good'`, `'bad'`, or `'warn'`
- DNS query counting via `countDNS()` for every network request
- HTML escaping via `escapeHtml(str)` for user-facing data
- Semantic color classes: `c-red`, `c-orange`, `c-yellow`, `c-green`, `c-blue`, `c-indigo`, `c-violet`, `c-muted`
- CSS uses custom properties (variables) in `:root` with dark mode via `prefers-color-scheme`
- Monospace font (Roboto Mono) throughout

## Testing

No automated test suite. Manual testing by opening `index.html` in a browser or via `python -m http.server 8000`.

## Key Patterns

- All diagnostics run in parallel via `Promise.all()` in the `DOMContentLoaded` handler
- Shared IP data is fetched once (`fetchIPData()`) and passed to dependent functions
- AbortController with timeouts for requests that might hang (IPv6, etc.)
- Speed tests are user-initiated (click to run) with progress display

## File Responsibilities

| File | Purpose |
|------|---------|
| `index.html` | Page structure, sections, status bar, help overlay |
| `app.js` | All diagnostic logic, DOM manipulation, event handlers |
| `styles.css` | Layout, theming (light/dark), responsive design, animations |
| `README.md` | Documentation, feature list, roadmap |

## Security Notes

- Always use `escapeHtml()` when inserting external data into the DOM
- Use `innerHTML` only with properly escaped content
- CORS restrictions limit some diagnostic capabilities
- WebRTC tests require user consent in some browsers
