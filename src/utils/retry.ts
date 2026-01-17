import { logger } from '../services/logger.service';

export interface RetryConfig {
  maxRetries: number;
  delayMs: number;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  operationName: string = 'Operation'
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      logger.debug(`${operationName}: Attempt ${attempt}/${config.maxRetries}`);
      const result = await operation();
      if (attempt > 1) {
        logger.info(`${operationName}: Succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error as Error;
      logger.warn(`${operationName}: Failed on attempt ${attempt}/${config.maxRetries}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      if (attempt < config.maxRetries) {
        const delay = config.delayMs * Math.pow(2, attempt - 1);
        logger.debug(`${operationName}: Waiting ${delay}ms before retry`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `${operationName}: Failed after ${config.maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
