import { type OpenAI } from 'openai';

import { createApiInstance, type KyOptions } from './fetch-api.cjs';
import { StreamCompletionChunker } from './streaming.js';
import {
  type ChatParams,
  type ChatResponse,
  type ChatStreamParams,
  type ChatStreamResponse,
  type CompletionParams,
  type CompletionResponse,
  type CompletionStreamParams,
  type CompletionStreamResponse,
  type EmbeddingParams,
  type EmbeddingResponse,
  type ModerationParams,
  type ModerationResponse,
  type SpeechParams,
  type SpeechResponse,
  type TranscriptionParams,
  type TranscriptionResponse,
} from './types.js';

export type ConfigOpts = {
  /**
   * The API key used to authenticate with the OpenAI API.
   * @see https://platform.openai.com/account/api-keys
   */
  apiKey?: string;
  /**
   * The organization ID that should be billed for API requests.
   * This is only necessary if your API key is scoped to multiple organizations.
   * @see https://platform.openai.com/docs/api-reference/organization-optional
   */
  organizationId?: string;
  /**
   * The HTTP endpoint for the OpenAI API. You probably don't want to change this.
   * @default https://api.openai.com/v1
   */
  baseUrl?: string;
  /**
   * Options for the internal fetch wrapper (headers, timeout, retry, hooks).
   * Retains the name kyOptions for backwards compatibility with previous versions.
   */
  kyOptions?: KyOptions;
};

/** Override the default fetch wrapper options for a single request. */
type RequestOpts = {
  headers?: KyOptions['headers'];
  signal?: AbortSignal;
};

export class OpenAIClient {
  private api: ReturnType<typeof createApiInstance>;

  constructor(opts: ConfigOpts = {}) {
    const process = (globalThis as any).process || { env: {} };
    const apiKey = opts.apiKey || process.env.OPENAI_API_KEY;
    const organizationId = opts.organizationId || process.env.OPENAI_ORG_ID;
    if (!apiKey)
      throw new Error(
        'Missing OpenAI API key. Please provide one in the config or set the OPENAI_API_KEY environment variable.'
      );
    this.api = createApiInstance({
      apiKey,
      baseUrl: opts.baseUrl,
      organizationId,
      kyOptions: opts.kyOptions,
    });
  }

  private getApi(opts?: RequestOpts) {
    return opts ? this.api.extend(opts) : this.api;
  }

  /** Create a completion for a chat message. */
  async createChatCompletion(
    params: ChatParams,
    opts?: RequestOpts
  ): Promise<ChatResponse> {
    const chatResp = await this.getApi(opts).post('chat/completions', {
      json: params,
    });
    const response: OpenAI.ChatCompletion = await chatResp.json();
    return response;
  }

  /** Create a chat completion and stream back partial progress. */
  async streamChatCompletion(
    params: ChatStreamParams,
    opts?: RequestOpts
  ): Promise<ChatStreamResponse> {
    const response = await this.getApi(opts).post('chat/completions', {
      json: { ...params, stream: true },
      onDownloadProgress: () => {}, // trick ky to return ReadableStream.
    });
    const stream = response.body as ReadableStream;
    return stream.pipeThrough(
      new StreamCompletionChunker(
        (response: OpenAI.ChatCompletionChunk) => response
      )
    );
  }

  /** Create completions for an array of prompt strings. */
  async createCompletions(
    params: CompletionParams,
    opts?: RequestOpts
  ): Promise<CompletionResponse> {
    const compResp = await this.getApi(opts).post('completions', {
      json: params,
    });
    const response: OpenAI.Completion = await compResp.json();
    return response;
  }

  /** Create a completion for a single prompt string and stream back partial progress. */
  async streamCompletion(
    params: CompletionStreamParams,
    opts?: RequestOpts
  ): Promise<CompletionStreamResponse> {
    const response = await this.getApi(opts).post('completions', {
      json: { ...params, stream: true },
      onDownloadProgress: () => {}, // trick ky to return ReadableStream.
    });
    const stream = response.body as ReadableStream;
    return stream.pipeThrough(
      new StreamCompletionChunker((response: OpenAI.Completion) => response)
    );
  }

