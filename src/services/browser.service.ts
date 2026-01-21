import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Browser, BrowserContext, chromium, Page } from "playwright";
import { AppConfig } from "../models/config";
import { logger } from "./logger.service";

export class BrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  private findBrowserExecutable(): string | undefined {
    // Check environment variable first
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      if (fs.existsSync(envPath)) {
        return envPath;
      }
    }

    // Use 'which' to find browser in system PATH
    const browsers = ["google-chrome-stable", "google-chrome"];

    return browsers
      .map((browser) => {
        try {
          return execSync(`which ${browser}`, { encoding: "utf-8" }).trim();
        } catch {
          return null;
        }
      })
      .find((path) => path !== null);
  }

  async initialize(headless: boolean = false): Promise<void> {
    try {
      logger.debug("Initializing Playwright browser", { headless });

      const launchOptions: any = {
        headless,
        slowMo: this.config.browser.slowMo,
      };

      // Try to find system browser
      const browserPath = this.findBrowserExecutable();
      if (!browserPath) {
        throw new Error(
          "Google Chrome not found in system PATH.\n" +
            "Please install Google Chrome or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH environment variable.",
        );
      }

      launchOptions.executablePath = browserPath;
      logger.debug(`Using system browser from: ${browserPath}`);

      this.browser = await chromium.launch(launchOptions);

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      this.context.setDefaultTimeout(this.config.browser.timeout);

      logger.debug("Browser initialized successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to initialize browser", { error: errorMessage });

      if (errorMessage.includes("Executable doesn't exist")) {
        throw new Error(
          "Playwright browsers not installed. Please run: npx playwright install chromium",
        );
      }

      throw new Error(`Failed to initialize browser: ${errorMessage}`);
    }
  }

  async createPage(): Promise<Page> {
    if (!this.context) {
      throw new Error(
        "Browser context not initialized. Call initialize() first.",
      );
    }

    this.page = await this.context.newPage();
    logger.debug("New page created");

    return this.page;
  }

  async screenshot(name: string): Promise<void> {
    if (!this.page) {
      logger.warn("Cannot take screenshot: no page available");
      return;
    }

    try {
      const screenshotDir = path.join(process.cwd(), "screenshots");
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${name}-${timestamp}.png`;
      const filepath = path.join(screenshotDir, filename);

      await this.page.screenshot({ path: filepath, fullPage: true });
      logger.info(`Screenshot saved: ${filepath}`);
    } catch (error) {
      logger.error("Failed to take screenshot", { error });
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      logger.debug("Browser closed successfully");
    } catch (error) {
      logger.error("Error closing browser", { error });
    }
  }

  getPage(): Page | null {
    return this.page;
  }

  async saveCookies(): Promise<void> {
    if (!this.context) {
      logger.warn("Cannot save cookies: no browser context available");
      return;
    }

    try {
      const cookiesDir = path.join(process.cwd(), ".cache");
      if (!fs.existsSync(cookiesDir)) {
        fs.mkdirSync(cookiesDir, { recursive: true });
      }

      const cookiesPath = path.join(cookiesDir, "sei-cookies.json");
      const cookies = await this.context.cookies();

      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
      logger.debug("Cookies saved successfully");
    } catch (error) {
      logger.error("Failed to save cookies", { error });
    }
  }

  async loadCookies(): Promise<boolean> {
    if (!this.context) {
      logger.warn("Cannot load cookies: no browser context available");
      return false;
    }

    try {
      const cookiesPath = path.join(
        process.cwd(),
        ".cache",
        "sei-cookies.json",
      );

      if (!fs.existsSync(cookiesPath)) {
        logger.debug("No saved cookies found");
        return false;
      }

      const cookiesContent = fs.readFileSync(cookiesPath, "utf-8");
      const cookies = JSON.parse(cookiesContent);

      await this.context.addCookies(cookies);
      logger.debug("Cookies loaded successfully");
      return true;
    } catch (error) {
      logger.error("Failed to load cookies", { error });
      return false;
    }
  }
}
