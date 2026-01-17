import * as dotenv from 'dotenv';
import * as path from 'path';
import { AppConfig } from '../models/config';

dotenv.config();

function getEnvVar(key: string, required: boolean = true, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;

  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value || '';
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }

  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    sei: {
      baseUrl: getEnvVar('SEI_BASE_URL'),
      username: getEnvVar('SEI_USERNAME'),
      password: getEnvVar('SEI_PASSWORD'),
      orgao: getEnvVar('SEI_ORGAO'),
      sectionTag: getEnvVar('SEI_SECTION_TAG'),
    },
    browser: {
      timeout: getEnvNumber('TIMEOUT_MS', 30000),
      slowMo: getEnvNumber('SLOW_MO_MS', 100),
    },
    retry: {
      maxRetries: getEnvNumber('MAX_RETRIES', 3),
      delayMs: getEnvNumber('RETRY_DELAY_MS', 2000),
    },
    logging: {
      level: getEnvVar('LOG_LEVEL', false, 'info'),
    },
  };
}

export const config = loadConfig();
