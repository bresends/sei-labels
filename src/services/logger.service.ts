import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private logFilePath: string;
  private logLevel: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.logLevel = level;
    const timestamp = new Date().toISOString().split('T')[0];
    this.logFilePath = path.join(process.cwd(), 'logs', `sei-labels-${timestamp}.log`);

    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(this.logFilePath, message + '\n', 'utf-8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  debug(message: string, data?: any): void {
    if (!this.shouldLog('debug')) return;
    const formattedMessage = this.formatMessage('debug', message, data);
    console.log(chalk.gray(formattedMessage));
    this.writeToFile(formattedMessage);
  }

  info(message: string, data?: any): void {
    if (!this.shouldLog('info')) return;
    const formattedMessage = this.formatMessage('info', message, data);
    console.log(chalk.blue(formattedMessage));
    this.writeToFile(formattedMessage);
  }

  warn(message: string, data?: any): void {
    if (!this.shouldLog('warn')) return;
    const formattedMessage = this.formatMessage('warn', message, data);
    console.log(chalk.yellow(formattedMessage));
    this.writeToFile(formattedMessage);
  }

  error(message: string, data?: any): void {
    if (!this.shouldLog('error')) return;
    const formattedMessage = this.formatMessage('error', message, data);
    console.log(chalk.red(formattedMessage));
    this.writeToFile(formattedMessage);
  }

  success(message: string, data?: any): void {
    const formattedMessage = this.formatMessage('info', message, data);
    console.log(chalk.green(formattedMessage));
    this.writeToFile(formattedMessage);
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}

export const logger = new Logger();
