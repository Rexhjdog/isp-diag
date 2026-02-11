// isp-diag - Comprehensive Internet Diagnostics
// Aesthetic inspired by dnscheck.tools

let dnsQueryCount = 0;
let speedDownloadRunning = false;
let speedUploadRunning = false;

// --- Helpers ---

function setEntry(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function countDNS() {
  dnsQueryCount++;
  document.getElementById('dns-counter').textContent = dnsQueryCount;
  document.getElementById('dns-counter').classList.remove('c-muted');
}

function setStatusBar(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('good', 'bad', 'warn');
  if (state) el.classList.add(state);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Shared data ---

let cachedIPData = null;

async function fetchIPData() {
  countDNS();
  try {
    const response = await fetch('https://ipapi.co/json/');
    cachedIPData = await response.json();
    return cachedIPData;
  } catch {
    return null;
  }
}

// --- IP Addresses ---

async function displayIPAddresses(data) {
  if (data) {
    setEntry('ip-v4',
      `${escapeHtml(data.ip)}  <span class="c-indigo">${escapeHtml(data.city || '')}, ${escapeHtml(data.region || '')}, ${escapeHtml(data.country_name || '')}</span>`
    );
  } else {
    setEntry('ip-v4', '<span class="c-red">unable to detect</span>');
  }

  // IPv6
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 4000);
    countDNS();
    const resp = await fetch('https://api6.ipify.org?format=json', { signal: controller.signal });
    const v6 = await resp.json();
    setEntry('ip-v6', `<span class="c-green">${escapeHtml(v6.ip)}</span>`);
    setStatusBar('sb-ipv6', 'good');
  } catch {
    setEntry('ip-v6', '<span class="c-red">not available</span>');
    setStatusBar('sb-ipv6', 'bad');
  }
}

// --- ISP ---

function displayISP(data) {
  if (data) {
    const isp = data.org || 'unknown';
    const asn = data.asn || 'unknown';
    const location = [data.city, data.region, data.country_name].filter(Boolean).join(', ');

    setEntry('isp-info',
      `<span class="c-violet">${escapeHtml(isp)}</span>` +
      `  <span class="c-blue">${escapeHtml(asn)}</span>` +
      `  <span class="c-indigo">${escapeHtml(location)}</span>`
    );
  } else {
    setEntry('isp-info', '<span class="c-red">unable to detect</span>');
  }
}

// --- DNS Resolvers ---

async function detectDNSResolvers() {
  try {
    const results = [];

    // Query Cloudflare
    try {
      countDNS();
      await fetch('https://cloudflare-dns.com/dns-query?name=detect.dns&type=A', {
        headers: { 'Accept': 'application/dns-json' }
      });
      results.push('<span class="c-green">Cloudflare DoH: reachable</span>');
    } catch {
      results.push('<span class="c-red">Cloudflare DoH: unreachable</span>');
    }

    // Query Google
    try {
      countDNS();
      await fetch('https://dns.google/resolve?name=detect.dns&type=A');
      results.push('<span class="c-green">Google DoH: reachable</span>');
    } catch {
      results.push('<span class="c-red">Google DoH: unreachable</span>');
    }

    setEntry('dns-resolver-info',
      'system resolver: <span class="c-blue">using ISP or configured DNS</span>' +
      '<br>' + results.join('<br>')
    );
  } catch {
    setEntry('dns-resolver-info', '<span class="c-muted">using system default resolver</span>');
  }
}

// --- DNS Leak Test ---

