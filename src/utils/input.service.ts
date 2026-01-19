import { input, select, confirm } from '@inquirer/prompts';

export class InputService {
  async askProcessNumbers(): Promise<string[]> {
    const processInput = await input({
      message: 'Digite os números dos processos SEI (separados por vírgula ou espaço):',
      validate: (value: string) => {
        if (!value || value.trim().length === 0) {
          return 'Por favor, insira pelo menos um número de processo';
        }
        return true;
      },
    });

    const processes = processInput
      .split(/[,\s]+/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    return processes;
  }

  async selectMarcador(): Promise<string> {
    const marcador = await select({
      message: 'Selecione o marcador da seção:',
      choices: [
        { name: 'SGP', value: 'SGP' },
        { name: 'SAD', value: 'SAD' },
        { name: 'SIQ', value: 'SIQ' },
        { name: 'SOP', value: 'SOP' },
      ],
    });

    return marcador;
  }

  async confirmExecution(processCount: number): Promise<boolean> {
    const proceed = await confirm({
      message: `Processar ${processCount} processo(s)?`,
      default: true,
    });

    return proceed;
  }

  async waitForEnter(message: string = 'Pressione ENTER para continuar...'): Promise<void> {
    await input({
      message: message,
    });
  }
}

export const inputService = new InputService();
