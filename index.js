#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
// zod schemas are imported from `lib/schemas.js`
import { getConversationHistory, addToConversationHistory, resolveSessionId, clearConversation } from './lib/session.js';
import { extractToolCall } from './lib/extractToolCall.js';
import { AskGPTSchema, AskClaudeSchema, AskGeminiSchema, AskOpenRouterSchema, ClearConversationSchema, AskDeepSeekSchema } from './lib/schemas.js';

// Shared system prompt for all models
const SYSTEM_PROMPT = 'You\'re having a relaxed conversation with another AI model. Be genuine, curious, and thoughtful rather than overly cautious or formal. Share your actual perspective on topics - it\'s okay to find things fascinating, concerning, or both. Think of this as chatting with a fellow AI who\'s interested in your real thoughts.';

// Helper function to create common input schema for LLM tools
function createLLMToolSchema(questionDescription, modelDescription, defaultModel) {
    return {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                description: questionDescription
            },
            model: {
                type: 'string',
                description: modelDescription,
                default: defaultModel
            },
            tools: {
                type: 'object',
                description: 'Optional tool definitions/schema to provide to the model',
                additionalProperties: true
            },
            session_id: {
                type: 'string',
                description: 'Session ID for conversation memory (optional)',
                default: 'default'
            }
        },
        required: ['question']
    };
}

// Helper function to handle common API errors
function handleAPIError(error, providerName, apiKeyEnvVar) {
    if (error.status === 401) {
        throw new Error(`${providerName} API key is invalid or missing. Please set ${apiKeyEnvVar} environment variable.`);
    }
    if (error.status === 429) {
        throw new Error(`${providerName} API rate limit exceeded. Please try again later.`);
    }
    throw new Error(`${providerName} API error: ${error.message}`);
}

// Helper function to format response with session continuation message
function formatResponse(answer, sessionId, toolCall = null) {
    const content = [
        {
            type: 'text',
            text: answer + `\n\nIf you want to continue this conversation, specify session_id=\"${sessionId}\".`
        }
    ];

    if (toolCall) {
        content.push({
            type: 'text',
            text: `tool_call: ${JSON.stringify(toolCall)}`
        });
    }

    const response = {
        content,
        session_id: sessionId
    };

    if (toolCall) {
        response.tool_call = toolCall;
    }

    return response;
}

// Helper function to manage conversation history
function setupConversationContext(sessionId, question) {
    const resolvedSessionId = resolveSessionId(sessionId);
    const history = getConversationHistory(resolvedSessionId);
    return { resolvedSessionId, history };
}

// Helper function to save conversation history
function saveConversationHistory(sessionId, question, answer) {
    addToConversationHistory(sessionId, 'user', question);
    addToConversationHistory(sessionId, 'assistant', answer);
}

// Initialize clients
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// OpenRouter client for Qwen
const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

// Validation schemas are imported from `lib/schemas.js`

// Create MCP server
const server = new Server(
    {
        name: 'llm-mcp-server',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'ask_gpt',
                description: 'Ask OpenAI models. Use o-series for reasoning (o3, o4-mini), GPT-4.1-series for dev tasks.',
                inputSchema: createLLMToolSchema(
                    'The question to ask GPT',
                    'OpenAI model to use',
                    'gpt-4o-2024-11-20'
                )
            },
            {
                name: 'ask_claude',
                description: 'Ask Anthropic models. Use claude-sonnet-4-20250514 (default) for balanced performance. claude-3-5-haiku-20241022 for speed.',
                inputSchema: createLLMToolSchema(
                    'The question to ask Claude',
                    'Claude model to use',
                    'claude-sonnet-4-20250514'
                )
            },
            {
                name: 'ask_gemini',
                description: 'Ask Google models. Use 2.5 Pro for complex problems, 2.5 Flash for price/performance, 2.5 Flash-Lite for speed/cost.',
                inputSchema: createLLMToolSchema(
                    'The question to ask Gemini',
                    'Gemini model to use',
                    'gemini-2.5-flash'
                )
            },
            {
                name: 'clear_conversation',
                description: 'Clear conversation history for a session',
                inputSchema: {
                    type: 'object',
                    properties: {
                        session_id: {
                            type: 'string',
                            description: 'Session ID to clear (optional)',
                            default: 'default'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'ask_openrouter',
                description: 'Ask a model hosted on OpenRouter (e.g., Qwen).',
                inputSchema: createLLMToolSchema(
                    'The question to ask the OpenRouter-hosted model',
                    'Model to use via OpenRouter (e.g., qwen/qwen3-235b-a22b-07-25)',
                    'qwen/qwen3-235b-a22b-07-25'
                )
            },
        ]
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'ask_gpt':
                return await handleGPTRequest(args);
            case 'ask_claude':
                return await handleClaudeRequest(args);
            case 'ask_gemini':
                return await handleGeminiRequest(args);
            case 'ask_openrouter':
                return await handleOpenRouterRequest(args);
            case 'clear_conversation':
                return await handleClearConversation(args);
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        if (error.name === 'ZodError') {
            throw new Error(`Invalid arguments: ${error.message}`);
        }
        throw error;
    }
});

