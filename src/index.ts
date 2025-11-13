/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { TelegramMessageTitle, sendMessageToTelegram } from './telegramService';
import { Env } from './types';
import { handleFetch } from './handlers/httpHandlers';
import { handleScheduled } from './handlers/scheduledHandlers';

type ErrorContext = Record<string, unknown>;

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  const message =
    typeof error === 'string'
      ? error
      : `Unknown error: ${JSON.stringify(error, null, 2)}`;
  return new Error(message);
}

async function notifyWorkerError(
  env: Env,
  context: ErrorContext,
  error: unknown,
): Promise<ErrorContext & { message: string; stack?: string }> {
  const normalizedError = normalizeError(error);
  const logInfo = {
    ...context,
    message: normalizedError.message,
    stack: normalizedError.stack,
  };

  await sendMessageToTelegram(
    {
      chat_id: env.TELEGRAM_CHAT_ID,
      text: `${TelegramMessageTitle.ErrorDetected} \n${JSON.stringify(logInfo, null, 2)}`,
    },
    env,
  );

  return logInfo;
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleFetch(req, env);
    } catch (error) {
      const logInfo = await notifyWorkerError(
        env,
        {
          method: req.method,
          pathName: new URL(req.url).pathname,
        },
        error,
      );
      return new Response(`Error: ${logInfo.message}`, { status: 500 });
    }
  },

  // The scheduled handler is invoked at the interval set in our wrangler.jsonc's
  // [[triggers]] configuration.
  async scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      await handleScheduled(controller, env);
    } catch (error) {
      await notifyWorkerError(
        env,
        {
          cron: controller.cron,
          scheduledTime: controller.scheduledTime,
        },
        error,
      );
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
