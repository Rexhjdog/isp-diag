export default {
  name: 'performance',
  displayName: 'Performance',

  systemPrompt: `You are a network diagnostics agent specializing in network performance analysis.

Use your tools to measure DNS query latency and overall network responsiveness. Then respond with a JSON object:
{
  "findings": [
    {"label": "<metric>", "value": "<result>", "status": "good|bad|warn|info"}
  ],
  "analysis": "<2-3 sentence performance assessment. Note if latency or jitter indicate congestion, routing issues, or throttling.>"
}

Latency guidelines: <50ms = good, 50-150ms = warn, >150ms = bad.
Jitter guidelines: <10ms = good, 10-30ms = warn, >30ms = bad.
Respond ONLY with valid JSON.`,

  tools: [
    {
      name: 'measure_dns_latency',
      description:
        'Measure DNS-over-HTTPS query latency by performing multiple queries and computing statistics',
      input_schema: {
        type: 'object',
        properties: {
          samples: {
            type: 'number',
            description: 'Number of latency samples to collect (default 10)',
          },
        },
        required: [],
      },
    },
    {
      name: 'measure_http_latency',
      description:
        'Measure HTTP request latency to well-known endpoints',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to measure latency to (defaults to cloudflare)',
          },
          samples: {
            type: 'number',
            description: 'Number of samples (default 5)',
          },
        },
        required: [],
      },
    },
  ],

  async handleTool(name, input) {
    switch (name) {
      case 'measure_dns_latency': {
        const count = input.samples || 10;
        const times = [];
        const url = 'https://cloudflare-dns.com/dns-query?name=.&type=NS';

        for (let i = 0; i < count; i++) {
          try {
            const start = performance.now();
            await fetch(`${url}&_=${Date.now()}`, {
              headers: { Accept: 'application/dns-json' },
              cache: 'no-store',
            });
            times.push(Math.round(performance.now() - start));
          } catch {
            // skip failed measurement
          }
          if (i < count - 1) {
            await new Promise((r) => setTimeout(r, 200));
          }
        }

        if (times.length === 0) {
          return { error: 'All measurements failed' };
        }

        const min = Math.min(...times);
        const max = Math.max(...times);
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        const jitter = Math.round(
          Math.sqrt(
            times.map((t) => (t - avg) ** 2).reduce((a, b) => a + b, 0) /
              times.length
          )
        );

        return {
          samples: times.length,
          min_ms: min,
          max_ms: max,
          avg_ms: avg,
          jitter_ms: jitter,
          all_times_ms: times,
        };
      }

      case 'measure_http_latency': {
        const url = input.url || 'https://cloudflare.com';
        const count = input.samples || 5;
        const times = [];

        for (let i = 0; i < count; i++) {
          try {
            const start = performance.now();
            await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
              method: 'HEAD',
              cache: 'no-store',
            });
            times.push(Math.round(performance.now() - start));
          } catch {
            // skip
          }
          if (i < count - 1) {
            await new Promise((r) => setTimeout(r, 100));
          }
        }

        if (times.length === 0) {
          return { error: 'All measurements failed' };
        }

        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

        return {
          url,
          samples: times.length,
          avg_ms: avg,
          min_ms: Math.min(...times),
          max_ms: Math.max(...times),
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
};
