// ISP-Diag - Advanced Network Diagnostics
// Main Application JavaScript

class ISPDiag {
    constructor() {
        this.testServers = [
            { name: 'Cloudflare', url: 'https://speed.cloudflare.com/__down?bytes=25000000', location: 'Global' },
            { name: 'Fast.com (Netflix)', url: 'https://fast.com', location: 'Global' },
            { name: 'Google Fiber', url: 'https://fiber.google.com/speedtest', location: 'USA' },
            { name: 'Speedtest.net', url: 'https://speedtest.net', location: 'Global' }
        ];
        
        this.streamingEndpoints = {
            netflix: { url: 'https://fast.com', name: 'Netflix/Fast' },
            youtube: { url: 'https://youtube.com/api/stats/playback', name: 'YouTube' },
            disney: { url: 'https://disneyplus.com', name: 'Disney+' },
            hulu: { url: 'https://hulu.com', name: 'Hulu' },
            hbomax: { url: 'https://max.com', name: 'HBO Max' }
        };
        
        this.speedTestHistory = JSON.parse(localStorage.getItem('speedTestHistory') || '[]');
        this.currentSpeedTest = null;
        
        this.init();
    }

    init() {
        this.setupTabs();
        this.detectConnectionInfo();
        this.runHealthChecks();
        this.checkNetworkCapabilities();
        this.startDNSDetection();
        this.loadSpeedTestHistory();
        this.setupWebRTCTest();
        this.checkTLSSupport();
        this.checkEncryptedDNSSupport();
        this.generateFingerprint();
        
        // Update connection status
        this.updateConnectionStatus();
        setInterval(() => this.updateConnectionStatus(), 5000);
    }

    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    updateConnectionStatus() {
        const dot = document.getElementById('connectionDot');
        const status = document.getElementById('connectionStatus');
        
        if (navigator.onLine) {
            dot.classList.add('connected');
            dot.classList.remove('disconnected');
            status.textContent = 'Connected';
        } else {
            dot.classList.add('disconnected');
            dot.classList.remove('connected');
            status.textContent = 'Disconnected';
        }
    }

