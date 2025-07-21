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


// Initialize clients
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Validation schemas
const AskGPTSchema = z.object({
    question: z.string(),
    model: z.string().optional().default('gpt-4o-2024-11-20'),
    max_tokens: z.number().positive().optional().default(4000),
});

const AskClaudeSchema = z.object({
    question: z.string(),
    model: z.string().optional().default('claude-sonnet-4-20250514'),
    max_tokens: z.number().positive().optional().default(4000),
});

const AskGeminiSchema = z.object({
    question: z.string(),
    model: z.string().optional().default('gemini-2.5-flash'),
    max_tokens: z.number().positive().optional().default(4000),
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
                        max_tokens: {
                            type: 'number',
                            description: 'Maximum tokens in response',
                            default: 4000
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
                        max_tokens: {
                            type: 'number',
                            description: 'Maximum tokens in response',
                            default: 4000
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
                        max_tokens: {
                            type: 'number',
                            description: 'Maximum tokens in response',
                            default: 4000
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

    try {
        const completion = await openai.chat.completions.create({
            model: validated.model,
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: validated.question
                }
            ],
            max_tokens: validated.max_tokens,
        });

        const answer = completion.choices[0]?.message?.content || 'No response generated';

        return {
            content: [
                {
                    type: 'text',
                    text: answer
                }
            ]
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

    try {
        const message = await anthropic.messages.create({
            model: validated.model,
            max_tokens: validated.max_tokens,
            system: SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: validated.question
                }
            ]
        });

        const answer = message.content[0]?.text || 'No response generated';

        return {
            content: [
                {
                    type: 'text',
                    text: answer
                }
            ]
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

    try {
        const model = genAI.getGenerativeModel({
            model: validated.model,
            generationConfig: {
                maxOutputTokens: validated.max_tokens,
            }
        });

        // Use systemInstruction as per Gemini API docs
        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: validated.question }
                    ]
                }
            ],
            systemInstruction: {
                role: 'system',
                parts: [
                    { text: SYSTEM_PROMPT }
                ]
            }
        });
        const response = await result.response;
        const answer = response.text() || 'No response generated';

        return {
            content: [
                {
                    type: 'text',
                    text: answer
                }
            ]
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