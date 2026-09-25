# Relatório de validação — Escrita IA 3.0.0

Data: 25 de setembro de 2026.

## Correção 3.0.1 — Google AI Studio

34 testes locais aprovados, incluindo normalização das URLs do Google, seleção exclusiva de Chat Completions mesmo com preferência antiga de Responses, envio da chave somente ao provedor vinculado, bloqueio sem chave e preservação dos erros de modelo/cota/permissão. A predefinição Google AI Studio é exercitada no teste da extensão real. Chamadas ao Gemini são simuladas; a conexão com o modelo e a chave do usuário deve ser confirmada em Salvar e testar conexão.

## Extensão 3.0: mudanças reais e validação

O painel injetado (`panel.js` e `content.js`), o popup e as configurações foram redesenhados. Os testes carregam a extensão real com manifesto, serviço de fundo e scripts de conteúdo em um perfil Chrome isolado.

Novas regressões cobertas: passar o mouse não abre o painel, fixar/soltar, fechar com Esc, aplicar correções locais em lote e desfazer, ocultar desfazer após edição manual, gerar novamente sem duplicar alternativas, reescrever o campo inteiro, predefinições de provedor, mostrar/ocultar somente a chave digitada, pausa global pelo popup e painel dentro da tela em 390 px. Os fluxos anteriores de revisão, dicionário, seleção, segurança de senha, cancelamento, CSP Trusted Types, temas, iframes e editores ricos continuam cobertos.

O teste de integração também é executado pelo CI, além dos testes da página de demonstração. As imagens `extension*.png` são capturas da extensão real nos testes, com respostas de IA simuladas. Não houve chamada com chave real nem validação em sessões autenticadas de sites externos.

## Demonstração pública e nova execução de testes

Redesign do Estúdio: exemplos de contexto com recuperação do rascunho, cópia via clipboard e alternativa quando a permissão falha, persistência somente do tema, ausência de persistência dos textos, modo foco com isolamento do restante da página e ciclo de Tab/Shift+Tab, saída por botão/Esc, FAQ expansível e respeito à preferência por movimento reduzido. Fluxos cobertos pelo teste de navegador. Capturas atualizadas nos temas claro/escuro e no celular.

Evolução do editor: painel lateral, grifos de repetições/espaços com texto seguro, filtros com contagens, localização da ocorrência inclusive em textos com rolagem e limpeza reversível. Testes verificam a seleção exata, atualização dos grifos após aplicar/desfazer, filtro sem ocorrências e ausência de overflow entre 320 e 1440 px. Nenhuma integração ou transmissão de texto ao LanguageTool foi adicionada.

- 31 testes locais aprovados com `npm test`.
- `npm run build:site` gera a página estática usando o mesmo motor local da extensão.
- `npm run test:site` aprovado em Chrome: correções por clique, desfazer, invalidação de desfazer após edição manual, restauração do exemplo, texto vazio, Unicode, conteúdo HTML tratado como texto, navegação por teclado e ausência de overflow em 320, 390, 768 e 1440 px.
- O teste serve a página em `/escrita-ia/`, confirmando caminhos relativos compatíveis com GitHub Pages, ausência de respostas HTTP com erro, exceções de JavaScript e solicitações externas.
- `npm run test:browser` repetido com a extensão real: análise, aplicação, desfazer, dicionário, reescrita, cancelamento, senha excluída, campos dinâmicos, iframe herdado, erro de API, pausa, configurações, tema, Unicode, zoom, quebra de linha e os cinco adaptadores sintéticos aprovados.
- Capturas reais desta execução estão em `docs/screenshots/`.
- Playwright agora é uma dependência de desenvolvimento fixada e com lockfile. CI valida a demonstração em Chromium; a publicação só ocorre depois dos testes.

As chamadas de IA continuam simuladas. Não houve validação com credenciais reais nem publicação de mensagens nos sites integrados. A demonstração pública usa apenas regras locais, sem enviar o conteúdo digitado.

## Novidades da 2.2.0

- Atalho `Alt+Shift+E` (`commands` no manifesto) que alterna o painel no campo ativo; o serviço de fundo encaminha o comando à aba ativa e o script de conteúdo alterna o painel.
- Estatísticas da sessão no serviço de fundo (análises, ocorrências encontradas, sugestões aplicadas), exibidas no diagnóstico do popup. Desfazer não conta como sugestão aplicada.
- Regra local de palavra duplicada (`engine.js`): repetições como "isso isso" são grifadas como gramática sem chamada à IA, com testes de acentos, caixa alta e falsos positivos ("a a", palavras distintas).
- Acessibilidade do painel: `role="dialog"`, `aria-expanded` sincronizado em todos os caminhos de abrir/fechar e versão do diagnóstico lida do manifesto em vez de fixa no código.
- Infra: licença MIT, `.gitignore`, workflow de CI (validação do manifesto + `npm test`) e badges no README.