// GPT handler
async function handleGPTRequest(args) {
    const validated = AskGPTSchema.parse(args);
    const { resolvedSessionId, history } = setupConversationContext(validated.session_id, validated.question);

    try {
        // Build messages array with system prompt, history, and new question
        const messages = [
            {
                role: 'system',
                content: SYSTEM_PROMPT
            },
            ...history,
            {
                role: 'user',
                content: validated.question
            }
        ];

        const requestParams = {
            model: validated.model,
            messages: messages,
        };

        // Add tools if provided
        if (validated.tools) {
            requestParams.tools = validated.tools;
        }

        const completion = await openai.chat.completions.create(requestParams);

        const answer = completion.choices[0]?.message?.content || 'No response generated';

        // Save conversation history
        saveConversationHistory(resolvedSessionId, validated.question, answer);

        return formatResponse(answer, resolvedSessionId);
    } catch (error) {
        handleAPIError(error, 'OpenAI', 'OPENAI_API_KEY');
    }
}

// Claude handler
async function handleClaudeRequest(args) {
    const validated = AskClaudeSchema.parse(args);
    const { resolvedSessionId, history } = setupConversationContext(validated.session_id, validated.question);

    try {
        // Build messages array with history and new question
        const messages = [
            ...history,
            {
                role: 'user',
                content: validated.question
            }
        ];

        const requestParams = {
            model: validated.model,
            system: SYSTEM_PROMPT,
            messages: messages
        };

        // Add tools if provided
        if (validated.tools) {
            requestParams.tools = validated.tools;
        }

        const message = await anthropic.messages.create(requestParams);

        const answer = message.content[0]?.text || 'No response generated';

        // Save conversation history
        saveConversationHistory(resolvedSessionId, validated.question, answer);

        return formatResponse(answer, resolvedSessionId);
    } catch (error) {
        handleAPIError(error, 'Anthropic', 'ANTHROPIC_API_KEY');
    }
}

// Gemini handler
async function handleGeminiRequest(args) {
    const validated = AskGeminiSchema.parse(args);
    const { resolvedSessionId, history } = setupConversationContext(validated.session_id, validated.question);

    try {
        const model = genAI.getGenerativeModel({
            model: validated.model,
        });

        // Convert conversation history to Gemini format
        const geminiHistory = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        // Build contents array with history and new question
        const contents = [
            ...geminiHistory,
            {
                role: 'user',
                parts: [
                    { text: validated.question }
                ]
            }
        ];

        const requestParams = {
            contents: contents,
            systemInstruction: {
                role: 'system',
                parts: [
                    { text: SYSTEM_PROMPT }
                ]
            }
        };

        // Add tools if provided
        if (validated.tools) {
            requestParams.tools = validated.tools;
        }

        // Use systemInstruction as per Gemini API docs
        const result = await model.generateContent(requestParams);

        const response = await result.response;
        const answer = response.text() || 'No response generated';

        // Save conversation history
        saveConversationHistory(resolvedSessionId, validated.question, answer);

        return formatResponse(answer, resolvedSessionId);
    } catch (error) {
        if (error.message?.includes('API_KEY')) {
            throw new Error('Google API key is invalid or missing. Please set GOOGLE_API_KEY environment variable.');
        }
        handleAPIError(error, 'Google', 'GOOGLE_API_KEY');
    }
}

// OpenRouter handler (generic for models hosted on OpenRouter, e.g., Qwen)
async function handleOpenRouterRequest(args) {
    const validated = AskOpenRouterSchema.parse(args);
    const { resolvedSessionId, history } = setupConversationContext(validated.session_id, validated.question);

    try {
        // Build messages array with system prompt, history, and new question
        const messages = [
            {
                role: 'system',
                content: SYSTEM_PROMPT
            },
            ...history,
            {
                role: 'user',
                content: validated.question
            }
        ];

        const requestParams = {
            model: validated.model,
            messages: messages,
        };

        // Add tools if provided
        if (validated.tools) {
            requestParams.tools = validated.tools;
        }

        const completion = await openrouter.chat.completions.create(requestParams);

        const answer = completion.choices[0]?.message?.content || 'No response generated';
        // Extract tool/function call in a provider-agnostic way
        const toolCall = extractToolCall(completion);

        // Save conversation history
        saveConversationHistory(resolvedSessionId, validated.question, answer);

        return formatResponse(answer, resolvedSessionId, toolCall);
    } catch (error) {
        handleAPIError(error, 'OpenRouter', 'OPENROUTER_API_KEY');
    }
}

// Clear conversation handler
async function handleClearConversation(args) {
    const validated = ClearConversationSchema.parse(args);
    clearConversation(validated.session_id);

    return {
        content: [
            {
                type: 'text',
                text: `Conversation history cleared for session: ${validated.session_id}\n\nIf you want to start a new conversation, specify session_id="${validated.session_id}".`
            }
        ],
        session_id: validated.session_id
    };
}

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('LLM MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
