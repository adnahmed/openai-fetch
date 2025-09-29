# OpenAI Fetch Client

[![Build Status](https://github.com/rileytomasek/openai-fetch/actions/workflows/main.yml/badge.svg)](https://github.com/rileytomasek/openai-fetch/actions/workflows/main.yml) [![npm version](https://img.shields.io/npm/v/openai-fetch.svg?color=0c0)](https://www.npmjs.com/package/openai-fetch)

A minimal and opinionated OpenAI client powered by native fetch. Uses `@toss/ky` (CJS + ESM build of `ky`) for retries & hooks while remaining lightweight.

Unfortunately, the official [openai](https://github.com/openai/openai-node) package patches fetch in problematic ways and is quite bloated.

## Reasons to consider using `openai-fetch`

- You want a fast and small client that doesn't patch fetch
- Supports all envs with native fetch: Node 18+, browsers, Deno, Cloudflare Workers, etc
- Package size: `openai-fetch` is [~14kb](https://bundlephobia.com/package/openai-fetch) and `openai` is [~152kb](https://bundlephobia.com/package/openai)
- You only need chat, completions, embeddings, and moderations, and TTS

## Use the official `openai` package if

- Your runtime doesn't have native fetch support
- You need endpoints other than chat, completions, embeddings, and moderations, and TTS
- You aren't concerned with lib size or fetch patching

## Install

```bash
npm install openai-fetch
```

This package requires `node >= 18` or an environment with `fetch` support.

## Usage

```js
const { OpenAIClient } = require('openai-fetch');

const client = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
```

The `apiKey` is optional and will be read from `process.env.OPENAI_API_KEY` if present.

### Configuration Options

You can pass `kyOptions` (name retained for backwards compatibility) containing:

```ts
{
  headers?: Record<string,string>;
  timeout?: number;                 // ms (default 10 minutes)
  retry?: {
    retries?: number;               // maps to ky.retry.limit (default 3)
    methods?: string[];             // optional override of retry methods
    statusCodes?: number[];         // optional override of retry status codes
    delay?: (attempt:number)=>number; // custom backoff (ms); overrides internal quadratic + jitter
  };
  hooks?: {
    beforeRequest?: Array<(req: Request)=>any|Promise<any>>;
    afterResponse?: Array<(req: Request, options: any, res: Response)=>any|Promise<any>>;
    beforeError?: Array<(err:any)=>any>;
  };
  prefixUrl?: string;               // alternative base URL (overridden by constructor baseUrl)
}
```
Internally these map directly to an `@toss/ky.create()` instance.


## API

The API follows OpenAI very closely, so their [reference documentation](https://platform.openai.com/docs/api-reference) can generally be used. Everything is strongly typed, so you will know if anything is different as soon as TypeScript parses your code.

```ts
// Generate a single chat completion
client.createChatCompletion(params: ChatParams): Promise<ChatResponse>;

// Stream a single completion via a ReadableStream
client.streamChatCompletion(params: ChatStreamParams): Promise<ChatStreamResponse>;

// Generate one or more completions
client.createCompletions(params: CompletionParams): Promise<CompletionResponse>;

// Stream a single completion via a ReadableStream
client.streamCompletion(params: CompletionStreamParams): Promise<CompletionStreamResponse>;

// Generate one or more embeddings
client.createEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse>

// Checks for potentially harmful content
client.createModeration(params: ModerationParams): Promise<ModerationResponse>

// Text-to-Speech
client.createSpeech(params: SpeechParams): Promise<SpeechResponse>
```

## Type Definitions

The type definitions are available via the published `dist/*.d.ts` files and surfaced automatically by TypeScript / editors.

## License

MIT © [Dexa](https://dexa.ai)
