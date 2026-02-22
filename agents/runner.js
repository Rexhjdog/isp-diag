import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

/**
 * Run an agent through its full tool-use loop until it produces a final text response.
 * @param {object} agent - Agent config with name, systemPrompt, tools, handleTool
 * @param {string} context - The user message / diagnostic context
 * @param {function} onProgress - Callback for progress events
 * @returns {string} The agent's final text response
 */
export async function runAgent(agent, context, onProgress) {
  const messages = [{ role: 'user', content: context }];

  onProgress?.({ type: 'start', agent: agent.name, displayName: agent.displayName });

  let response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: agent.systemPrompt,
    tools: agent.tools,
    messages,
  });

  // Agentic loop: keep going while the model wants to use tools
  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter((b) => b.type === 'tool_use');
    const toolResults = [];

    for (const block of toolBlocks) {
      onProgress?.({ type: 'tool', agent: agent.name, tool: block.name });

      try {
        const result = await agent.handleTool(block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ error: err.message }),
          is_error: true,
        });
      }
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: agent.systemPrompt,
      tools: agent.tools,
      messages,
    });
  }

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  onProgress?.({ type: 'complete', agent: agent.name });

  return text;
}