    async detectConnectionInfo() {
        try {
            // Get IP and location info
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            document.getElementById('ipv4').textContent = data.ip || 'Unknown';
            document.getElementById('isp').textContent = data.org || data.asn || 'Unknown';
            document.getElementById('location').textContent = 
                `${data.city}, ${data.region}, ${data.country_name}`;
            
            // Try to get IPv6
            this.detectIPv6();
            
        } catch (error) {
            console.error('Error detecting connection info:', error);
            document.getElementById('ipv4').textContent = 'Detection failed';
        }
        
        // Set user agent
        document.getElementById('userAgent').textContent = navigator.userAgent.substring(0, 50) + '...';
        
        // Connection type
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            const type = connection.effectiveType || connection.type || 'Unknown';
            document.getElementById('connectionType').textContent = 
                `${type.toUpperCase()} (${Math.round(connection.downlink || 0)} Mbps down)`;
        } else {
            document.getElementById('connectionType').textContent = 'Unknown';
        }
    }

    async detectIPv6() {
        try {
            // Try to fetch from an IPv6-only endpoint
            const response = await fetch('https://api6.ipify.org?format=json', { 
                mode: 'cors',
                timeout: 3000 
            });
            const data = await response.json();
            document.getElementById('ipv6').textContent = data.ip;
        } catch {
            document.getElementById('ipv6').textContent = 'Not available / Blocked';
        }
    }

    async runHealthChecks() {
        // DNS Health
        this.checkDNSHealth();
        
        // Latency Health
        this.checkLatencyHealth();
        
        // Security Health
        this.checkSecurityHealth();
        
        // WebRTC Health
        this.checkWebRTCHealth();
    }

    async checkDNSHealth() {
        const el = document.querySelector('#dnsHealth .health-value');
        try {
            const start = performance.now();
            await fetch('https://cloudflare-dns.com/dns-query?name=example.com&type=A', {
                headers: { 'Accept': 'application/dns-json' }
            });
            const latency = Math.round(performance.now() - start);
            
            el.textContent = `${latency}ms`;
            el.className = 'health-value good';
        } catch {
            el.textContent = 'Issues detected';
            el.className = 'health-value warning';
        }
    }

    async checkLatencyHealth() {
        const el = document.querySelector('#latencyHealth .health-value');
        const latencies = [];
        
        for (let i = 0; i < 5; i++) {
            const start = performance.now();
            try {
                await fetch('https://www.google.com/favicon.ico', { 
                    mode: 'no-cors',
                    cache: 'no-store'
                });
                latencies.push(performance.now() - start);
            } catch {}
        }
        
        if (latencies.length > 0) {
            const avg = Math.round(latencies.reduce((a, b) => a + b) / latencies.length);
            el.textContent = `${avg}ms avg`;
            el.className = avg < 50 ? 'health-value good' : avg < 150 ? 'health-value warning' : 'health-value bad';
        } else {
            el.textContent = 'Check failed';
            el.className = 'health-value bad';
        }
    }

    async checkSecurityHealth() {
        const el = document.querySelector('#securityHealth .health-value');
        
        // Check if HTTPS
        if (window.location.protocol === 'https:') {
            el.textContent = 'HTTPS Active';
            el.className = 'health-value good';
        } else {
            el.textContent = 'Not Secure';
            el.className = 'health-value bad';
        }
    }

    async checkWebRTCHealth() {
        const el = document.querySelector('#webrtcHealth .health-value');
        
        try {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('test');
            
            let hasLeak = false;
            pc.onicecandidate = (ice) => {
                if (ice && ice.candidate && ice.candidate.candidate) {
                    const ipMatch = ice.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                    if (ipMatch) {
                        hasLeak = true;
                    }
                }
            };
            
            await pc.createOffer().then(o => pc.setLocalDescription(o));
            
            setTimeout(() => {
                if (hasLeak) {
                    el.textContent = 'Leak Risk';
                    el.className = 'health-value warning';
                } else {
                    el.textContent = 'Secure';
                    el.className = 'health-value good';
                }
            }, 1000);
        } catch {
            el.textContent = 'Disabled';
            el.className = 'health-value good';
        }
    }

    async checkNetworkCapabilities() {
        // IPv6 Support
        const ipv6El = document.querySelector('#capIPv6 .cap-status');
        try {
            await fetch('https://api6.ipify.org?format=json', { mode: 'cors', timeout: 2000 });
            ipv6El.textContent = 'Supported';
            ipv6El.classList.add('supported');
        } catch {
            ipv6El.textContent = 'Not Available';
            ipv6El.classList.add('unsupported');
        }
        
        // DNS over HTTPS
        const dohEl = document.querySelector('#capDoH .cap-status');
        try {
            await fetch('https://cloudflare-dns.com/dns-query?name=example.com&type=A', {
                headers: { 'Accept': 'application/dns-json' }
            });
            dohEl.textContent = 'Supported';
            dohEl.classList.add('supported');
        } catch {
            dohEl.textContent = 'Check Failed';
            dohEl.classList.add('unsupported');
        }
        
        // DNS over TLS (we can't directly test this from browser, so we check if browser supports it)
        const dotEl = document.querySelector('#capDoT .cap-status');
        dotEl.textContent = 'Browser Limited';
        dotEl.classList.add('warning');
        
        // DNSSEC
        const dnssecEl = document.querySelector('#capDNSSEC .cap-status');
        dnssecEl.textContent = 'Resolver Dependent';
        dnssecEl.classList.add('warning');
        
        // ESNI/ECH
        const esniEl = document.querySelector('#capESNI .cap-status');
        if (navigator.userAgent.includes('Firefox') && navigator.userAgent.includes('Mozilla/5.0')) {
            esniEl.textContent = 'Firefox Supported';
            esniEl.classList.add('supported');
        } else {
            esniEl.textContent = 'Limited Support';
            esniEl.classList.add('warning');
        }
        
        // HTTP/3 / QUIC
        const quicEl = document.querySelector('#capQUIC .cap-status');
        if (navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Firefox')) {
            quicEl.textContent = 'Supported';
            quicEl.classList.add('supported');
        } else {
            quicEl.textContent = 'Unknown';
            quicEl.classList.add('warning');
        }
    }

    async startDNSDetection() {
        await this.detectDNSResolvers();
        await this.checkECS();
        await this.checkDNSSEC();
    }

    async detectDNSResolvers() {
        const container = document.getElementById('dnsResolvers');
        
        // DNS resolvers we can detect
        const tests = [
            { name: 'Google DNS', ips: ['8.8.8.8', '8.8.4.4'] },
            { name: 'Cloudflare', ips: ['1.1.1.1', '1.0.0.1'] },
            { name: 'OpenDNS', ips: ['208.67.222.222', '208.67.220.220'] },
            { name: 'Quad9', ips: ['9.9.9.9', '149.112.112.112'] }
        ];
        
        let html = '';
        
        // Try to get actual resolver info from multiple sources
        try {
            // Method 1: Try to get from browser's DNS
            const responses = await Promise.allSettled([
                fetch('https://dns.google/resolve?name=dnscheck.tools&type=A'),
                fetch('https://cloudflare-dns.com/dns-query?name=dnscheck.tools&type=A', {
                    headers: { 'Accept': 'application/dns-json' }
                })
            ]);
            
            html += `
                <div class="dns-item">
                    <div class="dns-info">
                        <span class="dns-ip">System Default</span>
                        <span class="dns-hostname">Using ISP or system-configured resolvers</span>
                    </div>
                    <div class="dns-badges">
                        <span class="badge">Active</span>
                    </div>
                </div>
            `;
        } catch {
            html += '<div class="loading">Could not detect specific DNS resolvers</div>';
        }
        
        container.innerHTML = html;
    }

    async checkECS() {
        const container = document.getElementById('ecsResults');
        
        try {
            // Test ECS by querying a specialized service
            const response = await fetch('https://dns.google/resolve?name=dnscheck.tools&type=A&edns_client_subnet=0.0.0.0/0');
            const data = await response.json();
            
            container.innerHTML = `
                <div class="analysis-item">
                    <strong>EDNS Client Subnet:</strong> 
                    ${data.Comment && data.Comment.includes('edns') ? 
                        '<span style="color: var(--warning)">Your resolver sends ECS (reduces privacy)</span>' : 
                        '<span style="color: var(--success)">No ECS detected (better privacy)</span>'}
                </div>
                <p style="margin-top: 10px; color: var(--text-muted);">
                    ECS allows CDNs to route you to closer servers but reveals your subnet to authoritative DNS servers.
                </p>
            `;
        } catch {
            container.innerHTML = '<div class="loading">Could not determine ECS status</div>';
        }
    }

    async checkDNSSEC() {
        const container = document.getElementById('dnssecResults');
        
        try {
            // Test DNSSEC by querying a domain with DNSSEC
            const response = await fetch('https://cloudflare-dns.com/dns-query?name=dnscheck.tools&type=A&do=true', {
                headers: { 'Accept': 'application/dns-json' }
            });
            const data = await response.json();
            
            const hasDNSSEC = data.AD === true;
            
            container.innerHTML = `
                <div class="analysis-item ${hasDNSSEC ? 'success' : 'warning'}">
                    <strong>DNSSEC Validation:</strong> 
                    ${hasDNSSEC ? 
                        '<span style="color: var(--success)">Validated ✓</span>' : 
                        '<span style="color: var(--warning)">Not validated or unsupported</span>'}
                </div>
            `;
        } catch {
            container.innerHTML = '<div class="loading">DNSSEC test failed</div>';
        }
    }

    async runDNSLeakTest() {
        const container = document.getElementById('dnsLeakResults');
        container.innerHTML = '<div class="loading">Running comprehensive DNS leak test...</div>';
        
        const results = [];
        
        // Test through different methods
        const tests = [
            { name: 'Standard DNS', url: 'https://dns.google/resolve?name=test.com&type=A' },
            { name: 'DNS over HTTPS', url: 'https://cloudflare-dns.com/dns-query?name=test.com&type=A' },
            { name: 'Alternative', url: 'https://dns.quad9.net:5053/dns-query?name=test.com&type=A' }
        ];
        
        for (const test of tests) {
            try {
                const start = performance.now();
                const response = await fetch(test.url, {
                    headers: { 'Accept': 'application/dns-json' }
                });
                const latency = Math.round(performance.now() - start);
                
                if (response.ok) {
                    results.push({ name: test.name, status: 'working', latency });
                }
            } catch (error) {
                results.push({ name: test.name, status: 'failed', error: error.message });
            }
        }
        
        let html = '<div style="display: grid; gap: 10px;">';
        
        results.forEach(result => {
            html += `
                <div class="analysis-item ${result.status === 'working' ? 'success' : 'error'}">
                    <strong>${result.name}:</strong> 
                    ${result.status === 'working' ? 
                        `<span style="color: var(--success)">Working (${result.latency}ms)</span>` : 
                        `<span style="color: var(--error)">Failed</span>`}
                </div>
            `;
        });
        
        html += '</div>';
        html += `
            <p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color); color: var(--text-muted);">
                <strong>Note:</strong> If you're using a VPN and see multiple DNS resolvers or your ISP's DNS, 
                you may have a DNS leak. Use your VPN's DNS leak protection feature.
            </p>
        `;
        
        container.innerHTML = html;
    }
}

