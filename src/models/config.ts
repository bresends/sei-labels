export interface AppConfig {
  sei: {
    baseUrl: string;
    username: string;
    password: string;
    orgao: string;
  };
  browser: {
    timeout: number;
    slowMo: number;
  };
  retry: {
    maxRetries: number;
    delayMs: number;
  };
  logging: {
    level: string;
  };
}

export interface Selectors {
  login: LoginSelectors;
  process: ProcessSelectors;
  frames: FrameSelectors;
}

export interface LoginSelectors {
  usernameField: string;
  passwordField: string;
  submitButton: string;
  errorMessage: string;
}

export interface ProcessSelectors {
  searchField: string;
  searchButton: string;
  gerenciarMarcadorButton: string;
  marcadorSelect: string;
  marcadorDropdown: string;
  marcadorOption: string;
  textoMarcador: string;
  salvarButton: string;
  voltarButton: string;
  tagList: string;
  notFoundMessage: string;
  atribuirProcessoButton: string;
  atribuicaoSelect: string;
  atribuicaoSalvarButton: string;
}

export interface FrameSelectors {
  main: string;
  tree: string;
}
