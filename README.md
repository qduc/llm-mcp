# LLM MCP Server

A Model Context Protocol (MCP) server that enables AI clients to query multiple Large Language Models (OpenAI GPT, Anthropic Claude, and Google Gemini) through a unified interface.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- API keys for the LLM providers you want to use:
  - OpenAI API key (for GPT models)
  - Anthropic API key (for Claude models)
  - Google API key (for Gemini models)

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

## Usage

This MCP server provides three tools for querying different AI models:

- `ask_gpt` - Query OpenAI GPT models (default: gpt-4o-2024-11-20)
- `ask_claude` - Query Anthropic Claude models (default: claude-4-sonnet)
- `ask_gemini` - Query Google Gemini models (default: gemini-2.5-flash)

### Available Tools

Each tool accepts the following parameters:
- `question` (required): The question to ask the AI model
- `model` (optional): Specific model to use (defaults provided)
- `max_tokens` (optional): Maximum tokens in response (default: 4000)

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
            "GOOGLE_API_KEY": "your-google-key"
        }
    }
}
```
You only need API keys for the models you plan to use.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

ISC