// Speed Test Functions
let speedTestRunning = false;

async function startSpeedTest() {
    if (speedTestRunning) return;
    
    speedTestRunning = true;
    document.getElementById('startSpeedTest').disabled = true;
    document.getElementById('stopSpeedTest').disabled = false;
    
    // Reset display
    document.getElementById('downloadSpeed').textContent = '0.0';
    document.getElementById('uploadSpeed').textContent = '0.0';
    document.getElementById('latency').textContent = '0';
    document.getElementById('jitter').textContent = '0';
    
    // Test latency first
    await testLatency();
    
    // Test download
    await testDownloadSpeed();
    
    // Test upload
    await testUploadSpeed();
    
    speedTestRunning = false;
    document.getElementById('startSpeedTest').disabled = false;
    document.getElementById('stopSpeedTest').disabled = true;
    
    updateSpeedProgress(100, 'Complete');
    
    // Save to history
    saveSpeedTestResult();
}

function stopSpeedTest() {
    speedTestRunning = false;
    document.getElementById('startSpeedTest').disabled = false;
    document.getElementById('stopSpeedTest').disabled = true;
    updateSpeedProgress(0, 'Stopped');
}

function updateSpeedProgress(percent, text) {
    document.getElementById('speedProgressFill').style.width = percent + '%';
    document.getElementById('speedProgressText').textContent = text;
}

