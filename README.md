# LLM MCP Server

A Model Context Protocol (MCP) server that enables AI clients to query multiple Large Language Models (OpenAI GPT, Anthropic Claude, and Google Gemini) through a unified interface.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- API keys for the LLM providers you want to use:
  - OpenAI API key (for GPT models)
  - Anthropic API key (for Claude models)
  - Google API key (for Gemini models)
  - OpenRouter API key (for Qwen models)

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

## Usage

This MCP server provides four tools for querying different AI models:

- `ask_gpt` - Query OpenAI GPT models (default: gpt-4o-2024-11-20)
- `ask_claude` - Query Anthropic Claude models (default: claude-4-sonnet)
- `ask_gemini` - Query Google Gemini models (default: gemini-2.5-flash)
- `ask_qwen` - Query Qwen models via OpenRouter (default: qwen/qwq-32b-preview)

### Available Tools

Each tool accepts the following parameters:
- `question` (required): The question to ask the AI model
- `model` (optional): Specific model to use (defaults provided)
- `max_tokens` (optional): Maximum tokens in response (default: 4000)
- `session_id` (optional): Session ID for conversation memory

### Recommended Models

**OpenAI GPT (`ask_gpt`)**:
- `gpt-4o-2024-11-20` (default) - Latest GPT-4 model
- `o3` - Reasoning model for complex problems
- `o4-mini` - Faster reasoning model

**Anthropic Claude (`ask_claude`)**:
- `claude-sonnet-4-20250514` (default) - Balanced performance
- `claude-3-5-haiku-20241022` - Speed optimized

**Google Gemini (`ask_gemini`)**:
- `gemini-2.5-flash` (default) - Price/performance balance
- `gemini-2.5-pro` - Complex problems
- `gemini-2.5-flash-lite` - Speed/cost optimized

**Qwen via OpenRouter (`ask_qwen`)**:
- `qwen/qwq-32b-preview` (default) - Reasoning tasks
- `qwen/qwen-2.5-72b-instruct` - General tasks

### Connecting to MCP Clients

This server is designed to work with MCP-compatible clients like Claude Desktop. Add it to your MCP client configuration to access the LLM querying tools.

```json
{
    "ask-llm": {
        "command": "node",
        "args": [
            "path/to/llm-mcp/index.js"
        ],
        "env": {
            "OPENAI_API_KEY": "your-openai-key",
            "ANTHROPIC_API_KEY": "your-anthropic-key",
            "GOOGLE_API_KEY": "your-google-key",
            "OPENROUTER_API_KEY": "your-openrouter-key"
        }
    }
}
```
You only need API keys for the models you plan to use.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

ISC
