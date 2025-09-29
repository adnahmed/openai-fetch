import ky, { type KyInstance, type Options } from '@toss/ky';

import { APIError, castToError } from './errors.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export interface KyOptions extends Omit<Options, 'credentials'> {
  credentials?: 'include' | 'omit' | 'same-origin';
}

// Internal adapter interface expected by OpenAIClient (subset of previous ApiInstance)
interface ApiInstanceAdapter {
  post: (
    path: string,
    opts: {
      json?: any;
      body?: any;
      headers?: Record<string, any>;
      signal?: AbortSignal;
      onDownloadProgress?: () => void;
    }
  ) => Promise<{
    json: <T = any>() => Promise<T>;
    text: () => Promise<string>;
    arrayBuffer: () => Promise<ArrayBuffer>;
    body: ReadableStream;
    status: number;
    headers: Headers;
  }>;
  extend: (overrides: {
    headers?: Record<string, any>;
    signal?: AbortSignal;
  }) => ApiInstanceAdapter;
}

export function createApiInstance(args: {
  apiKey: string;
  baseUrl?: string;
  organizationId?: string;
  kyOptions?: KyOptions;
}): ApiInstanceAdapter {
  const { apiKey, baseUrl, organizationId, kyOptions = {} } = args;
  const {
    headers,
    hooks = {},
    prefixUrl,
    retry,
    timeout,
    ...rest
  } = kyOptions as KyOptions & {
    hooks?: any;
  };

  if (!hooks.beforeError) hooks.beforeError = [];
  hooks.beforeError.push(async (error: any) => {
    const response: Response | undefined = error?.response;
    if (response) {
      const status = response.status;
      const hdrs = parseHeaders(response.headers);
      let errorResponse: any | undefined;
      let message: string | undefined;
      if (response.body) {
        const errText = await response
          .clone()
          .text()
          .catch((e) => castToError(e).message);
        errorResponse = safeJson(errText)?.error;
        message = errorResponse ? undefined : errText;
      }
      return new APIError(status, errorResponse, message, hdrs);
    }
    return APIError.generate(undefined, error, undefined, undefined);
  });

  const kyBase = ky.extend({
    prefixUrl: baseUrl || prefixUrl || DEFAULT_BASE_URL,
    headers: {
      'User-Agent': 'openai-fetch',
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      ...(organizationId && { 'OpenAI-Organization': organizationId }),
      ...headers,
    },
    retry: retry ?? {
      delay: (attemptCount: number) => {
        const INITIAL_DELAY = 0.3;
        const jitter = numberBetween(-0.3, 0.3);
        const sleep = INITIAL_DELAY * Math.pow(attemptCount - 1, 2);
        return (sleep + jitter) * 1000;
      },
    },
    timeout: timeout ?? 1000 * 60 * 10,
    hooks,
    ...rest,
  } as Options) as KyInstance;

  // Adapter that exposes the earlier "post" + "extend" API used by OpenAIClient
  const adapter: ApiInstanceAdapter = {
    post: async (path, opts) => {
      const res = await kyBase.post(path.replace(/^\//, ''), {
        // ky will ignore `json` if `body` is present
        json: opts.json,
        body: opts.body,
        headers: opts.headers,
        signal: opts.signal,
      });
      return {
        json: async () => res.json(),
        text: async () => res.text(),
        arrayBuffer: async () => res.arrayBuffer(),
        body: res.body as any,
        status: res.status,
        headers: res.headers,
      };
    },
    extend: (overrides) => {
      const mergedHeaders = {
        ...(headers || {}),
        ...(overrides?.headers || {}),
      };
      return createApiInstance({
        apiKey,
        baseUrl: (baseUrl || (prefixUrl as any) || DEFAULT_BASE_URL) as string,
        organizationId,
        kyOptions: { ...kyOptions, headers: mergedHeaders },
      });
    },
  };

  return adapter;
}

function parseHeaders(
  headers: HeadersInit | null | undefined
): Record<string, string> {
  try {
    return !headers
      ? {}
      : Symbol.iterator in headers
        ? Object.fromEntries(
            Array.from(headers as Iterable<string[]>).map((header) => [
              ...header,
            ])
          )
        : { ...headers };
  } catch (e) {
    return {};
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return undefined;
  }
}

function numberBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
