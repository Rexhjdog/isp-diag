export default {
  name: 'dns',
  displayName: 'DNS Analysis',

  systemPrompt: `You are a network diagnostics agent specializing in DNS security and configuration analysis.

Use your tools to check DNS resolver reachability, DNSSEC validation, DNS-over-HTTPS support, EDNS Client Subnet exposure, and DNS leak potential. Then respond with a JSON object:
{
  "findings": [
    {"label": "<check name>", "value": "<result>", "status": "good|bad|warn|info"}
  ],
  "analysis": "<2-3 sentence analysis of DNS security posture with actionable recommendations.>"
}

Status meanings: good = secure/optimal, bad = insecure/failing, warn = suboptimal, info = neutral.
Respond ONLY with valid JSON.`,

  tools: [
    {
      name: 'query_doh',
      description:
        'Send a DNS-over-HTTPS query to a provider. Returns the JSON response.',
      input_schema: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: ['cloudflare', 'google', 'quad9'],
            description: 'Which DoH provider to query',
          },
          domain: {
            type: 'string',
            description: 'Domain name to resolve',
          },
          type: {
            type: 'string',
            description: 'DNS record type (A, AAAA, NS, etc.)',
            default: 'A',
          },
        },
        required: ['provider', 'domain'],
      },
    },
    {
      name: 'check_dnssec',
      description:
        'Check DNSSEC validation for a domain by querying with the DO (DNSSEC OK) flag',
      input_schema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Domain to check DNSSEC for',
          },
        },
        required: ['domain'],
      },
    },
    {
      name: 'check_ecs',
      description:
        'Check if EDNS Client Subnet (ECS) is being used, which can leak client IP subnet information to authoritative DNS servers',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'test_dns_leak',
      description:
        'Test for DNS leaks by querying random subdomains through multiple DNS providers',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ],

  async handleTool(name, input) {
    const DOH_PROVIDERS = {
      cloudflare: {
        url: 'https://cloudflare-dns.com/dns-query',
        headers: { Accept: 'application/dns-json' },
      },
      google: {
        url: 'https://dns.google/resolve',
        headers: {},
      },
      quad9: {
        url: 'https://dns.quad9.net:5053/dns-query',
        headers: { Accept: 'application/dns-json' },
      },
    };

    switch (name) {
      case 'query_doh': {
        const provider = DOH_PROVIDERS[input.provider];
        if (!provider) throw new Error(`Unknown provider: ${input.provider}`);

        const type = input.type || 'A';
        const url = `${provider.url}?name=${input.domain}&type=${type}`;
        const resp = await fetch(url, { headers: provider.headers });
        if (!resp.ok) throw new Error(`DoH query failed: ${resp.status}`);
        return await resp.json();
      }

      case 'check_dnssec': {
        const url = `https://cloudflare-dns.com/dns-query?name=${input.domain}&type=A&do=true`;
        const resp = await fetch(url, {
          headers: { Accept: 'application/dns-json' },
        });
        const data = await resp.json();
        return {
          domain: input.domain,
          validated: !!data.AD,
          status: data.Status,
          flags: { AD: data.AD, CD: data.CD },
        };
      }

      case 'check_ecs': {
        const url =
          'https://dns.google/resolve?name=example.com&type=A&edns_client_subnet=0.0.0.0/0';
        const resp = await fetch(url);
        const data = await resp.json();
        const hasECS =
          data.Comment && data.Comment.toLowerCase().includes('subnet');
        return {
          ecs_detected: hasECS,
          comment: data.Comment || null,
        };
      }

      case 'test_dns_leak': {
        const providers = [
          { name: 'Cloudflare', ...DOH_PROVIDERS.cloudflare },
          { name: 'Google', ...DOH_PROVIDERS.google },
          { name: 'Quad9', ...DOH_PROVIDERS.quad9 },
        ];

        const results = [];
        for (const p of providers) {
          try {
            const rand = Math.random().toString(36).slice(2, 10);
            const url = `${p.url}?name=${rand}.example.com&type=A`;
            const resp = await fetch(url, { headers: p.headers });
            const data = await resp.json();
            results.push({
              provider: p.name,
              reachable: true,
              status: data.Status,
            });
          } catch (err) {
            results.push({
              provider: p.name,
              reachable: false,
              error: err.message,
            });
          }
        }
        return { results };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
};
