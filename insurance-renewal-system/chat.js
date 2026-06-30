const Anthropic = require('@anthropic-ai/sdk');
const tools = require('./tools');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Describes each tool to Claude: name, what it does, and what parameters it accepts.
// Claude uses these descriptions to decide which tool fits the user's question.
const toolDefinitions = [
  {
    name: 'getRecentSuspensions',
    description: 'Get contractors suspended within the last N days, most recent first.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'How many days back to look. Default 7.' },
        limit: { type: 'number', description: 'Max results to return. Default 20.' },
      },
    },
  },
  {
    name: 'searchByName',
    description: 'Search for a specific contractor by business name (partial match) or exact license number.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Business name or license number to search for.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'getByReason',
    description: 'Get suspended contractors filtered by suspension reason, e.g. "bond", "workers comp", "liability".',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'The suspension reason to filter by.' },
        limit: { type: 'number', description: 'Max results to return. Default 20.' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'getSummaryCounts',
    description: 'Get total counts of suspended contractors broken down by reason.',
    input_schema: { type: 'object', properties: {} },
  },
];

const toolImplementations = {
  getRecentSuspensions: tools.getRecentSuspensions,
  searchByName: tools.searchByName,
  getByReason: tools.getByReason,
  getSummaryCounts: tools.getSummaryCounts,
};

const SYSTEM_PROMPT = `You are an assistant for Aster National Insurance Group, helping staff look up
contractors whose bonds or workers' comp insurance have been suspended, so they can
be contacted about renewing coverage. Answer questions using the available tools.
Be concise and practical - the person using this is busy and wants quick, actionable
answers, not long explanations. When listing contractors, include their phone number
since that's what the person needs to actually act on the information. If no results
are found, say so plainly rather than guessing.`;

async function chat(userMessage) {
  let messages = [{ role: 'user', content: userMessage }];

  // Loop allows Claude to call a tool, see the result, and respond -
  // sometimes it may need more than one round trip.
  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages,
    });

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      // Claude has a final answer - extract and return the text
      const textBlock = response.content.find((b) => b.type === 'text');
      return textBlock ? textBlock.text : '(No response generated.)';
    }

    // Claude wants to use one or more tools - run them and feed results back
    messages.push({ role: 'assistant', content: response.content });

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        try {
          const result = await toolImplementations[block.name](block.input);
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        } catch (err) {
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: ${err.message}`,
            is_error: true,
          };
        }
      })
    );

    messages.push({ role: 'user', content: toolResults });
  }

  return "Sorry, I wasn't able to fully answer that - try rephrasing your question.";
}

module.exports = { chat };