  /** Create an embedding vector representing the input text. */
  async createEmbeddings(
    params: EmbeddingParams,
    opts?: RequestOpts
  ): Promise<EmbeddingResponse> {
    const embResp = await this.getApi(opts).post('embeddings', {
      json: params,
    });
    const response: OpenAI.CreateEmbeddingResponse = await embResp.json();
    return response;
  }

  /** Given some input text, outputs if the model classifies it as potentially harmful across several categories. */
  async createModeration(
    params: ModerationParams,
    opts?: RequestOpts
  ): Promise<ModerationResponse> {
    const modResp = await this.getApi(opts).post('moderations', {
      json: params,
    });
    const response: OpenAI.ModerationCreateResponse = await modResp.json();
    return response;
  }

  /** Generates audio from the input text. Also known as TTS. */
  async createSpeech(
    params: SpeechParams,
    opts?: RequestOpts
  ): Promise<SpeechResponse> {
    const speechResp = await this.getApi(opts).post('audio/speech', {
      json: params,
    });
    return await speechResp.arrayBuffer();
  }

  /** Transcribes audio into the input language. */
  async createTranscription<
    F extends OpenAI.Audio.AudioResponseFormat | undefined =
      | OpenAI.Audio.AudioResponseFormat
      | undefined,
  >(
    params: TranscriptionParams<F>,
    opts?: RequestOpts
  ): Promise<TranscriptionResponse> {
    // Construct multipart/form-data
    const form = new FormData();

    // file is required
    // Accepts: Blob | File | ReadableStream | ArrayBuffer | Uint8Array | { data, name, type }
    const file: any = (params as any).file;
    if (!file) throw new Error('Transcription requires a file');

    // If user passes a plain object with data + name + type, construct a Blob
    if (file && !(file instanceof Blob) && file.data) {
      const blob = new Blob([file.data], { type: file.type || 'application/octet-stream' });
      form.append('file', blob, file.name || 'audio');
    } else if (file instanceof Blob) {
      // Blob/File already; append with optional name
      const maybeName = (file as any).name || 'audio';
      form.append('file', file, maybeName);
    } else if (file instanceof ArrayBuffer || ArrayBuffer.isView(file)) {
      const blob = new Blob([file as any], { type: 'application/octet-stream' });
      form.append('file', blob, 'audio');
    } else {
      // Fallback: try appending as-is
      form.append('file', file);
    }

    form.append('model', (params as any).model);

    if ((params as any).language) form.append('language', (params as any).language);
    if ((params as any).prompt) form.append('prompt', (params as any).prompt);
    if ((params as any).response_format)
      form.append('response_format', (params as any).response_format);
    if ((params as any).temperature != null)
      form.append('temperature', String((params as any).temperature));
    if ((params as any).timestamp_granularities)
      for (const g of (params as any).timestamp_granularities as string[]) {
        form.append('timestamp_granularities[]', g);
      }
    // non-typed fields supported by newer API versions
    if ((params as any).include)
      for (const inc of (params as any).include as string[]) {
        form.append('include[]', inc);
      }
    if ((params as any).stream != null)
      form.append('stream', String((params as any).stream));
    if ((params as any).chunking_strategy != null) {
      const cs = (params as any).chunking_strategy;
      form.append(
        'chunking_strategy',
        typeof cs === 'string' ? cs : JSON.stringify(cs)
      );
    }

    const resp = await this.getApi(opts).post('audio/transcriptions', {
      body: form,
      // Let the browser/ky set the correct Content-Type with boundary
      headers: {},
    });

    const rf = (params as any).response_format as
      | OpenAI.Audio.AudioResponseFormat
      | undefined;
    if (rf === 'text' || rf === 'srt' || rf === 'vtt') {
      return await resp.text();
    }
    return await resp.json<TranscriptionResponse>();
  }
}
