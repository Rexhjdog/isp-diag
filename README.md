# ISP-Diag

Advanced Network & ISP Diagnostic Tools - A comprehensive web-based network diagnostics suite inspired by dnscheck.tools, with enhanced features for detecting ISP throttling, routing issues, and comprehensive security analysis.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![JavaScript](https://img.shields.io/badge/javascript-vanilla-yellow.svg)

## Features

### Overview Dashboard
- **Connection Information**: IPv4/IPv6 detection, ISP identification, geolocation
- **Network Health Check**: Real-time status of DNS, latency, security, and WebRTC
- **Network Capabilities**: IPv6, DoH, DoT, DNSSEC, ESNI/ECH, HTTP/3 support detection

### DNS Analysis
- **DNS Resolver Detection**: Identifies your current DNS servers
- **DNS Leak Test**: Comprehensive testing for VPN/DNS leaks
- **EDNS Client Subnet (ECS)**: Checks if your subnet is exposed to authoritative DNS
- **DNSSEC Validation**: Verifies DNS security extensions

### Speed Test
- **Download Speed**: Multi-threaded download testing
- **Upload Speed**: Upload bandwidth measurement
- **Latency & Jitter**: Comprehensive ping analysis
- **Test History**: Local storage of previous tests
- **Visual Gauges**: Real-time speed visualization

### ISP Throttling Detection
- **Video Streaming Tests**: Netflix, YouTube, Disney+, Hulu, HBO Max
- **Protocol-Specific Tests**: HTTP, HTTPS, QUIC/HTTP3 comparison
- **Port Analysis**: Common port availability and shaping detection
- **DPI Detection**: Deep Packet Inspection indicators

### Routing Analysis
- **Visual Traceroute**: Graphical route visualization
- **Hop Analysis**: Per-hop latency and packet loss
- **AS Path Tracking**: Autonomous System routing information
- **Routing Flaw Detection**: Identifies suboptimal paths and issues

### Security & Privacy
- **WebRTC Leak Test**: Detects real IP exposure
- **TLS/SSL Analysis**: Connection security details
- **Encrypted DNS Support**: DoH, DoT, DoQ capability checks
- **Browser Fingerprinting**: Unique identifier generation

## Usage

### Local Development
Simply open `index.html` in a modern web browser:

```bash
# Clone the repository
git clone https://github.com/Rexhjdog/isp-diag.git
cd isp-diag

# Open in browser
open index.html
# or
python -m http.server 8000
```

### Deployment
This is a static website that can be deployed to any web hosting service:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- Any static web host

## Technical Details

### Pure Client-Side
- No server required - runs entirely in the browser
- Uses public APIs and standard web technologies
- Local storage for test history
- No data collection or tracking

### Browser Requirements
- Modern browsers with ES6+ support
- WebRTC API support for leak tests
- Fetch API for network requests
- Canvas API for visualizations

### APIs Used
- ipapi.co for geolocation
- Cloudflare DNS over HTTPS
- Google DNS API
- Various streaming endpoints for throttling tests

## Privacy

This tool:
- Runs entirely in your browser
- Does not store any data on servers
- Only uses local storage for your test history
- Does not track or fingerprint users
- All network tests are initiated by your browser

## Limitations

Due to browser security restrictions:
- Cannot perform true traceroute (uses simulation)
- Limited ability to detect all forms of DPI
- Cannot test raw TCP/UDP ports directly
- Speed tests may be affected by browser throttling

## Roadmap

- [ ] WebSocket-based real-time tests
- [ ] More streaming service tests
- [ ] IPv6-specific diagnostics
- [ ] Mobile app version
- [ ] API for programmatic access
- [ ] Historical data analysis
- [ ] Export test results (PDF/JSON)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by [dnscheck.tools](https://dnscheck.tools)
- Speed test methodology from various open source projects
- DNS testing concepts from the DNS privacy community

## Disclaimer

This tool is for educational and diagnostic purposes only. Results may vary based on network conditions, browser settings, and ISP configurations.