## Verificações automatizadas (31 testes locais aprovados, base 2.1.1 + 10 novos)

## Ambiente e método (base 2.1.1, 6 de setembro de 2026)

Os testes de integração usam Windows, Chrome, perfil isolado e a extensão carregada por `Extensions.loadUnpacked`. Manifesto, scripts de conteúdo e serviço de fundo são os arquivos reais do pacote. As respostas dos modelos foram simuladas no serviço de fundo para não usar credenciais pessoais nem gerar cobrança.

- 21 testes locais aprovados na base: localização de ocorrências, posições antigas, trechos repetidos, Unicode, blocos longos, contadores, dicionário, regras locais, esquemas, migração, cache, cancelamento e erros de API.
- 10 testes novos na 2.2.0: palavra duplicada (posições, acentos, caixa alta, falsos positivos, pipeline de merge), métricas/blocos vazios, normalização, atalho de teclado e estatísticas da sessão.
- URLs base e endpoints completos, HTTPS remoto, HTTP local e localhost IPv4/IPv6.
- Chaves com formato livre e provedor local sem chave.
- Responses API e Chat Completions em JSON Schema estrito, JSON simples e instrução de JSON.
- Detecção automática com troca para Chat Completions quando `/responses` não existe.
- Respostas Chat Completions em texto, blocos de conteúdo e JSON cercado por bloco Markdown.
- Nenhuma credencial aparece na resposta de diagnóstico enviada às páginas, e uma chave vinculada a outra URL não é enviada ao provedor atual.
- Catálogo de 36 variantes em 34 idiomas e corpus com todas as categorias solicitadas. Esses são testes de configuração e transporte, não uma certificação linguística.

## Integração no Chrome

Na validação anterior da base 2.0, a extensão real foi carregada em perfil isolado e passou pelos seguintes fluxos:

- Campo já focado, campo dinâmico, `textarea`, `input` e `contenteditable`.
- Indicador sem chave, grifo local, análise sem substituição automática, aplicação por clique e desfazer.
- Dicionário, reescrita, cancelamento de resposta antiga, erro 429 e pausa geral.
- Preservação de negrito fora do trecho alterado, emojis, acentos combinados, texto repetido, zoom e quebra de linha.
- Página de configurações, diagnóstico, tema e adaptadores sintéticos para ChatGPT, Instagram, Facebook, LinkedIn e X.
- Atualização de uma cópia 1.1 para 2.0 na mesma pasta, preservando chave fictícia, idioma e dicionário e desativando aplicação automática.

A versão 2.1.1 reduz a espera de digitação para 600 ms, prioriza Chat Completions em provedores externos, libera chamadas feitas pela própria página de opções e cobre frames herdados. O teste completo foi repetido com o pacote final: a extensão carregou no Chrome, **Salvar e testar conexão** retornou sucesso, um campo em `about:blank` foi detectado e os cinco adaptadores sintéticos passaram sem erros de JavaScript.

## Tentativas nos sites reais

Os sites foram abertos em perfil isolado, sem contas pessoais. Nada foi publicado ou enviado.

| Site | Resultado |
| --- | --- |
| ChatGPT | Página “Um momento…”; nenhum editor acessível. |
| Instagram | Nenhum editor acessível sem autenticação. |
| Facebook | Nenhum editor acessível sem autenticação. |
| LinkedIn | Página de entrada/cadastro; nenhum editor acessível. |
| X | Falha HTTP de navegação. |

**A validação ponta a ponta nos cinco sites em sessões autenticadas continua pendente.** Os adaptadores sintéticos confirmam os formatos de editor, mas não comprovam cada site ao vivo.

## Chamadas reais e qualidade linguística

Não foi feita chamada com chave real. A integração oficial segue Responses API; provedores compatíveis podem usar Responses ou Chat Completions. Autenticação, nome do modelo, recursos aceitos e qualidade dependem do serviço configurado e devem ser confirmados em **Configurações → Testar conexão**.

A análise pode produzir falsos positivos ou deixar erros sem identificar. Por isso toda alteração continua dependendo de clique.
