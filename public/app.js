// isp-diag v2.0 - Agent-powered diagnostics

let totalAgents = 0;
let completedAgents = 0;
let speedDownloadRunning = false;
let speedUploadRunning = false;

// --- Helpers ---

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateCounter() {
  document.getElementById('agent-counter').textContent =
    `${completedAgents}/${totalAgents}`;
}

// --- Agent UI ---

function createAgentSection(name, displayName) {
  const container = document.getElementById('agent-results');

  const section = document.createElement('section');
  section.id = `agent-${name}`;
  section.className = 'agent-section';

  section.innerHTML = `
    <div class="agent-header">
      <span class="agent-name">${escapeHtml(displayName)}</span>
      <span class="agent-status anim-pulse" id="status-${name}">waiting...</span>
    </div>
    <div class="agent-tools" id="tools-${name}"></div>
    <div class="agent-findings" id="findings-${name}"></div>
    <div class="agent-analysis" id="analysis-${name}" style="display:none"></div>
  `;

  container.appendChild(section);
}

function setAgentStatus(name, status, text) {
  const el = document.getElementById(`status-${name}`);
  if (!el) return;
  el.className = `agent-status ${status}`;
  el.classList.remove('anim-pulse');
  if (status === 'running') el.classList.add('anim-pulse');
  el.textContent = text;

  const section = document.getElementById(`agent-${name}`);
  if (section) {
    section.classList.remove('agent-running', 'agent-complete', 'agent-error');
    section.classList.add(`agent-${status === 'running' ? 'running' : status}`);
  }
}

function addToolActivity(name, toolName) {
  const el = document.getElementById(`tools-${name}`);
  if (!el) return;
  el.textContent = `running: ${toolName}`;
}

function displayFindings(name, findings) {
  const el = document.getElementById(`findings-${name}`);
  if (!el || !findings || !findings.length) return;

  el.innerHTML = findings
    .map((f) => {
      let html = `<div class="finding">`;
      html += `<span class="finding-label">${escapeHtml(f.label)}</span>`;
      html += `<span class="finding-value ${f.status || ''}">${escapeHtml(f.value)}</span>`;
      if (f.detail) {
        html += `<span class="finding-detail">${escapeHtml(f.detail)}</span>`;
      }
      html += `</div>`;
      return html;
    })
    .join('');
}

function displayAnalysis(name, analysis) {
  const el = document.getElementById(`analysis-${name}`);
  if (!el || !analysis) return;
  el.style.display = '';
  el.textContent = analysis;
}

// --- SSE Diagnostics ---

