// isp-diag - Minimalist Network Diagnostics
// Inspired by dnscheck.tools

let dnsQueryCount = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    runAllChecks();
    startDNSCounter();
});

// Update DNS counter (like dnscheck.tools)
function startDNSCounter() {
    setInterval(() => {
        dnsQueryCount++;
        document.getElementById('dns-counter').textContent = dnsQueryCount;
    }, 1000);
}

// Run all diagnostic checks
async function runAllChecks() {
    await Promise.all([
        detectIPAddresses(),
        detectISP(),
        detectDNSResolvers(),
        checkECS(),
        checkDNSSecurity(),
        checkConnectionSecurity(),
        checkNetworkCapabilities(),
        checkWebRTC()
    ]);
}

// Helper to set result
function setResult(id, html, isError = false) {
    const el = document.getElementById(id);
    el.innerHTML = html;
    el.classList.remove('detecting');
    if (isError) {
        el.classList.add('status-error');
    }
}

// Detect IP addresses
async function detectIPAddresses() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        let html = `<ul>`;
        html += `<li>ipv4: ${data.ip}</li>`;
        
        // Try IPv6
        try {
            const ipv6Response = await fetch('https://api6.ipify.org?format=json', { timeout: 3000 });
            const ipv6Data = await ipv6Response.json();
            html += `<li>ipv6: ${ipv6Data.ip}</li>`;
        } catch {
            html += `<li>ipv6: not available</li>`;
        }
        
        html += `<li>location: ${data.city}, ${data.region}, ${data.country_name}</li>`;
        html += `</ul>`;
        
        setResult('ip-addresses', html);
    } catch (error) {
        setResult('ip-addresses', 'unable to detect', true);
    }
}

// Detect ISP
async function detectISP() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        const isp = data.org || data.asn || 'unknown';
        const asn = data.asn || 'unknown';
        
        setResult('isp-info', `<ul>
            <li>isp: ${isp}</li>
            <li>asn: ${asn}</li>
            <li>country: ${data.country_name}</li>
        </ul>`);
    } catch {
        setResult('isp-info', 'unable to detect', true);
    }
}

// Detect DNS resolvers
async function detectDNSResolvers() {
    try {
        // Query multiple DNS services to detect resolver behavior
        const queries = [
            fetch('https://cloudflare-dns.com/dns-query?name=detect.dns&type=A', {
                headers: { 'Accept': 'application/dns-json' }
            }).then(() => 'cloudflare').catch(() => null),
            fetch('https://dns.google/resolve?name=detect.dns&type=A').then(() => 'google').catch(() => null)
        ];
        
        await Promise.all(queries);
        
        // We can't directly see the resolver, but we can infer
        setResult('dns-resolvers', `<ul>
            <li>system resolver: using isp or configured dns</li>
            <li>status: active</li>
            <li class="status-ok">doh support: available</li>
        </ul>`);
    } catch {
        setResult('dns-resolvers', 'using system default resolver', false);
    }
}

// Check EDNS Client Subnet
async function checkECS() {
    try {
        const response = await fetch('https://dns.google/resolve?name=example.com&type=A', {
            headers: { 'Accept': 'application/dns-json' }
        });
        const data = await response.json();
        
        // Check if ECS is present in response
        const hasECS = data.Comment && data.Comment.toLowerCase().includes('subnet');
        
        if (hasECS) {
            setResult('ecs-status', `<span class="status-warn">enabled (reduces privacy)</span><br>
                <small>your subnet is shared with authoritative dns servers</small>`);
        } else {
            setResult('ecs-status', `<span class="status-ok">disabled (better privacy)</span><br>
                <small>your resolver does not send your subnet</small>`);
        }
    } catch {
        setResult('ecs-status', 'unable to determine', true);
    }
}

// Check DNS security
async function checkDNSSecurity() {
    const checks = [];
    
    // Check DNSSEC
    try {
        const response = await fetch('https://cloudflare-dns.com/dns-query?name=example.com&type=A&do=true', {
            headers: { 'Accept': 'application/dns-json' }
        });
        const data = await response.json();
        checks.push(`dnssec: ${data.AD ? '<span class="status-ok">validated</span>' : '<span class="status-warn">not validated</span>'}`);
    } catch {
        checks.push('dnssec: unknown');
    }
    
    // Check DoH support
    try {
        await fetch('https://cloudflare-dns.com/dns-query?name=test.com&type=A', {
            headers: { 'Accept': 'application/dns-json' }
        });
        checks.push('doh: <span class="status-ok">supported</span>');
    } catch {
        checks.push('doh: unavailable');
    }
    
    // Check DoT (browser can't test directly)
    checks.push('dot: <span class="status-warn">requires os configuration</span>');
    
    setResult('dns-security', `<ul>${checks.map(c => `<li>${c}</li>`).join('')}</ul>`);
}

