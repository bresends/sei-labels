import chalk from "chalk";
import ora from "ora";
import { config } from "./config/environment";
import { ProcessInfo } from "./models/process";
import { AuthService } from "./services/auth.service";
import { BrowserService } from "./services/browser.service";
import { logger } from "./services/logger.service";
import { ProcessService } from "./services/process.service";
import { inputService } from "./utils/input.service";
import { retryWithBackoff } from "./utils/retry";
import { selectors } from "./utils/selectors";

export interface CLIOptions {
  headless?: boolean;
  debug?: boolean;
}

export async function cli(options: CLIOptions = {}): Promise<void> {
  const startTime = new Date();

  console.log(
    chalk.blue.bold("\n=== SEI Labels - Catalogação de Processos ===\n"),
  );

  const headless = options.headless || false;

  if (options.debug) {
    logger.info("Modo debug ativado");
  }

  try {
    const processes = await inputService.askProcessNumbers();
    const marcador = await inputService.selectMarcador();

    const proceed = await inputService.confirmExecution(processes.length);
    if (!proceed) {
      console.log(chalk.yellow("\nOperação cancelada pelo usuário."));
      return;
    }

    const browserService = new BrowserService(config);
    const spinner = ora("Inicializando browser...").start();

    await browserService.initialize(headless);
    const page = await browserService.createPage();
    spinner.succeed("Browser inicializado");

    spinner.start("Autenticando no SEI...");
    const authService = new AuthService(
      page,
      config,
      selectors,
      browserService,
    );
    const authenticated = await authService.login();

    if (!authenticated) {
      spinner.fail("Falha na autenticação");
      await browserService.close();
      return;
    }
    spinner.succeed("Autenticado com sucesso");

    const processService = new ProcessService(
      page,
      config,
      selectors,
      browserService,
    );
    const results: ProcessInfo[] = [];

    for (let i = 0; i < processes.length; i++) {
      const processNumber = processes[i];
      spinner.start(
        `[${i + 1}/${processes.length}] Processando ${processNumber}...`,
      );

      const result = await retryWithBackoff(
        () => processService.catalogProcess(processNumber, marcador),
        config.retry,
        `Processo ${processNumber}`,
      );

      results.push(result);

      if (result.status === "success") {
        spinner.succeed(
          chalk.green(
            `[${i + 1}/${processes.length}] ${processNumber} - Tag adicionada`,
          ),
        );
      } else if (result.status === "skipped") {
        spinner.warn(
          chalk.yellow(
            `[${i + 1}/${processes.length}] ${processNumber} - ${result.errorMessage}`,
          ),
        );
      } else {
        spinner.fail(
          chalk.red(
            `[${i + 1}/${processes.length}] ${processNumber} - ${result.errorMessage}`,
          ),
        );
      }
    }

    await browserService.close();

    displaySummary(results, startTime);
  } catch (error) {
    logger.error("Erro fatal durante execução", { error });
    throw error;
  }
}

function displaySummary(results: ProcessInfo[], startTime: Date): void {
  const endTime = new Date();
  const duration = (endTime.getTime() - startTime.getTime()) / 1000;

  const successful = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  console.log(chalk.blue.bold("\n\n=== Resumo da Execução ===\n"));
  console.log(`Total de processos:     ${results.length}`);
  console.log(chalk.green(`✓ Sucessos:             ${successful}`));
  console.log(chalk.yellow(`⊘ Já catalogados:       ${skipped}`));
  console.log(chalk.red(`✗ Falhas:               ${failed}`));
  console.log(`\nTempo total:            ${duration.toFixed(2)}s`);

  const failedProcesses = results.filter((r) => r.status === "failed");
  if (failedProcesses.length > 0) {
    console.log(chalk.red.bold("\n\nProcessos com falha:\n"));
    failedProcesses.forEach((p) => {
      console.log(chalk.red(`  • ${p.number}: ${p.errorMessage}`));
    });
  }

  console.log(chalk.gray(`\nLog detalhado: ${logger.getLogFilePath()}`));
  console.log();
}