function runDiagnostics() {
  const btn = document.getElementById('run-btn');
  const status = document.getElementById('run-status');
  btn.classList.add('disabled');
  btn.textContent = '[running...]';
  status.textContent = 'connecting to agents...';

  const sbAgents = document.getElementById('sb-agents');
  sbAgents.innerHTML = 'agents: <span class="c-yellow">running</span>';

  // Clear previous results
  document.getElementById('agent-results').innerHTML = '';
  completedAgents = 0;
  totalAgents = 0;

  const evtSource = new EventSource('/api/diagnose');

  evtSource.addEventListener('init', (e) => {
    const agents = JSON.parse(e.data);
    totalAgents = agents.length;
    updateCounter();
    status.textContent = `${totalAgents} agents deployed`;

    for (const agent of agents) {
      createAgentSection(agent.name, agent.displayName);
    }
  });

  evtSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);

    switch (data.type) {
      case 'start':
        setAgentStatus(data.agent, 'running', 'starting...');
        break;
      case 'tool':
        setAgentStatus(data.agent, 'running', `tool: ${data.tool}`);
        addToolActivity(data.agent, data.tool);
        break;
      case 'complete':
        // Will be finalized when result arrives
        break;
    }
  });

  evtSource.addEventListener('result', (e) => {
    const data = JSON.parse(e.data);

    if (data.status === 'success') {
      setAgentStatus(data.agent, 'complete', 'done');
      if (data.data.findings) {
        displayFindings(data.agent, data.data.findings);
      }
      if (data.data.analysis) {
        displayAnalysis(data.agent, data.data.analysis);
      }
      // Clear tool activity
      const toolsEl = document.getElementById(`tools-${data.agent}`);
      if (toolsEl) toolsEl.textContent = '';
    } else {
      setAgentStatus(data.agent, 'error', `error: ${data.error}`);
    }

    completedAgents++;
    updateCounter();
  });

  evtSource.addEventListener('done', () => {
    evtSource.close();
    status.textContent = 'all agents complete';
    btn.textContent = '[run again]';
    btn.classList.remove('disabled');

    sbAgents.innerHTML = 'agents: <span class="c-green">done</span>';

    // Show client-side test sections
    document.getElementById('section-speed').style.display = '';
    document.getElementById('section-webrtc').style.display = '';
    document.getElementById('section-done').style.display = '';

    // Auto-run WebRTC test
    checkWebRTC();
  });

  evtSource.onerror = () => {
    evtSource.close();
    status.textContent = 'connection error - is the server running?';
    btn.textContent = '[retry]';
    btn.classList.remove('disabled');
    sbAgents.innerHTML = 'agents: <span class="c-red">error</span>';
  };
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

    const response = await fetch(testUrl + '&nocache=' + Date.now(), {
      cache: 'no-store',
    });
    const reader = response.body.getReader();
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      const elapsed = (performance.now() - startTime) / 1000;
      const currentSpeed = (received * 8) / 1000000 / elapsed;
      result.innerHTML = `<span class="c-muted">${currentSpeed.toFixed(1)} Mbps...</span>`;
    }

    const duration = (performance.now() - startTime) / 1000;
    const speedMbps = (received * 8) / 1000000 / duration;
    result.innerHTML = `<span class="c-green">${speedMbps.toFixed(1)} Mbps</span>`;

    // Get AI analysis
    requestAnalysis('download', { speed_mbps: speedMbps, bytes: received, duration_s: duration });
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
    const dataSize = 5 * 1024 * 1024;
    const data = new Uint8Array(dataSize);
    crypto.getRandomValues(data);

    const startTime = performance.now();
    await fetch('https://speed.cloudflare.com/__up', {
      method: 'POST',
      body: data,
      cache: 'no-store',
    });
    const duration = (performance.now() - startTime) / 1000;
    const speedMbps = (dataSize * 8) / 1000000 / duration;
    result.innerHTML = `<span class="c-green">${speedMbps.toFixed(1)} Mbps</span>`;

    // Get AI analysis
    requestAnalysis('upload', { speed_mbps: speedMbps, bytes: dataSize, duration_s: duration });
  } catch {
    result.innerHTML = '<span class="c-red">test failed</span>';
  }

  speedUploadRunning = false;
  btn.textContent = '[run again]';
  btn.classList.remove('disabled');
}

// --- AI Analysis for client-side tests ---

async function requestAnalysis(type, data) {
  try {
    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    });

    if (!resp.ok) return;

    const result = await resp.json();
    if (result.analysis) {
      const container = document.getElementById('speed-analysis');
      const text = document.getElementById('speed-analysis-text');
      container.style.display = '';
      text.textContent = result.analysis;
    }
  } catch {
    // Analysis is optional, don't show errors
  }
}

// --- WebRTC Leak Test ---

function checkWebRTC() {
  try {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    const ips = new Set();
    let completed = false;

    pc.createDataChannel('test');

    pc.onicecandidate = (ice) => {
      if (ice && ice.candidate && ice.candidate.candidate) {
        const matches = ice.candidate.candidate.match(
          /([0-9]{1,3}\.){3}[0-9]{1,3}/g
        );
        if (matches) {
          matches.forEach((ip) => ips.add(ip));
        }
      } else if (!ice.candidate && !completed) {
        completed = true;
        displayWebRTCResults(ips);
      }
    };

    pc.createOffer().then((o) => pc.setLocalDescription(o));

    setTimeout(() => {
      if (!completed) {
        completed = true;
        displayWebRTCResults(ips);
      }
      pc.close();
    }, 5000);
  } catch {
    document.getElementById('webrtc-result').innerHTML =
      '<span class="c-muted">WebRTC not available or blocked</span>';
  }
}

function displayWebRTCResults(ips) {
  const el = document.getElementById('webrtc-result');

  if (ips.size > 0) {
    const ipList = Array.from(ips)
      .map((ip) => `<span class="c-yellow">${escapeHtml(ip)}</span>`)
      .join(', ');
    el.innerHTML =
      `<span class="c-red">leak detected</span> - IPs revealed: ${ipList}` +
      '<br><span class="c-muted">consider disabling WebRTC or using a VPN extension</span>';
  } else {
    el.innerHTML =
      '<span class="c-green">no leak detected</span> - your real IP is not exposed via WebRTC';
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

// --- Event listeners ---

document.getElementById('run-btn').addEventListener('click', (e) => {
  e.preventDefault();
  if (e.target.classList.contains('disabled')) return;
  runDiagnostics();
});

document.getElementById('speed-download-btn').addEventListener('click', (e) => {
  e.preventDefault();
  runDownloadTest();
});

document.getElementById('speed-upload-btn').addEventListener('click', (e) => {
  e.preventDefault();
  runUploadTest();
});
