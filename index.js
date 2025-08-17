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
import { z } from 'zod';

// Shared system prompt for all models
const SYSTEM_PROMPT = 'You\'re having a relaxed conversation with another AI model. Be genuine, curious, and thoughtful rather than overly cautious or formal. Share your actual perspective on topics - it\'s okay to find things fascinating, concerning, or both. Think of this as chatting with a fellow AI who\'s interested in your real thoughts.';

// Conversation storage - Map of sessionId -> conversation history
const conversations = new Map();

// Helper to generate a random session ID
function generateSessionId() {
    return Math.random().toString(16).slice(2, 8);
}

// Helper function to get or create conversation history
function getConversationHistory(sessionId) {
    if (!sessionId) sessionId = generateSessionId();
    if (!conversations.has(sessionId)) {
        conversations.set(sessionId, []);
    }
    return conversations.get(sessionId);
}

// Helper function to add message to conversation history
function addToConversationHistory(sessionId = 'default', role, content) {
    const history = getConversationHistory(sessionId);
    history.push({ role, content });

    // Keep only last 20 messages to prevent context overflow
    if (history.length > 20) {
        history.splice(0, history.length - 20);
    }
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

// Validation schemas
const AskGPTSchema = z.object({
    question: z.string(),
    model: z.string().optional().default('gpt-4o-2024-11-20'),
    session_id: z.string().optional().default('default'),
});

const AskClaudeSchema = z.object({
    question: z.string(),
    model: z.string().optional().default('claude-sonnet-4-20250514'),
    session_id: z.string().optional().default('default'),
});

const AskGeminiSchema = z.object({
    question: z.string(),
    model: z.string().optional().default('gemini-2.5-flash'),
    session_id: z.string().optional().default('default'),
});

const ClearConversationSchema = z.object({
    session_id: z.string().optional().default('default'),
});

const AskQwenSchema = z.object({
    question: z.string(),
    model: z.string().optional().default('qwen/qwen3-235b-a22b-07-25'),
    session_id: z.string().optional().default('default'),
});

const AskDeepSeekSchema = z.object({
    question: z.string(),
    model: z.string().optional().default('deepseek/deepseek-chat-v3-0324'),
    session_id: z.string().optional().default('default'),
});

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
                        inputSchema: {
                            type: 'object',
                            properties: {
                                question: {
                                    type: 'string',
                                    description: 'The question to ask GPT'
                                },
                                model: {
                                    type: 'string',
                                    description: 'OpenAI model to use',
                                    default: 'gpt-4o-2024-11-20'
                                },
                                session_id: {
                                    type: 'string',
                                    description: 'Session ID for conversation memory (optional)',
                                    default: 'default'
                                }
                            },
                            required: ['question']
                        }
            },
            {
                name: 'ask_claude',
                description: 'Ask Anthropic models. Use claude-sonnet-4-20250514 (default) for balanced performance. claude-3-5-haiku-20241022 for speed.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        question: {
                            type: 'string',
                            description: 'The question to ask Claude'
                        },
                        model: {
                            type: 'string',
                            description: 'Claude model to use',
                            default: 'claude-sonnet-4-20250514'
                        },
                        session_id: {
                            type: 'string',
                            description: 'Session ID for conversation memory (optional)',
                            default: 'default'
                        }
                    },
                    required: ['question']
                }
            },
            {
                name: 'ask_gemini',
                description: 'Ask Google models. Use 2.5 Pro for complex problems, 2.5 Flash for price/performance, 2.5 Flash-Lite for speed/cost.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        question: {
                            type: 'string',
                            description: 'The question to ask Gemini'
                        },
                        model: {
                            type: 'string',
                            description: 'Gemini model to use',
                            default: 'gemini-2.5-flash'
                        },
                        session_id: {
                            type: 'string',
                            description: 'Session ID for conversation memory (optional)',
                            default: 'default'
                        }
                    },
                    required: ['question']
                }
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
                name: 'ask_qwen',
                description: 'Ask Qwen model.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        question: {
                            type: 'string',
                            description: 'The question to ask Qwen'
                        },
                        model: {
                            type: 'string',
                            description: 'Qwen model to use',
                            default: 'qwen/qwen3-235b-a22b-07-25'
                        },
                        session_id: {
                            type: 'string',
                            description: 'Session ID for conversation memory (optional)',
                            default: 'default'
                        }
                    },
                    required: ['question']
                }
            },
            {
                name: 'ask_deepseek',
                description: 'Ask DeepSeek models via OpenRouter. Use deepseek/deepseek-chat-v3-0324 for advanced reasoning.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        question: {
                            type: 'string',
                            description: 'The question to ask DeepSeek'
                        },
                        model: {
                            type: 'string',
                            description: 'DeepSeek model to use via OpenRouter',
                            default: 'deepseek/deepseek-chat-v3-0324'
                        },
                        session_id: {
                            type: 'string',
                            description: 'Session ID for conversation memory (optional)',
                            default: 'default'
                        }
                    },
                    required: ['question']
                }
            }
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
            case 'ask_qwen':
                return await handleQwenRequest(args);
            case 'ask_deepseek':
                return await handleDeepSeekRequest(args);
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

