# Relatório de validação — Escrita IA 2.1.1

Data: 6 de setembro de 2026.

## Ambiente e método

Os testes de integração usam Windows, Chrome, perfil isolado e a extensão carregada por `Extensions.loadUnpacked`. Manifesto, scripts de conteúdo e serviço de fundo são os arquivos reais do pacote. As respostas dos modelos foram simuladas no serviço de fundo para não usar credenciais pessoais nem gerar cobrança.

## Verificações automatizadas

- 21 testes locais aprovados: localização de ocorrências, posições antigas, trechos repetidos, Unicode, blocos longos, contadores, dicionário, regras locais, esquemas, migração, cache, cancelamento e erros de API.
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
