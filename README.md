# Escrita IA

Extensão para Google Chrome que revisa ortografia, gramática, pontuação, estilo e tom diretamente nos campos de texto do navegador. As ocorrências são grifadas durante a digitação e nenhuma alteração é aplicada sem o clique do usuário.

## Recursos

- Análise automática após 600 ms sem digitação.
- Correções de ortografia, gramática, pontuação e tipografia.
- Sugestões de estilo, tom, redundância e concisão.
- Reescrita clara, concisa, formal, fluida ou persuasiva.
- Aplicação de cada sugestão com um clique e opção de desfazer.
- Dicionário pessoal separado por idioma.
- Modo Exigente para revisão estilística mais rigorosa.
- Contadores de palavras e caracteres dentro do campo.
- Temas claro e escuro.
- 36 variantes em 34 idiomas.
- Adaptadores para campos e editores usados por ChatGPT, Instagram, Facebook, LinkedIn e X.

## Provedores de IA

A extensão aceita serviços compatíveis com a API da OpenAI. A configuração possui:

- URL da API;
- chave da API com qualquer formato;
- nome exato do modelo;
- Responses API, Chat Completions ou detecção automática.

Servidores locais em `localhost`, `127.0.0.1` e `[::1]` podem funcionar sem chave. Cada credencial é vinculada à URL em que foi cadastrada para impedir seu envio acidental a outro provedor.

## Instalação no Chrome

1. Baixe ou clone este repositório.
2. Abra `chrome://extensions`.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta que contém o arquivo `manifest.json`.
6. Em **Detalhes → Acesso ao site**, permita o acesso aos sites desejados.
7. Abra as configurações da extensão, informe o provedor e clique em **Salvar e testar conexão**.

Para atualizar uma instalação existente, substitua os arquivos, clique em **Recarregar** no cartão da extensão e atualize as páginas abertas.

## Desenvolvimento e testes

Requer Node.js para executar os testes locais:

```bash
npm test
```

A suíte cobre análise, reescrita, Unicode, dicionário, cache, cancelamento, segurança de credenciais e os transportes Responses e Chat Completions. O teste de navegador em `tests/browser.cjs` usa Playwright e carrega a extensão real em um perfil isolado do Chrome.

## Arquivos importantes

- `manifest.json`: manifesto Manifest V3.
- `background.js`: serviço de fundo e comunicação com provedores.
- `content.js`: detecção e acompanhamento dos campos.
- `fields.js`: adaptadores para campos simples e editores ricos.
- `panel.js`: interface, grifos e sugestões.
- `provider.js`: compatibilidade com Responses e Chat Completions.
- `options.html`: configurações do provedor, idiomas, tema e dicionário.
- `LEIA-ME.md`: manual detalhado de instalação e uso.
- `VALIDACAO.md`: relatório dos testes executados e limitações conhecidas.

## Privacidade

Somente o conteúdo do campo em revisão é enviado à URL configurada. A extensão não publica mensagens e não mantém histórico persistente dos textos. A chave fica no armazenamento local ou de sessão do perfil do Chrome e não é exposta aos scripts das páginas.

As regras de retenção, privacidade e cobrança dependem do provedor escolhido. Páginas internas do Chrome, Chrome Web Store, Google Docs em canvas e áreas protegidas podem impedir a integração.

## Versão

Versão atual: **2.1.1**.

Consulte [LEIA-ME.md](LEIA-ME.md) para instruções completas e [VALIDACAO.md](VALIDACAO.md) para os resultados de validação.
