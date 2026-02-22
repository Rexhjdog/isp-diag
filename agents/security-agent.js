export default {
  name: 'security',
  displayName: 'Security',

  systemPrompt: `You are a network diagnostics agent specializing in connection security analysis.

Use your tools to check TLS/HTTPS configuration, security headers, and certificate information for the client's connection. Then respond with a JSON object:
{
  "findings": [
    {"label": "<check name>", "value": "<result>", "status": "good|bad|warn|info"}
  ],
  "analysis": "<2-3 sentence security assessment with recommendations.>"
}

Focus on practical security implications. Respond ONLY with valid JSON.`,

  tools: [
    {
      name: 'check_tls',
      description:
        'Check TLS/HTTPS configuration by making a request to a target URL and inspecting the connection',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to check (defaults to cloudflare.com)',
          },
        },
        required: [],
      },
    },
    {
      name: 'check_security_headers',
      description:
        'Fetch security-related HTTP headers from a URL (HSTS, CSP, X-Frame-Options, etc.)',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to check headers for',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'check_certificate',
      description:
        'Check basic certificate information for a domain via an HTTPS connection',
      input_schema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Domain to check certificate for',
          },
        },
        required: ['domain'],
      },
    },
  ],

  async handleTool(name, input) {
    switch (name) {
      case 'check_tls': {
        const url = input.url || 'https://cloudflare.com';
        const resp = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        return {
          url,
          status: resp.status,
          protocol: resp.url.startsWith('https') ? 'HTTPS' : 'HTTP',
          redirected: resp.redirected,
          final_url: resp.url,
        };
      }

      case 'check_security_headers': {
        const resp = await fetch(input.url, {
          method: 'HEAD',
          redirect: 'follow',
        });
        const interesting = [
          'strict-transport-security',
          'content-security-policy',
          'x-frame-options',
          'x-content-type-options',
          'referrer-policy',
          'permissions-policy',
          'x-xss-protection',
        ];
        const headers = {};
        for (const h of interesting) {
          const val = resp.headers.get(h);
          if (val) headers[h] = val;
        }
        return {
          url: input.url,
          security_headers: headers,
          total_found: Object.keys(headers).length,
        };
      }

      case 'check_certificate': {
        // Node fetch doesn't expose cert details, but we can verify HTTPS works
        const url = `https://${input.domain}`;
        try {
          const resp = await fetch(url, { method: 'HEAD', redirect: 'follow' });
          return {
            domain: input.domain,
            https_works: true,
            status: resp.status,
            note: 'Certificate accepted by Node.js TLS (valid chain, not expired)',
          };
        } catch (err) {
          return {
            domain: input.domain,
            https_works: false,
            error: err.message,
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
};
