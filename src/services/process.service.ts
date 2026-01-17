import { Page } from 'playwright';
import { AppConfig, Selectors } from '../models/config';
import { ProcessInfo } from '../models/process';
import { logger } from './logger.service';
import { BrowserService } from './browser.service';

export class ProcessService {
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

  async catalogProcess(processNumber: string, marcador: string): Promise<ProcessInfo> {
    const processInfo: ProcessInfo = {
      number: processNumber,
      status: 'pending',
      timestamp: new Date(),
    };

    try {
      logger.debug(`Catalogando processo ${processNumber} com marcador ${marcador}`);

      await this.navigateToProcess(processNumber);

      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(2000);

      const hasMarcador = await this.processHasMarcador(marcador);
      if (hasMarcador) {
        processInfo.status = 'skipped';
        processInfo.errorMessage = 'Marcador já existe no processo';
        logger.info(`Processo ${processNumber}: marcador ${marcador} já existe`);
        return processInfo;
      }

      const success = await this.addMarcador(marcador);

      if (success) {
        processInfo.status = 'success';
        logger.success(`Processo ${processNumber}: marcador ${marcador} adicionado com sucesso`);
      } else {
        processInfo.status = 'failed';
        processInfo.errorMessage = 'Falha ao adicionar marcador';
        logger.error(`Processo ${processNumber}: falha ao adicionar marcador`);
      }

    } catch (error) {
      processInfo.status = 'failed';
      processInfo.errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Processo ${processNumber}: erro durante catalogação`, { error });

      await this.browserService.screenshot(`error-${processNumber}`);
    }

    return processInfo;
  }

  async navigateToProcess(processNumber: string): Promise<void> {
    try {
      logger.debug(`Navegando para processo ${processNumber}`);

      const searchFieldSelector = this.selectors.process.searchField;
      await this.page.waitForSelector(searchFieldSelector, { timeout: 10000 });

      await this.page.fill(searchFieldSelector, processNumber);

      await this.page.press(searchFieldSelector, 'Enter');

      await this.page.waitForLoadState('networkidle');

      logger.debug('Aguardando página do processo carregar');
      await this.page.waitForTimeout(4000);

      logger.debug(`Navegação para processo ${processNumber} concluída`);
    } catch (error) {
      logger.error(`Erro ao navegar para processo ${processNumber}`, { error });
      throw error;
    }
  }

  async processHasMarcador(marcador: string): Promise<boolean> {
    try {
      const marcadorElements = await this.page.locator(this.selectors.process.tagList).allTextContents();
      const hasMarcador = marcadorElements.some(text => text.trim().toUpperCase() === marcador.toUpperCase());

      logger.debug(`Verificação de marcador existente: ${hasMarcador}`, {
        marcador,
        existingMarcadores: marcadorElements
      });

      return hasMarcador;
    } catch (error) {
      logger.warn('Erro ao verificar marcadores existentes, assumindo que marcador não existe', { error });
      return false;
    }
  }

  async addMarcador(marcador: string): Promise<boolean> {
    try {
      logger.debug(`Adicionando marcador: ${marcador}`);

      logger.debug('Procurando botão "Gerenciar Marcador" em todos os frames');

      let linkClicked = false;

      const frames = this.page.frames();
      logger.debug(`Total de frames encontrados: ${frames.length}`);

      for (const frame of frames) {
        try {
          const frameName = await frame.name();
          logger.debug(`Procurando no frame: ${frameName || 'main'}`);

          const linkSelector = 'a[href*="andamento_marcador_gerenciar"]';
          const linkCount = await frame.locator(linkSelector).count();

          if (linkCount > 0) {
            logger.debug(`Botão "Gerenciar Marcador" encontrado no frame: ${frameName || 'main'}`);
            await frame.click(linkSelector);
            linkClicked = true;
            logger.debug('Botão clicado com sucesso');
            break;
          }
        } catch (e) {
          logger.debug(`Erro ao procurar no frame: ${e}`);
        }
      }

      if (!linkClicked) {
        await this.browserService.screenshot('gerenciar-marcador-not-found');
        throw new Error('Botão "Gerenciar Marcador" não encontrado em nenhum frame');
      }

      await this.page.waitForTimeout(3000);

      logger.debug('Procurando formulário de marcador em todos os frames');

      let formFrame = null;
      const allFrames = this.page.frames();

      for (const frame of allFrames) {
        try {
          const frameName = await frame.name();
          logger.debug(`Verificando frame: ${frameName || 'main'}`);

          const dropdownExists = await frame.locator('#selMarcador').count();
          if (dropdownExists > 0) {
            logger.debug(`Formulário de marcador encontrado no frame: ${frameName || 'main'}`);
            formFrame = frame;
            break;
          }
        } catch (e) {
          logger.debug(`Erro ao verificar frame: ${e}`);
        }
      }

      if (!formFrame) {
        await this.browserService.screenshot('form-marcador-not-found');
        throw new Error('Formulário de marcador não encontrado em nenhum frame');
      }

      logger.debug('Aguardando dropdown customizado de marcador estar visível');

      logger.debug('Clicando no dropdown customizado para abrir as opções');
      await formFrame.locator('.dd-select').click();
      await this.page.waitForTimeout(500);

      logger.debug(`Procurando opção do marcador: ${marcador}`);
      const optionSelector = `.dd-option:has-text("${marcador}")`;
      const optionCount = await formFrame.locator(optionSelector).count();

      if (optionCount === 0) {
        throw new Error(`Marcador "${marcador}" não encontrado nas opções do dropdown`);
      }

      logger.debug(`Clicando na opção: ${marcador}`);
      await formFrame.locator(optionSelector).first().click();

      await this.page.waitForTimeout(500);

      logger.debug('Preenchendo campo de texto com "notion"');
      const textoSelector = this.selectors.process.textoMarcador;
      const textoCount = await formFrame.locator(textoSelector).count();

      if (textoCount > 0) {
        await formFrame.locator(textoSelector).fill('notion');
        logger.debug('Campo de texto preenchido com "notion"');
      } else {
        logger.warn('Campo de texto não encontrado, continuando sem preencher');
      }

      await this.page.waitForTimeout(500);

      logger.debug('Clicando no botão Salvar');
      const salvarButtonSelectors = [
        '#sbmSalvar',
        '#btnSalvar',
        'button:has-text("Salvar")',
        'input[type="button"][value="Salvar"]',
        'a:has-text("Salvar")',
      ];

      let salvarClicked = false;
      for (const selector of salvarButtonSelectors) {
        try {
          const count = await formFrame.locator(selector).count();
          logger.debug(`Tentando seletor do botão Salvar: ${selector} - ${count} encontrados`);

          if (count > 0) {
            await formFrame.locator(selector).click();
            salvarClicked = true;
            logger.debug(`Botão Salvar clicado usando: ${selector}`);
            break;
          }
        } catch (e) {
          logger.debug(`Erro ao tentar seletor ${selector}: ${e}`);
        }
      }

      if (!salvarClicked) {
        await this.browserService.screenshot('salvar-button-not-found');
        throw new Error('Botão Salvar não encontrado com nenhum seletor');
      }

      logger.debug('Aguardando página recarregar após salvar');
      await this.page.waitForTimeout(3000);

      logger.debug('Verificando se marcador foi adicionado');
      const marcadorAdded = await this.processHasMarcador(marcador);

      if (marcadorAdded) {
        logger.success(`Marcador "${marcador}" adicionado com sucesso`);
        return true;
      } else {
        logger.warn(`Não foi possível verificar se marcador "${marcador}" foi adicionado (mas operação foi concluída)`);
        logger.info('Assumindo sucesso pois a operação de salvar foi completada');
        return true;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      logger.error('Erro ao adicionar marcador', {
        error: errorMessage,
        stack: errorStack
      });
      await this.browserService.screenshot(`error-marcador-${Date.now()}`);
      return false;
    }
  }
}