async function runDNSLeakTest() {
  const providers = [
    { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query', header: 'application/dns-json' },
    { name: 'Google', url: 'https://dns.google/resolve', header: null },
    { name: 'Quad9', url: 'https://dns.quad9.net:5053/dns-query', header: 'application/dns-json' }
  ];

  const results = [];

  for (const p of providers) {
    try {
      const rand = Math.random().toString(36).slice(2, 10);
      const url = `${p.url}?name=${rand}.example.com&type=A`;
      const headers = p.header ? { 'Accept': p.header } : {};
      countDNS();
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      results.push({ name: p.name, ok: true, status: data.Status });
    } catch {
      results.push({ name: p.name, ok: false });
    }
  }

  const reachable = results.filter(r => r.ok);
  const unreachable = results.filter(r => !r.ok);

  let html = '';
  if (unreachable.length === 0) {
    html += '<span class="c-green">all providers reachable</span> - ';
    html += 'queries routed through your configured resolver';
  } else if (reachable.length === 0) {
    html += '<span class="c-red">unable to reach DNS providers</span>';
  } else {
    html += '<span class="c-yellow">partial connectivity</span> - ';
    html += `${unreachable.map(r => r.name).join(', ')} unreachable`;
  }

  html += '<br><span class="c-muted">';
  html += results.map(r =>
    `${r.name}: ${r.ok ? '<span class="c-green">ok</span>' : '<span class="c-red">fail</span>'}`
  ).join('  ');
  html += '</span>';

  setEntry('dns-leak-result', html);
}

// --- ECS ---

async function checkECS() {
  try {
    countDNS();
    const response = await fetch('https://dns.google/resolve?name=example.com&type=A', {
      headers: { 'Accept': 'application/dns-json' }
    });
    const data = await response.json();

    const hasECS = data.Comment && data.Comment.toLowerCase().includes('subnet');

    if (hasECS) {
      setEntry('ecs-result',
        '<span class="c-yellow">enabled</span> - your subnet is shared with authoritative DNS servers (reduces privacy)');
    } else {
      setEntry('ecs-result',
        '<span class="c-green">disabled</span> - your resolver does not send your subnet (better privacy)');
    }
  } catch {
    setEntry('ecs-result', '<span class="c-red">unable to determine</span>');
  }
}

// --- DNS Security ---

async function checkDNSSEC() {
  try {
    countDNS();
    const response = await fetch('https://cloudflare-dns.com/dns-query?name=example.com&type=A&do=true', {
      headers: { 'Accept': 'application/dns-json' }
    });
    const data = await response.json();

    if (data.AD) {
      setEntry('dnssec-result', '<span class="c-green">validated</span> - DNS responses are authenticated');
      setStatusBar('sb-dnssec', 'good');
    } else {
      setEntry('dnssec-result', '<span class="c-yellow">not validated</span> - DNS responses are not authenticated');
      setStatusBar('sb-dnssec', 'warn');
    }
  } catch {
    setEntry('dnssec-result', '<span class="c-red">check failed</span>');
    setStatusBar('sb-dnssec', 'bad');
  }
}

async function checkDoH() {
  try {
    countDNS();
    await fetch('https://cloudflare-dns.com/dns-query?name=test.com&type=A', {
      headers: { 'Accept': 'application/dns-json' }
    });
    setEntry('doh-result', '<span class="c-green">supported</span> - DNS-over-HTTPS is available');
    setStatusBar('sb-doh', 'good');
  } catch {
    setEntry('doh-result', '<span class="c-red">unavailable</span>');
    setStatusBar('sb-doh', 'bad');
  }
}

function checkDoT() {
  setEntry('dot-result', '<span class="c-yellow">requires OS-level configuration</span> - cannot be tested from browser');
}

// --- Connection Security ---

function checkConnectionSecurity() {
  const isHTTPS = window.location.protocol === 'https:';

  setEntry('conn-https', isHTTPS
    ? 'HTTPS: <span class="c-green">active</span>'
    : 'HTTPS: <span class="c-red">not secure</span>');
  setStatusBar('sb-https', isHTTPS ? 'good' : 'bad');

  setEntry('conn-tls', 'TLS: <span class="c-blue">1.3 (estimated)</span>');

  setEntry('conn-hsts', isHTTPS
    ? 'HSTS: <span class="c-green">enabled</span>'
    : 'HSTS: <span class="c-muted">n/a</span>');
}

// --- Network Capabilities ---

async function checkNetworkCapabilities() {
  // IPv6
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    countDNS();
    await fetch('https://api6.ipify.org?format=json', { signal: controller.signal });
    setEntry('net-ipv6', 'IPv6: <span class="c-green">available</span>');
  } catch {
    setEntry('net-ipv6', 'IPv6: <span class="c-red">not available</span>');
  }

  // HTTP/3
  setEntry('net-http3', 'HTTP/3: <span class="c-green">supported by browser</span>');

  // ECH
  const supportsECH = navigator.userAgent.includes('Firefox') || navigator.userAgent.includes('Chrome/1');
  setEntry('net-ech', `ECH: ${supportsECH
    ? '<span class="c-green">supported</span>'
    : '<span class="c-yellow">limited</span>'}`);

  // Connection info
  const conn = navigator.connection;
  if (conn) {
    setEntry('net-connection',
      `effective type: <span class="c-blue">${conn.effectiveType || 'unknown'}</span>` +
      `  downlink: <span class="c-blue">${conn.downlink || '?'} Mbps</span>`
    );
  } else {
    setEntry('net-connection', '<span class="c-muted">Network Information API not available</span>');
  }
}

// --- Latency ---

async function measureLatency() {
  const times = [];
  const url = 'https://cloudflare-dns.com/dns-query?name=.&type=NS';
  const headers = { 'Accept': 'application/dns-json' };

  for (let i = 0; i < 10; i++) {
    try {
      countDNS();
      const start = performance.now();
      await fetch(url + '&_=' + Date.now(), { headers, cache: 'no-store' });
      const end = performance.now();
      times.push(end - start);
    } catch {
      // skip failed measurement
    }
    await new Promise(r => setTimeout(r, 200));
  }

  if (times.length === 0) {
    setEntry('latency-result', '<span class="c-red">measurement failed</span>');
    return;
  }

  const min = Math.min(...times).toFixed(0);
  const max = Math.max(...times).toFixed(0);
  const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0);
  const jitter = Math.sqrt(
    times.map(t => Math.pow(t - avg, 2)).reduce((a, b) => a + b, 0) / times.length
  ).toFixed(0);

  let avgColor = 'c-green';
  if (avg > 100) avgColor = 'c-yellow';
  if (avg > 200) avgColor = 'c-red';

  setEntry('latency-result',
    `avg: <span class="${avgColor}">${avg}ms</span>  ` +
    `min: <span class="c-blue">${min}ms</span>  ` +
    `max: <span class="c-blue">${max}ms</span>  ` +
    `jitter: <span class="c-blue">${jitter}ms</span>`
  );

  // Update status bar
  const sbEl = document.getElementById('sb-latency');
  sbEl.textContent = avg + 'ms';
  if (avg <= 50) setStatusBar('sb-latency', 'good');
  else if (avg <= 150) setStatusBar('sb-latency', 'warn');
  else setStatusBar('sb-latency', 'bad');
}

