import { Page } from 'playwright';
import { AppConfig, Selectors } from '../models/config';
import { logger } from './logger.service';
import { BrowserService } from './browser.service';

export class AuthService {
  private page: Page;
  private config: AppConfig;
  private selectors: Selectors;
  private browserService: BrowserService;

  constructor(page: Page, config: AppConfig, selectors: Selectors, browserService: BrowserService) {
    this.page = page;
    this.config = config;
    this.selectors = selectors;
    this.browserService = browserService;
  }

  async login(): Promise<boolean> {
    try {
      // Tentar usar cookies salvos primeiro
      const cookiesLoaded = await this.browserService.loadCookies();

      if (cookiesLoaded) {
        logger.info('Cookies encontrados, tentando autenticação via cookies');
        await this.page.goto(this.config.sei.baseUrl, { waitUntil: 'domcontentloaded' });
        await this.page.waitForLoadState('networkidle', { timeout: 10000 });

        const isAuthenticated = await this.isAuthenticated();

        if (isAuthenticated) {
          logger.success('Autenticado com sucesso usando cookies salvos');
          return true;
        } else {
          logger.info('Cookies expirados ou inválidos, realizando login manual');
        }
      } else {
        logger.info('Nenhum cookie salvo encontrado, realizando login manual');
      }

      logger.info('Navegando para página de login do SEI');
      await this.page.goto(this.config.sei.baseUrl, { waitUntil: 'domcontentloaded' });

      logger.debug('Aguardando carregamento da página de login');
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });

      const orgaoSelector = '#selOrgao';
      const hasOrgaoField = await this.page.locator(orgaoSelector).count() > 0;

      if (hasOrgaoField) {
        logger.debug('Selecionando órgão');
        await this.page.selectOption(orgaoSelector, { label: this.config.sei.orgao });
      }

      logger.debug('Preenchendo credenciais');
      await this.page.fill(this.selectors.login.usernameField, this.config.sei.username);
      await this.page.fill(this.selectors.login.passwordField, this.config.sei.password);

      logger.debug('Tentando submeter o formulário');

      const submitButtonExists = await this.page.locator(this.selectors.login.submitButton).count();
      logger.debug(`Botão de submit encontrado: ${submitButtonExists > 0}`);

      if (submitButtonExists > 0) {
        await this.page.click(this.selectors.login.submitButton);
      } else {
        logger.warn('Botão de submit não encontrado, tentando pressionar Enter');
        await this.page.press(this.selectors.login.passwordField, 'Enter');
      }

      logger.debug('Aguardando navegação pós-login (15s timeout)');
      try {
        await Promise.race([
          this.page.waitForNavigation({ timeout: 15000 }),
          this.page.waitForURL(url => !url.toString().includes('login'), { timeout: 15000 }),
          this.page.waitForLoadState('networkidle', { timeout: 15000 }),
        ]);
      } catch (navError) {
        logger.warn('Timeout na navegação, verificando se login foi bem-sucedido mesmo assim');
      }

      const isAuthenticated = await this.isAuthenticated();

      if (isAuthenticated) {
        logger.success('Login realizado com sucesso');

        // Salvar cookies para sessões futuras
        await this.browserService.saveCookies();
        logger.info('Cookies salvos para próximas sessões');

        return true;
      } else {
        logger.error('Falha no login: não foi possível verificar autenticação');

        const currentUrl = this.page.url();
        logger.debug(`URL atual: ${currentUrl}`);

        return false;
      }
    } catch (error) {
      logger.error('Erro durante o processo de login', { error });

      const errorMessageElement = await this.page.locator(this.selectors.login.errorMessage).count();
      if (errorMessageElement > 0) {
        const errorText = await this.page.locator(this.selectors.login.errorMessage).textContent();
        logger.error('Mensagem de erro do SEI', { errorText });
      }

      return false;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const loginButtonExists = await this.page.locator(this.selectors.login.submitButton).count();
      return loginButtonExists === 0;
    } catch (error) {
      logger.warn('Erro ao verificar autenticação', { error });
      return false;
    }
  }
}