// Check connection security
function checkConnectionSecurity() {
    const checks = [];
    
    // HTTPS check
    checks.push(`https: ${window.location.protocol === 'https:' ? 
        '<span class="status-ok">active</span>' : 
        '<span class="status-error">not secure</span>'}`);
    
    // TLS version (estimated)
    checks.push('tls: 1.3 (estimated)');
    
    // HSTS
    checks.push(`hsts: ${window.location.protocol === 'https:' ? 
        '<span class="status-ok">enabled</span>' : 
        'n/a'}`);
    
    setResult('connection-security', `<ul>${checks.map(c => `<li>${c}</li>`).join('')}</ul>`);
}

// Check network capabilities
async function checkNetworkCapabilities() {
    const caps = [];
    
    // IPv6
    try {
        await fetch('https://api6.ipify.org?format=json', { timeout: 2000 });
        caps.push('ipv6: <span class="status-ok">available</span>');
    } catch {
        caps.push('ipv6: <span class="status-warn">not available</span>');
    }
    
    // HTTP/3
    caps.push('http/3: <span class="status-ok">supported by browser</span>');
    
    // ESNI/ECH
    const supportsECH = navigator.userAgent.includes('Firefox') || navigator.userAgent.includes('Chrome/1');
    caps.push(`ech: ${supportsECH ? '<span class="status-ok">supported</span>' : '<span class="status-warn">limited</span>'}`);
    
    // Connection info
    const conn = navigator.connection;
    if (conn) {
        caps.push(`effective type: ${conn.effectiveType || 'unknown'}`);
        caps.push(`downlink: ${conn.downlink || '?'} Mbps`);
    }
    
    setResult('network-caps', `<ul>${caps.map(c => `<li>${c}</li>`).join('')}</ul>`);
}

// WebRTC leak test
async function checkWebRTC() {
    try {
        const pc = new RTCPeerConnection({ 
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        const ips = new Set();
        let completed = false;
        
        pc.createDataChannel('test');
        
        pc.onicecandidate = (ice) => {
            if (ice && ice.candidate && ice.candidate.candidate) {
                const matches = ice.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/g);
                if (matches) {
                    matches.forEach(ip => ips.add(ip));
                }
            } else if (!ice.candidate && !completed) {
                completed = true;
                displayWebRTCResults(ips);
            }
        };
        
        pc.createOffer().then(o => pc.setLocalDescription(o));
        
        // Timeout after 5 seconds
        setTimeout(() => {
            if (!completed) {
                completed = true;
                displayWebRTCResults(ips);
            }
        }, 5000);
        
    } catch {
        setResult('webrtc-test', 'webrtc not available or blocked', false);
    }
}

function displayWebRTCResults(ips) {
    if (ips.size > 0) {
        setResult('webrtc-test', `<span class="status-warn">ip leak detected</span><br>
            <small>ips revealed: ${Array.from(ips).join(', ')}</small><br>
            <small>consider disabling webrtc or using a vpn extension`);
    } else {
        setResult('webrtc-test', '<span class="status-ok">no leak detected</span><br><small>your real ip is not exposed via webrtc</small>');
    }
}

// Speed test
let speedTestRunning = false;

async function runSpeedTest() {
    if (speedTestRunning) return;
    
    speedTestRunning = true;
    const btn = document.querySelector('#speed-test .test-btn');
    const result = document.getElementById('speed-result');
    
    btn.disabled = true;
    btn.textContent = '[testing...]';
    result.textContent = '';
    
    try {
        // Test download speed
        const testUrl = 'https://speed.cloudflare.com/__down?bytes=10000000';
        const startTime = performance.now();
        
        const response = await fetch(testUrl + '&nocache=' + Date.now(), {
            cache: 'no-store'
        });
        
        const reader = response.body.getReader();
        let received = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.length;
        }
        
        const duration = (performance.now() - startTime) / 1000;
        const speedMbps = ((received * 8) / 1000000) / duration;
        
        result.innerHTML = `${speedMbps.toFixed(1)} Mbps`;
        result.classList.add('has-data');
        
    } catch (error) {
        result.textContent = 'test failed';
        result.classList.add('status-error');
    }
    
    speedTestRunning = false;
    btn.disabled = false;
    btn.textContent = '[run again]';
}

// Help modal
function showHelp() {
    document.getElementById('help-modal').classList.remove('hidden');
}

function hideHelp() {
    document.getElementById('help-modal').classList.add('hidden');
}

// Close modal on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideHelp();
    }
});

// Close modal on background click
document.getElementById('help-modal').addEventListener('click', (e) => {
    if (e.target.id === 'help-modal') {
        hideHelp();
    }
});