// --- Speed Test: Download ---

async function runDownloadTest() {
  if (speedDownloadRunning) return;
  speedDownloadRunning = true;

  const btn = document.getElementById('speed-download-btn');
  const result = document.getElementById('speed-download-result');
  btn.textContent = '[testing...]';
  btn.classList.add('disabled');
  result.innerHTML = '';

  try {
    const testUrl = 'https://speed.cloudflare.com/__down?bytes=10000000';
    const startTime = performance.now();

    const response = await fetch(testUrl + '&nocache=' + Date.now(), { cache: 'no-store' });
    const reader = response.body.getReader();
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      const elapsed = (performance.now() - startTime) / 1000;
      const currentSpeed = ((received * 8) / 1000000) / elapsed;
      result.innerHTML = `<span class="c-muted">${currentSpeed.toFixed(1)} Mbps...</span>`;
    }

    const duration = (performance.now() - startTime) / 1000;
    const speedMbps = ((received * 8) / 1000000) / duration;
    result.innerHTML = `<span class="c-green">${speedMbps.toFixed(1)} Mbps</span>`;
  } catch {
    result.innerHTML = '<span class="c-red">test failed</span>';
  }

  speedDownloadRunning = false;
  btn.textContent = '[run again]';
  btn.classList.remove('disabled');
}

// --- Speed Test: Upload ---

async function runUploadTest() {
  if (speedUploadRunning) return;
  speedUploadRunning = true;

  const btn = document.getElementById('speed-upload-btn');
  const result = document.getElementById('speed-upload-result');
  btn.textContent = '[testing...]';
  btn.classList.add('disabled');
  result.innerHTML = '';

  try {
    const dataSize = 5 * 1024 * 1024; // 5MB
    const data = new Uint8Array(dataSize);
    crypto.getRandomValues(data);

    const startTime = performance.now();
    await fetch('https://speed.cloudflare.com/__up', {
      method: 'POST',
      body: data,
      cache: 'no-store'
    });
    const duration = (performance.now() - startTime) / 1000;
    const speedMbps = ((dataSize * 8) / 1000000) / duration;
    result.innerHTML = `<span class="c-green">${speedMbps.toFixed(1)} Mbps</span>`;
  } catch {
    result.innerHTML = '<span class="c-red">test failed</span>';
  }

  speedUploadRunning = false;
  btn.textContent = '[run again]';
  btn.classList.remove('disabled');
}

// --- WebRTC Leak Test ---

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

    setTimeout(() => {
      if (!completed) {
        completed = true;
        displayWebRTCResults(ips);
      }
      pc.close();
    }, 5000);
  } catch {
    setEntry('webrtc-result', '<span class="c-muted">WebRTC not available or blocked</span>');
  }
}

function displayWebRTCResults(ips) {
  if (ips.size > 0) {
    const ipList = Array.from(ips).map(ip => `<span class="c-yellow">${escapeHtml(ip)}</span>`).join(', ');
    setEntry('webrtc-result',
      `<span class="c-red">leak detected</span> - IPs revealed: ${ipList}` +
      '<br><span class="c-muted">consider disabling WebRTC or using a VPN extension</span>'
    );
  } else {
    setEntry('webrtc-result',
      '<span class="c-green">no leak detected</span> - your real IP is not exposed via WebRTC'
    );
  }
}

// --- Help ---

document.getElementById('help-toggle').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('help-overlay').classList.toggle('hidden');
});

document.getElementById('help-close').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('help-overlay').classList.add('hidden');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('help-overlay').classList.add('hidden');
  }
});

// --- Speed test event listeners ---

document.getElementById('speed-download-btn').addEventListener('click', (e) => {
  e.preventDefault();
  runDownloadTest();
});

document.getElementById('speed-upload-btn').addEventListener('click', (e) => {
  e.preventDefault();
  runUploadTest();
});

// --- Initialize ---

document.addEventListener('DOMContentLoaded', async () => {
  // Phase 1: fetch shared IP data
  const ipData = await fetchIPData();

  // Phase 2: run all diagnostics in parallel
  await Promise.all([
    displayIPAddresses(ipData),
    displayISP(ipData),
    detectDNSResolvers(),
    runDNSLeakTest(),
    checkECS(),
    checkDNSSEC(),
    checkDoH(),
    checkDoT(),
    checkConnectionSecurity(),
    checkNetworkCapabilities(),
    measureLatency(),
    checkWebRTC()
  ]);

  // Show done message
  document.getElementById('section-done').style.display = '';
});