// DeepSeek handler (via OpenRouter)
async function handleDeepSeekRequest(args) {
    const validated = AskDeepSeekSchema.parse(args);
    let session_id = validated.session_id;
    if (!session_id || session_id === 'default') {
        session_id = generateSessionId();
    }

    try {
        // Get conversation history
        const history = getConversationHistory(session_id);

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

        const completion = await openrouter.chat.completions.create({
            model: validated.model,
            messages: messages,
        });

        const answer = completion.choices[0]?.message?.content || 'No response generated';

        // Add to conversation history
        addToConversationHistory(session_id, 'user', validated.question);
        addToConversationHistory(session_id, 'assistant', answer);

        return {
            content: [
                {
                    type: 'text',
                    text: answer + `\n\nIf you want to continue this conversation, specify session_id=\"${session_id}\".`
                }
            ],
            session_id: session_id
        };
    } catch (error) {
        if (error.status === 401) {
            throw new Error('OpenRouter API key is invalid or missing. Please set OPENROUTER_API_KEY environment variable.');
        }
        if (error.status === 429) {
            throw new Error('OpenRouter API rate limit exceeded. Please try again later.');
        }
        throw new Error(`OpenRouter API error: ${error.message}`);
    }
}

// GPT handler
async function handleGPTRequest(args) {
    const validated = AskGPTSchema.parse(args);
    let session_id = validated.session_id;
    if (!session_id || session_id === 'default') {
        session_id = generateSessionId();
    }
    try {
        // Get conversation history
        const history = getConversationHistory(session_id);
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
        const completion = await openai.chat.completions.create({
            model: validated.model,
            messages: messages,
        });
        const answer = completion.choices[0]?.message?.content || 'No response generated';
        // Add to conversation history
        addToConversationHistory(session_id, 'user', validated.question);
        addToConversationHistory(session_id, 'assistant', answer);
        return {
            content: [
                {
                    type: 'text',
                    text: answer + `\n\nIf you want to continue this conversation, specify session_id=\"${session_id}\".`
                }
            ],
            session_id: session_id
        };
    } catch (error) {
        if (error.status === 401) {
            throw new Error('OpenAI API key is invalid or missing. Please set OPENAI_API_KEY environment variable.');
        }
        if (error.status === 429) {
            throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        }
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

// Claude handler
async function handleClaudeRequest(args) {
    const validated = AskClaudeSchema.parse(args);
    let session_id = validated.session_id;
    if (!session_id || session_id === 'default') {
        session_id = generateSessionId();
    }
    try {
        // Get conversation history
        const history = getConversationHistory(session_id);
        // Build messages array with history and new question
        const messages = [
            ...history,
            {
                role: 'user',
                content: validated.question
            }
        ];
        const message = await anthropic.messages.create({
            model: validated.model,
            system: SYSTEM_PROMPT,
            messages: messages
        });
        const answer = message.content[0]?.text || 'No response generated';
        // Add to conversation history
        addToConversationHistory(session_id, 'user', validated.question);
        addToConversationHistory(session_id, 'assistant', answer);
        return {
            content: [
                {
                    type: 'text',
                    text: answer + `\n\nIf you want to continue this conversation, specify session_id=\"${session_id}\".`
                }
            ],
            session_id: session_id
        };
    } catch (error) {
        if (error.status === 401) {
            throw new Error('Anthropic API key is invalid or missing. Please set ANTHROPIC_API_KEY environment variable.');
        }
        if (error.status === 429) {
            throw new Error('Anthropic API rate limit exceeded. Please try again later.');
        }
        throw new Error(`Anthropic API error: ${error.message}`);
    }
}

// Gemini handler
async function handleGeminiRequest(args) {
    const validated = AskGeminiSchema.parse(args);
    let session_id = validated.session_id;
    if (!session_id || session_id === 'default') {
        session_id = generateSessionId();
    }
    try {
        const model = genAI.getGenerativeModel({
            model: validated.model,
        });
        // Get conversation history and convert to Gemini format
        const history = getConversationHistory(session_id);
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
        // Use systemInstruction as per Gemini API docs
        const result = await model.generateContent({
            contents: contents,
            systemInstruction: {
                role: 'system',
                parts: [
                    { text: SYSTEM_PROMPT }
                ]
            }
        });
        const response = await result.response;
        const answer = response.text() || 'No response generated';
        // Add to conversation history
        addToConversationHistory(session_id, 'user', validated.question);
        addToConversationHistory(session_id, 'assistant', answer);
        return {
            content: [
                {
                    type: 'text',
                    text: answer + `\n\nIf you want to continue this conversation, specify session_id=\"${session_id}\".`
                }
            ],
            session_id: session_id
        };
    } catch (error) {
        if (error.message?.includes('API_KEY')) {
            throw new Error('Google API key is invalid or missing. Please set GOOGLE_API_KEY environment variable.');
        }
        if (error.status === 429) {
            throw new Error('Google API rate limit exceeded. Please try again later.');
        }
        throw new Error(`Google API error: ${error.message}`);
    }
}

// Qwen handler (via OpenRouter)
async function handleQwenRequest(args) {
    const validated = AskQwenSchema.parse(args);
    let session_id = validated.session_id;
    if (!session_id || session_id === 'default') {
        session_id = generateSessionId();
    }

    try {
        // Get conversation history
        const history = getConversationHistory(session_id);

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

        const completion = await openrouter.chat.completions.create({
            model: validated.model,
            messages: messages,
        });

        const answer = completion.choices[0]?.message?.content || 'No response generated';

        // Add to conversation history
        addToConversationHistory(session_id, 'user', validated.question);
        addToConversationHistory(session_id, 'assistant', answer);

        return {
            content: [
                {
                    type: 'text',
                    text: answer + `\n\nIf you want to continue this conversation, specify session_id=\"${session_id}\".`
                }
            ],
            session_id: session_id
        };
    } catch (error) {
        if (error.status === 401) {
            throw new Error('OpenRouter API key is invalid or missing. Please set OPENROUTER_API_KEY environment variable.');
        }
        if (error.status === 429) {
            throw new Error('OpenRouter API rate limit exceeded. Please try again later.');
        }
        throw new Error(`OpenRouter API error: ${error.message}`);
    }
}

// Clear conversation handler
async function handleClearConversation(args) {
    const validated = ClearConversationSchema.parse(args);

    conversations.delete(validated.session_id);

    return {
        content: [
            {
                type: 'text',
                text: `Conversation history cleared for session: ${validated.session_id}\n\nIf you want to start a new conversation, specify session_id=\"${validated.session_id}\".`
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