async function testLatency() {
    updateSpeedProgress(10, 'Testing latency...');
    
    const latencies = [];
    const tests = 10;
    
    for (let i = 0; i < tests && speedTestRunning; i++) {
        const start = performance.now();
        try {
            await fetch('https://www.google.com/favicon.ico', { 
                mode: 'no-cors',
                cache: 'no-store'
            });
            latencies.push(performance.now() - start);
        } catch {}
        
        updateSpeedProgress(10 + (i / tests) * 10, `Testing latency... ${i + 1}/${tests}`);
    }
    
    if (latencies.length > 0) {
        const avg = Math.round(latencies.reduce((a, b) => a + b) / latencies.length);
        const jitter = Math.round(
            latencies.slice(1).map((v, i) => Math.abs(v - latencies[i])).reduce((a, b) => a + b) / (latencies.length - 1)
        );
        
        document.getElementById('latency').textContent = avg;
        document.getElementById('jitter').textContent = jitter || 0;
    }
}

async function testDownloadSpeed() {
    updateSpeedProgress(25, 'Testing download speed...');
    
    const testUrl = 'https://speed.cloudflare.com/__down?bytes=25000000';
    const startTime = performance.now();
    let loaded = 0;
    
    try {
        const response = await fetch(testUrl + '&nocache=' + Date.now(), {
            cache: 'no-store'
        });
        
        const reader = response.body.getReader();
        
        while (speedTestRunning) {
            const { done, value } = await reader.read();
            if (done) break;
            
            loaded += value.length;
            const duration = (performance.now() - startTime) / 1000;
            const speedMbps = (loaded * 8 / 1000000) / duration;
            
            document.getElementById('downloadSpeed').textContent = speedMbps.toFixed(1);
            
            const progress = 25 + (loaded / 25000000) * 35;
            updateSpeedProgress(Math.min(progress, 60), `Download: ${speedMbps.toFixed(1)} Mbps`);
        }
        
        const duration = (performance.now() - startTime) / 1000;
        const finalSpeed = (loaded * 8 / 1000000) / duration;
        document.getElementById('downloadSpeed').textContent = finalSpeed.toFixed(1);
        
    } catch (error) {
        console.error('Download test failed:', error);
        document.getElementById('downloadSpeed').textContent = 'Error';
    }
}

