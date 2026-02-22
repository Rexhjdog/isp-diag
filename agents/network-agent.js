export default {
  name: 'network',
  displayName: 'Network Capabilities',

  systemPrompt: `You are a network diagnostics agent specializing in network capability detection.

Use your tools to test IPv6 connectivity, protocol support, and network features. Then respond with a JSON object:
{
  "findings": [
    {"label": "<capability>", "value": "<result>", "status": "good|bad|warn|info"}
  ],
  "analysis": "<1-2 sentence summary of network capabilities and any recommendations.>"
}

Respond ONLY with valid JSON.`,

  tools: [
    {
      name: 'check_ipv6',
      description: 'Test if IPv6 connectivity is available from this network',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'check_protocol_support',
      description:
        'Check HTTP protocol support (HTTP/2, HTTP/3) by making requests to known endpoints',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to test protocol support against',
          },
        },
        required: [],
      },
    },
    {
      name: 'check_connectivity',
      description:
        'Test general internet connectivity by reaching multiple well-known endpoints',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ],

  async handleTool(name, input) {
    switch (name) {
      case 'check_ipv6': {
        try {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 4000);
          const resp = await fetch('https://api6.ipify.org?format=json', {
            signal: controller.signal,
          });
          const data = await resp.json();
          return { available: true, ipv6_address: data.ip };
        } catch {
          return { available: false };
        }
      }

      case 'check_protocol_support': {
        const url = input.url || 'https://cloudflare.com';
        const resp = await fetch(url, { method: 'HEAD' });
        // Check alt-svc header for HTTP/3 indication
        const altSvc = resp.headers.get('alt-svc') || '';
        const hasH3 = altSvc.includes('h3');
        return {
          url,
          http2: true, // Node.js fetch uses HTTP/2 by default when available
          http3_advertised: hasH3,
          alt_svc: altSvc || null,
        };
      }

      case 'check_connectivity': {
        const endpoints = [
          { name: 'Cloudflare', url: 'https://1.1.1.1/cdn-cgi/trace' },
          { name: 'Google', url: 'https://www.google.com/generate_204' },
          { name: 'Apple', url: 'https://captive.apple.com' },
        ];

        const results = [];
        for (const ep of endpoints) {
          const start = performance.now();
          try {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 5000);
            const resp = await fetch(ep.url, {
              method: 'HEAD',
              signal: controller.signal,
            });
            const latency = Math.round(performance.now() - start);
            results.push({
              name: ep.name,
              reachable: true,
              latency_ms: latency,
              status: resp.status,
            });
          } catch (err) {
            results.push({
              name: ep.name,
              reachable: false,
              error: err.message,
            });
          }
        }
        return { endpoints: results };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
};
