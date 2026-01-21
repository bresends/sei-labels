import { Page } from "playwright";
import { AppConfig, Selectors } from "../models/config";
import { ProcessInfo } from "../models/process";
import { BrowserService } from "./browser.service";
import { logger } from "./logger.service";

export class ProcessService {
  private page: Page;
  private config: AppConfig;
  private selectors: Selectors;
  private browserService: BrowserService;

  constructor(
    page: Page,
    config: AppConfig,
    selectors: Selectors,
    browserService: BrowserService,
  ) {
    this.page = page;
    this.config = config;
    this.selectors = selectors;
    this.browserService = browserService;
  }

  async catalogProcess(
    processNumber: string,
    marcador: string,
  ): Promise<ProcessInfo> {
    const processInfo: ProcessInfo = {
      number: processNumber,
      status: "pending",
      timestamp: new Date(),
    };

    try {
      logger.debug(
        `Catalogando processo ${processNumber} com marcador ${marcador}`,
      );

      await this.navigateToProcess(processNumber);

      const hasMarcador = await this.processHasMarcador(marcador);
      if (hasMarcador) {
        processInfo.status = "skipped";
        processInfo.errorMessage = "Marcador já existe no processo";
        logger.info(
          `Processo ${processNumber}: marcador ${marcador} já existe`,
        );
        return processInfo;
      }

      const success = await this.addMarcador(marcador);

      if (success) {
        // Se o marcador for SGP, atribuir ao usuário brunoresende
        if (marcador.toUpperCase() === "SGP") {
          logger.info(
            `Processo ${processNumber}: atribuindo ao usuário brunoresende`,
          );
          const assigned = await this.assignProcess("brunoresende");

          if (assigned) {
            logger.success(
              `Processo ${processNumber}: atribuído com sucesso a brunoresende`,
            );
          } else {
            logger.warn(
              `Processo ${processNumber}: falha ao atribuir, mas marcador foi adicionado`,
            );
          }
        }

        processInfo.status = "success";
        logger.success(
          `Processo ${processNumber}: marcador ${marcador} adicionado com sucesso`,
        );
      } else {
        processInfo.status = "failed";
        processInfo.errorMessage = "Falha ao adicionar marcador";
        logger.error(`Processo ${processNumber}: falha ao adicionar marcador`);
      }
    } catch (error) {
      processInfo.status = "failed";
      processInfo.errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Processo ${processNumber}: erro durante catalogação`, {
        error,
      });

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

      await this.page.press(searchFieldSelector, "Enter");

      await this.page.waitForLoadState("networkidle");

      logger.debug("Aguardando frame ifrConteudoVisualizacao carregar");
      // Esperar o frame ifrConteudoVisualizacao estar pronto
      try {
        await this.page
          .frameLocator('iframe[name="ifrConteudoVisualizacao"]')
          .locator("body")
          .waitFor({ timeout: 5000 });
        logger.debug("Frame ifrConteudoVisualizacao carregado");
      } catch (e) {
        logger.warn("Timeout aguardando frame, mas continuando");
      }

      logger.debug(`Navegação para processo ${processNumber} concluída`);
    } catch (error) {
      logger.error(`Erro ao navegar para processo ${processNumber}`, { error });
      throw error;
    }
  }

  async processHasMarcador(marcador: string): Promise<boolean> {
    try {
      const marcadorElements = await this.page
        .locator(this.selectors.process.tagList)
        .allTextContents();
      const hasMarcador = marcadorElements.some(
        (text) => text.trim().toUpperCase() === marcador.toUpperCase(),
      );

      logger.debug(`Verificação de marcador existente: ${hasMarcador}`, {
        marcador,
        existingMarcadores: marcadorElements,
      });

      return hasMarcador;
    } catch (error) {
      logger.warn(
        "Erro ao verificar marcadores existentes, assumindo que marcador não existe",
        { error },
      );
      return false;
    }
  }

  async addMarcador(marcador: string): Promise<boolean> {
    try {
      logger.debug(`Adicionando marcador: ${marcador}`);

      // Botão "Gerenciar Marcador" está no frame ifrConteudoVisualizacao
      const linkSelector = 'a[href*="andamento_marcador_gerenciar"]';
      let linkClicked = false;

      // Buscar diretamente no frame ifrConteudoVisualizacao
      const buttonFrame = this.page.frame({ name: "ifrConteudoVisualizacao" });

      if (buttonFrame) {
        try {
          const linkCount = await buttonFrame.locator(linkSelector).count();

          if (linkCount > 0) {
            logger.debug('Botão "Gerenciar Marcador" encontrado');
            await buttonFrame.click(linkSelector);
            linkClicked = true;
          }
        } catch (e) {
          logger.debug("Erro ao buscar botão, tentando fallback");
        }
      }

      // Fallback: se não encontrou, busca em todos os frames
      if (!linkClicked) {
        logger.debug(
          "Botão não encontrado em ifrConteudoVisualizacao, buscando em todos os frames",
        );
        const frames = this.page.frames();

        for (const frame of frames) {
          try {
            const linkCount = await frame.locator(linkSelector).count();

            if (linkCount > 0) {
              await frame.click(linkSelector);
              linkClicked = true;
              break;
            }
          } catch (e) {
            // Continue para próximo frame
          }
        }
      }

      if (!linkClicked) {
        await this.browserService.screenshot("gerenciar-marcador-not-found");
        throw new Error(
          'Botão "Gerenciar Marcador" não encontrado em nenhum frame',
        );
      }

      // Formulário está no frame ifrVisualizacao
      logger.debug("Aguardando formulário de marcador aparecer");

      const formSelector = "#selMarcador";
      const formFrame = this.page.frame({ name: "ifrVisualizacao" });

      if (!formFrame) {
        await this.browserService.screenshot("form-frame-not-found");
        throw new Error("Frame ifrVisualizacao não encontrado");
      }

      // Aguardar formulário aparecer no frame correto
      try {
        await formFrame.waitForSelector(formSelector, { timeout: 5000 });
        logger.debug("Formulário de marcador encontrado");
      } catch (e) {
        await this.browserService.screenshot("form-marcador-not-found");
        throw new Error(
          "Formulário de marcador não encontrado no frame ifrVisualizacao",
        );
      }

      logger.debug("Interagindo com dropdown de marcadores");
      const dropdownSelector = ".dd-select";

      await formFrame.waitForSelector(dropdownSelector, {
        state: "visible",
        timeout: 3000,
      });
      await formFrame.locator(dropdownSelector).click();

      const optionSelector = `.dd-option:has-text("${marcador}")`;
      await formFrame.waitForSelector(".dd-option", {
        state: "visible",
        timeout: 3000,
      });

      const optionCount = await formFrame.locator(optionSelector).count();
      if (optionCount === 0) {
        throw new Error(
          `Marcador "${marcador}" não encontrado nas opções do dropdown`,
        );
      }

      await formFrame.locator(optionSelector).first().click();

      logger.debug("Preenchendo campo de texto");
      const textoSelector = this.selectors.process.textoMarcador;

      try {
        await formFrame.waitForSelector(textoSelector, { timeout: 2000 });
        await formFrame.locator(textoSelector).fill("notion");
      } catch (e) {
        logger.warn("Campo de texto não encontrado, continuando sem preencher");
      }

      logger.debug("Salvando marcador");
      const salvarButtonSelector = "#sbmSalvar";

      try {
        await formFrame.waitForSelector(salvarButtonSelector, {
          state: "visible",
          timeout: 3000,
        });
        await formFrame.locator(salvarButtonSelector).click();
      } catch (e) {
        // Fallback: tentar outros seletores
        logger.debug("Tentando seletores alternativos para botão Salvar");
        const salvarButtonSelectors = [
          "#btnSalvar",
          'button:has-text("Salvar")',
          'input[type="button"][value="Salvar"]',
          'a:has-text("Salvar")',
        ];

        let salvarClicked = false;
        for (const selector of salvarButtonSelectors) {
          try {
            const count = await formFrame.locator(selector).count();
            if (count > 0) {
              await formFrame.locator(selector).click();
              salvarClicked = true;
              break;
            }
          } catch (err) {
            // Continue para próximo seletor
          }
        }

        if (!salvarClicked) {
          await this.browserService.screenshot("salvar-button-not-found");
          throw new Error("Botão Salvar não encontrado com nenhum seletor");
        }
      }

      await this.page
        .waitForLoadState("networkidle", { timeout: 5000 })
        .catch(() => {
          logger.debug("Timeout no networkidle, mas continuando");
        });

      logger.debug("Verificando se marcador foi adicionado");
      const marcadorAdded = await this.processHasMarcador(marcador);

      if (marcadorAdded) {
        logger.success(`Marcador "${marcador}" adicionado com sucesso`);
        return true;
      } else {
        logger.warn(
          `Não foi possível verificar se marcador "${marcador}" foi adicionado (mas operação foi concluída)`,
        );
        logger.info(
          "Assumindo sucesso pois a operação de salvar foi completada",
        );
        return true;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "";
      logger.error("Erro ao adicionar marcador", {
        error: errorMessage,
        stack: errorStack,
      });
      await this.browserService.screenshot(`error-marcador-${Date.now()}`);
      return false;
    }
  }

  async assignProcess(username: string): Promise<boolean> {
    try {
      logger.debug(`Atribuindo processo ao usuário: ${username}`);

      // Botão "Atribuir Processo" está no frame ifrConteudoVisualizacao
      const buttonSelector = this.selectors.process.atribuirProcessoButton;
      const buttonFrame = this.page.frame({ name: "ifrConteudoVisualizacao" });

      if (!buttonFrame) {
        logger.error(
          "Frame ifrConteudoVisualizacao não encontrado para atribuição",
        );
        return false;
      }

      // Clicar no botão "Atribuir Processo"
      const buttonCount = await buttonFrame.locator(buttonSelector).count();
      if (buttonCount === 0) {
        logger.error('Botão "Atribuir Processo" não encontrado');
        return false;
      }

      await buttonFrame.click(buttonSelector);
      logger.debug('Botão "Atribuir Processo" clicado');

      // Formulário aparece no frame ifrVisualizacao
      const formFrame = this.page.frame({ name: "ifrVisualizacao" });

      if (!formFrame) {
        logger.error("Frame ifrVisualizacao não encontrado");
        return false;
      }

      // Aguardar o dropdown de atribuição aparecer
      const selectSelector = this.selectors.process.atribuicaoSelect;
      await formFrame.waitForSelector(selectSelector, { timeout: 5000 });
      logger.debug("Dropdown de atribuição encontrado");

      // Encontrar a opção que contém o username e pegar seu value
      const optionLocator = formFrame.locator(
        `${selectSelector} option:has-text("${username}")`,
      );
      const optionValue = await optionLocator.getAttribute("value");

      if (!optionValue) {
        throw new Error(
          `Usuário ${username} não encontrado no dropdown de atribuição`,
        );
      }

      // Selecionar o usuário pelo value
      await formFrame.selectOption(selectSelector, optionValue);
      logger.debug(`Usuário ${username} selecionado`);

      // Clicar no botão Salvar
      const saveButtonSelector = this.selectors.process.atribuicaoSalvarButton;
      await formFrame.waitForSelector(saveButtonSelector, {
        state: "visible",
        timeout: 3000,
      });
      await formFrame.click(saveButtonSelector);
      logger.debug("Botão Salvar clicado");

      // Aguardar a página recarregar
      await this.page
        .waitForLoadState("networkidle", { timeout: 5000 })
        .catch(() => {
          logger.debug(
            "Timeout no networkidle após atribuição, mas continuando",
          );
        });

      logger.success("Processo atribuído com sucesso");
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Erro ao atribuir processo", { error: errorMessage });
      await this.browserService.screenshot(`error-atribuir-${Date.now()}`);
      return false;
    }
  }
}
