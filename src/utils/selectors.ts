import * as fs from 'fs';
import * as path from 'path';
import { Selectors } from '../models/config';

export function loadSelectors(): Selectors {
  const selectorsPath = path.join(process.cwd(), 'config', 'selectors.json');

  if (!fs.existsSync(selectorsPath)) {
    throw new Error(`Selectors file not found: ${selectorsPath}`);
  }

  try {
    const fileContent = fs.readFileSync(selectorsPath, 'utf-8');
    const selectors = JSON.parse(fileContent) as Selectors;

    validateSelectors(selectors);

    return selectors;
  } catch (error) {
    throw new Error(`Failed to load selectors: ${error}`);
  }
}

function validateSelectors(selectors: any): void {
  if (!selectors.login || !selectors.process || !selectors.frames) {
    throw new Error('Invalid selectors structure: missing required sections');
  }

  const requiredLoginFields = ['usernameField', 'passwordField', 'submitButton'];
  const requiredProcessFields = ['searchField', 'gerenciarMarcadorButton', 'marcadorSelect', 'salvarButton'];

  requiredLoginFields.forEach(field => {
    if (!selectors.login[field]) {
      throw new Error(`Missing required login selector: ${field}`);
    }
  });

  requiredProcessFields.forEach(field => {
    if (!selectors.process[field]) {
      throw new Error(`Missing required process selector: ${field}`);
    }
  });
}

export const selectors = loadSelectors();
