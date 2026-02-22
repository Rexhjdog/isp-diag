import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runAgent } from './agents/runner.js';
import ipAgent from './agents/ip-agent.js';
import dnsAgent from './agents/dns-agent.js';
import securityAgent from './agents/security-agent.js';
import networkAgent from './agents/network-agent.js';
import performanceAgent from './agents/performance-agent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Check for API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    '\n⚠  ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.\n'
  );
}

// Serve static files
app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

// SSE diagnostic endpoint - runs all agents in parallel, streams results
app.get('/api/diagnose', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Get client IP
  const clientIP =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress;

  const cleanIP = clientIP?.replace(/^::ffff:/, '') || 'unknown';
  const isLocal = ['127.0.0.1', '::1', 'unknown'].includes(cleanIP);

  const context = [
    `Client IP: ${isLocal ? '(local - use self-lookup)' : cleanIP}`,
    `User-Agent: ${req.headers['user-agent'] || 'unknown'}`,
    `Timestamp: ${new Date().toISOString()}`,
    '',
    'Run all your diagnostic tools and provide a complete analysis.',
  ].join('\n');

  const agents = [ipAgent, dnsAgent, securityAgent, networkAgent, performanceAgent];

  // Tell frontend which agents to expect
  send(
    'init',
    agents.map((a) => ({ name: a.name, displayName: a.displayName }))
  );

  // Run all agents in parallel
  const promises = agents.map(async (agent) => {
    const onProgress = (event) => send('progress', event);

    try {
      const analysis = await runAgent(agent, context, onProgress);

      // Try to parse as JSON, fall back to raw text
      let parsed;
      try {
        parsed = JSON.parse(analysis);
      } catch {
        parsed = { findings: [], analysis };
      }

      send('result', {
        agent: agent.name,
        displayName: agent.displayName,
        status: 'success',
        data: parsed,
      });
    } catch (err) {
      send('result', {
        agent: agent.name,
        displayName: agent.displayName,
        status: 'error',
        error: err.message,
      });
    }
  });

  await Promise.allSettled(promises);

  send('done', { message: 'All diagnostics complete' });
  res.end();
});

// Analyze client-side test results (speed test, WebRTC)
app.post('/api/analyze', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'API key not configured' });
  }

  const { type, data } = req.body;

  const analyzerAgent = {
    name: 'analyzer',
    displayName: 'Results Analyzer',
    systemPrompt: `You are a network diagnostics analyst. Given test results from a client's browser, provide a brief, insightful analysis. Respond with a JSON object:
{
  "analysis": "<2-3 sentence analysis with practical recommendations.>"
}
Respond ONLY with valid JSON.`,
    tools: [],
    async handleTool() {
      throw new Error('No tools available');
    },
  };

  const context = `Analyze these ${type} test results from the client's browser:\n${JSON.stringify(data, null, 2)}`;

  try {
    const result = await runAgent(analyzerAgent, context, null);
    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch {
      parsed = { analysis: result };
    }
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\nisp-diag v2.0 - agent-powered diagnostics`);
  console.log(`Server running at http://localhost:${PORT}\n`);
});