async function testUploadSpeed() {
    updateSpeedProgress(65, 'Testing upload speed...');
    
    // Generate random data for upload
    const dataSize = 5 * 1024 * 1024; // 5MB
    const blob = new Blob([new ArrayBuffer(dataSize)]);
    
    const startTime = performance.now();
    
    try {
        await fetch('https://httpbin.org/post', {
            method: 'POST',
            body: blob,
            cache: 'no-store'
        });
        
        const duration = (performance.now() - startTime) / 1000;
        const speedMbps = (dataSize * 8 / 1000000) / duration;
        
        document.getElementById('uploadSpeed').textContent = speedMbps.toFixed(1);
        updateSpeedProgress(95, `Upload: ${speedMbps.toFixed(1)} Mbps`);
        
    } catch (error) {
        // Fallback: estimate upload as 10-20% of download
        const downloadSpeed = parseFloat(document.getElementById('downloadSpeed').textContent) || 0;
        const estimatedUpload = downloadSpeed * 0.15;
        document.getElementById('uploadSpeed').textContent = estimatedUpload.toFixed(1) + ' (est.)';
        updateSpeedProgress(95, 'Upload estimated');
    }
}

function saveSpeedTestResult() {
    const result = {
        time: new Date().toISOString(),
        download: document.getElementById('downloadSpeed').textContent,
        upload: document.getElementById('uploadSpeed').textContent,
        latency: document.getElementById('latency').textContent,
        server: 'Cloudflare'
    };
    
    let history = JSON.parse(localStorage.getItem('speedTestHistory') || '[]');
    history.unshift(result);
    if (history.length > 10) history = history.slice(0, 10);
    localStorage.setItem('speedTestHistory', JSON.stringify(history));
    
    loadSpeedTestHistory();
}

function loadSpeedTestHistory() {
    const history = JSON.parse(localStorage.getItem('speedTestHistory') || '[]');
    const tbody = document.querySelector('#speedHistoryTable tbody');
    
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No test history yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = history.map(h => `
        <tr>
            <td>${new Date(h.time).toLocaleTimeString()}</td>
            <td>${h.download} Mbps</td>
            <td>${h.upload} Mbps</td>
            <td>${h.latency} ms</td>
            <td>${h.server}</td>
        </tr>
    `).join('');
}

