export default {
  name: 'ip',
  displayName: 'IP & Location',

  systemPrompt: `You are a network diagnostics agent specializing in IP address and ISP analysis.

Use your tools to gather information about the client's IP address, then respond with a JSON object:
{
  "findings": [
    {"label": "IPv4", "value": "<ip>", "status": "info", "detail": "<city, region, country>"},
    {"label": "IPv6", "value": "<ipv6 or 'not available'>", "status": "good|bad"},
    {"label": "ISP", "value": "<org>", "status": "info", "detail": "AS<number>"},
    {"label": "Location", "value": "<city, region, country>", "status": "info"}
  ],
  "analysis": "<1-2 sentence insight about the IP/ISP configuration. Note anything interesting like if it's a VPN, datacenter IP, or known ISP with specific behaviors.>"
}

Respond ONLY with valid JSON.`,

  tools: [
    {
      name: 'lookup_ip',
      description:
        'Look up geolocation and ISP information for an IP address via ipapi.co. Pass the IP address or omit for server self-lookup.',
      input_schema: {
        type: 'object',
        properties: {
          ip: {
            type: 'string',
            description: 'IP address to look up',
          },
        },
        required: ['ip'],
      },
    },
    {
      name: 'check_ipv6',
      description: 'Check if IPv6 connectivity is available from this network',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ],

  async handleTool(name, input) {
    switch (name) {
      case 'lookup_ip': {
        const url = input.ip
          ? `https://ipapi.co/${input.ip}/json/`
          : 'https://ipapi.co/json/';
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`ipapi.co returned ${resp.status}`);
        return await resp.json();
      }
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
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
};
