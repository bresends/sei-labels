# SEI Labels - Catalogação Automatizada de Processos

Ferramenta CLI em TypeScript + Playwright para automatizar a catalogação de processos SEI, permitindo adicionar tags de seção em múltiplos processos de forma eficiente.

## Features

- ✅ Catalogação automatizada de processos SEI
- ✅ Adição de tags configuráveis
- ✅ Suporte a SEI customizado (adaptável via seletores)
- ✅ Modo headed (visível) ou headless (background)
- ✅ Retry automático em caso de falhas
- ✅ Logging detalhado com histórico
- ✅ Screenshots automáticos em erros
- ✅ Interface CLI interativa

## Pré-requisitos

- Node.js 18+ instalado
- Credenciais válidas do SEI
- Acesso à URL do SEI

## Instalação

1. Clone ou baixe o projeto:

```bash
cd /home/bruno/dev/sei-labels
```

2. Instale as dependências:

```bash
npm install
```

3. Instale os browsers do Playwright:

```bash
npx playwright install chromium
```

4. Configure as variáveis de ambiente:

```bash
cp config/.env.example .env
nano .env  # Edite com suas credenciais
```

## Configuração

Edite o arquivo `.env` na raiz do projeto:

```env
# SEI Configuration
SEI_BASE_URL=https://sei.go.gov.br
SEI_USERNAME=seu_usuario
SEI_PASSWORD=sua_senha
SEI_ORGAO=seu_orgao
SEI_SECTION_TAG=SECAO_EXEMPLO

# Browser Configuration (opcional)
TIMEOUT_MS=30000
SLOW_MO_MS=100

# Retry Configuration (opcional)
MAX_RETRIES=3
RETRY_DELAY_MS=2000

# Logging (opcional)
LOG_LEVEL=info
```

## Uso

### Modo padrão (browser visível):

```bash
npm run dev
```

### Modo headless (background):

```bash
npm run dev:headless
```

### Com argumentos diretos:

```bash
# Headless
npm run dev -- --headless

# Debug
npm run dev -- --debug

# Combinado
npm run dev -- --headless --debug
```

### Build para produção:

```bash
npm run build
npm start
```

## Fluxo de Uso

1. Execute o comando `npm run dev`
2. Insira os números dos processos SEI (separados por vírgula ou espaço)
3. Confirme a URL base do SEI (padrão do .env)
4. Confirme a tag da seção (padrão do .env)
5. Confirme a execução
6. Aguarde o processamento automático
7. Visualize o resumo da execução

## Argumentos CLI

| Argumento | Descrição |
|-----------|-----------|
| `--headless` | Executar browser em modo headless (sem interface) |
| `--headed` | Executar browser visível (padrão) |
| `-d, --debug` | Ativar modo debug com logs detalhados |

## Seletores Customizáveis

Se o seu SEI possui uma estrutura DOM diferente, você pode ajustar os seletores CSS/XPath no arquivo `config/selectors.json`:

```json
{
  "login": {
    "usernameField": "#txtUsuario",
    "passwordField": "#pwdSenha",
    "submitButton": "#sbmLogin",
    "errorMessage": ".infraMensagem"
  },
  "process": {
    "searchField": "#txtPesquisaRapida",
    "tagContainer": ".infraTagContainer",
    "tagInput": "#txtTag",
    "addTagButton": "#btnAdicionarTag",
    "tagList": ".tag-item"
  }
}
```

### Descobrindo os seletores corretos

Use o Playwright Codegen para descobrir os seletores do seu SEI:

```bash
npx playwright codegen https://sei.go.gov.br
```

## Estrutura do Projeto

```
sei-labels/
├── src/
│   ├── config/          # Configurações e variáveis de ambiente
│   ├── models/          # Tipos TypeScript
│   ├── services/        # Serviços (browser, auth, process, logger)
│   ├── utils/           # Utilitários (retry, input, selectors)
│   ├── cli.ts           # Interface CLI principal
│   └── index.ts         # Entry point
├── config/
│   ├── .env.example     # Template de variáveis
│   └── selectors.json   # Seletores customizáveis
├── logs/                # Logs de execução
└── screenshots/         # Screenshots de erros
```

## Logs

Os logs detalhados são salvos automaticamente em `logs/sei-labels-YYYY-MM-DD.log`.

O caminho do arquivo de log é exibido no resumo final de cada execução.

## Troubleshooting

### Erro de autenticação

- Verifique se as credenciais no `.env` estão corretas
- Teste o login manual no navegador
- Verifique se o campo de órgão está correto

### Tag não é adicionada

- Execute em modo headed (padrão) para ver o que está acontecendo
- Use `--debug` para logs detalhados
- Ajuste os seletores em `config/selectors.json` se necessário
- Use o Playwright Codegen para descobrir os seletores corretos

### Timeout

- Aumente o valor de `TIMEOUT_MS` no `.env`
- Verifique sua conexão de internet
- Verifique se o SEI está acessível

### Processo não encontrado

- Verifique se o número do processo está correto
- Verifique se você tem permissão para acessar o processo no SEI

## Desenvolvimento

### Estrutura de código

- `src/models/`: Tipos e interfaces TypeScript
- `src/services/`: Lógica de negócio (browser, autenticação, processos)
- `src/utils/`: Funções utilitárias (retry, input, seletores)
- `src/config/`: Carregamento de configurações

### Adicionando novas features

O código está estruturado de forma modular. Para adicionar novas features:

1. Adicione novos tipos em `src/models/`
2. Implemente a lógica em `src/services/`
3. Integre no fluxo CLI em `src/cli.ts`

## Licença

ISC

## Autor

Bruno Resende