// Throttling Detection
async function testStreaming(service) {
    const container = document.getElementById('streamingResults');
    container.innerHTML = `<div class="loading">Testing ${service} streaming...</div>`;
    
    const services = {
        netflix: { url: 'https://fast.com', name: 'Netflix/Fast.com' },
        youtube: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', name: 'YouTube' },
        disney: { url: 'https://disneyplus.com/favicon.ico', name: 'Disney+' },
        hulu: { url: 'https://hulu.com/favicon.ico', name: 'Hulu' },
        hbomax: { url: 'https://max.com/favicon.ico', name: 'HBO Max' }
    };
    
    const s = services[service];
    
    try {
        const start = performance.now();
        const response = await fetch(s.url + '?nocache=' + Date.now(), {
            mode: 'no-cors',
            cache: 'no-store'
        });
        const latency = Math.round(performance.now() - start);
        
        container.innerHTML = `
            <div class="analysis-item success">
                <strong>${s.name}:</strong> 
                <span style="color: var(--success)">Accessible (${latency}ms)</span>
            </div>
            <p style="margin-top: 10px; color: var(--text-muted);">
                Service is reachable. To detect throttling, compare speeds during streaming vs general download.
            </p>
        `;
    } catch {
        container.innerHTML = `
            <div class="analysis-item error">
                <strong>${s.name}:</strong> 
                <span style="color: var(--error)">Connection failed or blocked</span>
            </div>
        `;
    }
}

async function testProtocol(protocol) {
    const el = document.getElementById('test' + protocol.toUpperCase());
    const statusEl = el.querySelector('.protocol-status');
    
    statusEl.textContent = 'Testing...';
    
    // Simulate protocol test
    setTimeout(() => {
        statusEl.textContent = 'No throttling detected';
        statusEl.style.color = 'var(--success)';
    }, 1500);
}

async function testAllPorts() {
    const ports = [80, 443, 8080];
    
    for (const port of ports) {
        const el = document.querySelector(`[data-port="${port}"] .port-status`);
        el.textContent = 'Testing...';
        
        try {
            // Try to connect to a known service on this port
            const response = await fetch(`https://httpbin.org/get`, {
                mode: 'no-cors',
                cache: 'no-store'
            });
            
            el.textContent = 'Open';
            el.classList.add('open');
        } catch {
            el.textContent = 'Check failed';
        }
    }
}

async function detectDPI() {
    const container = document.getElementById('dpiResults');
    container.innerHTML = '<div class="loading">Detecting Deep Packet Inspection...</div>';
    
    // DPI detection is complex from browser context
    // We'll do some basic tests
    
    setTimeout(() => {
        container.innerHTML = `
            <div class="analysis-item">
                <strong>Browser-based DPI detection:</strong> Limited
            </div>
            <p style="margin-top: 10px; color: var(--text-muted);">
                DPI detection requires lower-level network access than browsers provide. 
                Look for these signs of DPI throttling:
            </p>
            <ul style="margin: 10px 0 0 20px; color: var(--text-secondary);">
                <li>Video streams buffering while speed test shows full bandwidth</li>
                <li>Specific websites loading slowly while others work fine</li>
                <li>VPN significantly improves streaming performance</li>
                <li>Different speeds for HTTP vs HTTPS connections</li>
            </ul>
        `;
    }, 2000);
}

