#!/usr/bin/env node

import { Command } from 'commander';
import { cli } from './cli';
import { logger } from './services/logger.service';

const program = new Command();

program
  .name('sei-labels')
  .description('Catalogação automatizada de processos SEI')
  .version('1.0.0')
  .option('--headless', 'Executar browser em modo headless (sem interface)')
  .option('--headed', 'Executar browser visível (padrão)', true)
  .option('-d, --debug', 'Ativar modo debug com logs detalhados')
  .parse();

const options = program.opts();

cli({
  headless: options.headless,
  debug: options.debug,
})
  .catch(error => {
    logger.error('Erro fatal:', error);
    process.exit(1);
  });