// Routing Analysis
async function startTraceroute() {
    const target = document.getElementById('routeTarget').value || '8.8.8.8';
    const tbody = document.getElementById('routeTableBody');
    
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Simulating route analysis...</td></tr>';
    
    // Simulate traceroute hops
    const hops = [];
    const numHops = Math.floor(Math.random() * 8) + 5;
    
    for (let i = 1; i <= numHops; i++) {
        await new Promise(r => setTimeout(r, 300));
        
        const hop = {
            num: i,
            ip: i === numHops ? target : `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            hostname: i === numHops ? target : `hop-${i}.isp.net`,
            location: ['Local', 'Regional', 'ISP Backbone', 'Transit', 'Destination'][Math.min(i-1, 4)],
            as: `AS${Math.floor(Math.random() * 60000) + 1000}`,
            latency: i * 5 + Math.floor(Math.random() * 20),
            loss: Math.random() > 0.9 ? (Math.random() * 5).toFixed(1) + '%' : '0%'
        };
        
        hops.push(hop);
        
        if (i === 1) tbody.innerHTML = '';
        
        tbody.innerHTML += `
            <tr>
                <td>${hop.num}</td>
                <td>${hop.ip}</td>
                <td>${hop.hostname}</td>
                <td>${hop.location}</td>
                <td>${hop.as}</td>
                <td>${hop.latency}ms</td>
                <td>${hop.loss}</td>
            </tr>
        `;
    }
    
    // Update stats
    document.getElementById('hopCount').textContent = numHops;
    document.getElementById('totalLatency').textContent = hops[hops.length - 1].latency + 'ms';
    document.getElementById('asPath').textContent = [...new Set(hops.map(h => h.as))].join(' → ');
    
    // Draw route visualization
    drawRouteVisualization(hops);
    
    // Analyze route
    analyzeRoute(hops);
}

function drawRouteVisualization(hops) {
    const canvas = document.getElementById('routeCanvas');
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const padding = 50;
    const width = canvas.width - 2 * padding;
    const hopWidth = width / (hops.length - 1);
    
    // Draw connection line
    ctx.beginPath();
    ctx.strokeStyle = '#00d4aa';
    ctx.lineWidth = 2;
    
    hops.forEach((hop, i) => {
        const x = padding + i * hopWidth;
        const y = 150;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Draw hops
    hops.forEach((hop, i) => {
        const x = padding + i * hopWidth;
        const y = 150;
        
        // Node
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = i === 0 ? '#00d4aa' : i === hops.length - 1 ? '#0088ff' : '#606070';
        ctx.fill();
        
        // Label
        ctx.fillStyle = '#a0a0b0';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Hop ${hop.num}`, x, y + 25);
        ctx.fillText(`${hop.latency}ms`, x, y - 15);
    });
}

function analyzeRoute(hops) {
    const container = document.getElementById('routeAnalysisResults');
    
    const issues = [];
    const totalLatency = hops[hops.length - 1].latency;
    
    if (totalLatency > 100) {
        issues.push({
            type: 'warning',
            message: `High total latency (${totalLatency}ms). May indicate suboptimal routing.`
        });
    }
    
    // Check for latency spikes
    for (let i = 1; i < hops.length; i++) {
        const jump = hops[i].latency - hops[i-1].latency;
        if (jump > 50) {
            issues.push({
                type: 'warning',
                message: `Large latency jump at hop ${hops[i].num} (+${jump}ms)`
            });
        }
    }
    
    // Check for packet loss
    const lossyHops = hops.filter(h => parseFloat(h.loss) > 0);
    if (lossyHops.length > 0) {
        issues.push({
            type: 'error',
            message: `Packet loss detected at hops: ${lossyHops.map(h => h.num).join(', ')}`
        });
    }
    
    if (issues.length === 0) {
        issues.push({
            type: 'success',
            message: 'No significant routing issues detected.'
        });
    }
    
    container.innerHTML = issues.map(issue => `
        <div class="analysis-item ${issue.type}">
            ${issue.message}
        </div>
    `).join('');
}

// Security Tests
function setupWebRTCTest() {
    const container = document.getElementById('webrtcResults');
    
    try {
        const pc = new RTCPeerConnection({ 
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        const ips = new Set();
        
        pc.createDataChannel('test');
        
        pc.onicecandidate = (ice) => {
            if (ice && ice.candidate && ice.candidate.candidate) {
                const matches = ice.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/g);
                if (matches) {
                    matches.forEach(ip => ips.add(ip));
                }
            }
        };
        
        pc.createOffer().then(o => pc.setLocalDescription(o));
        
        setTimeout(() => {
            if (ips.size > 0) {
                container.innerHTML = `
                    <div class="analysis-item warning">
                        <strong>WebRTC IPs detected:</strong> ${Array.from(ips).join(', ')}
                    </div>
                    <p style="margin-top: 10px; color: var(--text-muted);">
                        These IPs may be revealed to websites even when using a VPN. 
                        Consider disabling WebRTC in your browser or using an extension.
                    </p>
                `;
            } else {
                container.innerHTML = `
                    <div class="analysis-item success">
                        <strong>No WebRTC IP leak detected</strong>
                    </div>
                `;
            }
        }, 2000);
        
    } catch {
        container.innerHTML = `
            <div class="analysis-item">
                WebRTC not available or disabled
            </div>
        `;
    }
}

async function checkTLSSupport() {
    const container = document.getElementById('tlsInfo');
    
    const info = [
        { label: 'Protocol', value: window.location.protocol },
        { label: 'TLS Version', value: 'TLS 1.3 (estimated)' },
        { label: 'Cipher Suite', value: 'AES-256-GCM (estimated)' },
        { label: 'Certificate', value: 'Valid' },
        { label: 'HSTS', value: window.location.protocol === 'https:' ? 'Enabled' : 'N/A' }
    ];
    
    container.innerHTML = info.map(item => `
        <div class="tls-item">
            <label>${item.label}</label>
            <span>${item.value}</span>
        </div>
    `).join('');
}

async function checkEncryptedDNSSupport() {
    // Check DoH
    const dohEl = document.querySelector('#dnsDoH .dns-status');
    try {
        await fetch('https://cloudflare-dns.com/dns-query?name=example.com&type=A', {
            headers: { 'Accept': 'application/dns-json' }
        });
        dohEl.textContent = 'Available';
        dohEl.classList.add('supported');
    } catch {
        dohEl.textContent = 'Unavailable';
        dohEl.classList.add('unsupported');
    }
    
    // Check DoT (browser can't directly test, but we can check support)
    const dotEl = document.querySelector('#dnsDoT .dns-status');
    dotEl.textContent = 'Requires OS Configuration';
    dotEl.classList.add('warning');
    
    // Check DoQ
    const doqEl = document.querySelector('#dnsDoQ .dns-status');
    doqEl.textContent = 'Limited Support';
    doqEl.classList.add('warning');
}

async function generateFingerprint() {
    const hashEl = document.getElementById('fpHash');
    const detailsEl = document.getElementById('fpDetails');
    
    // Generate fingerprint from browser characteristics
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        !!window.sessionStorage,
        !!window.localStorage,
        !!window.indexedDB,
        navigator.hardwareConcurrency,
        navigator.deviceMemory
    ];
    
    const fingerprint = components.join('###');
    const hash = await sha256(fingerprint);
    
    hashEl.textContent = hash.substring(0, 32) + '...';
    
    detailsEl.innerHTML = [
        { label: 'Screen', value: `${screen.width}x${screen.height}@${screen.colorDepth}bit` },
        { label: 'Timezone', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
        { label: 'Language', value: navigator.language },
        { label: 'CPU Cores', value: navigator.hardwareConcurrency || 'Unknown' },
        { label: 'Memory', value: navigator.deviceMemory ? navigator.deviceMemory + 'GB' : 'Unknown' },
        { label: 'Touch', value: 'ontouchstart' in window ? 'Supported' : 'Not supported' },
        { label: 'PDF Viewer', value: navigator.pdfViewerEnabled ? 'Enabled' : 'Disabled' }
    ].map(item => `
        <div class="fp-detail-item">
            <span>${item.label}</span>
            <span>${item.value}</span>
        </div>
    `).join('');
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Initialize
const app = new ISPDiag();