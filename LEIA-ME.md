# Escrita IA 2.2.0

Assistente de escrita integrado aos campos do navegador. A análise começa após 600 milissegundos sem digitação. As sugestões aparecem grifadas; **nenhuma alteração é aplicada sem seu clique**.

## Atualizar a instalação existente

Se os arquivos da pasta instalada já foram atualizados por este atendimento:

1. Abra `chrome://extensions`.
2. No cartão **Escrita IA**, clique em **Recarregar** (seta circular). Mantenha o **Modo do desenvolvedor** ligado.
3. Confirme a versão **2.2.0** e recarregue os sites já abertos.

Ao manter a mesma pasta, a chave e as preferências existentes permanecem no armazenamento da extensão. A preferência antiga de aplicação automática continua migrada para sugestões por clique.

## Instalar pelo ZIP

1. Extraia **escrita-ia-2.2.0.zip** em uma pasta permanente.
2. O `manifest.json` está diretamente na raiz do ZIP. Selecione exatamente a pasta onde ele aparece, sem selecionar a pasta acima nem o arquivo ZIP.
3. Em `chrome://extensions`, ative **Modo do desenvolvedor** e escolha **Carregar sem compactação**.
4. Em **Detalhes → Acesso ao site**, escolha **Em todos os sites** para permitir a detecção automática.
5. Abra **Configurações**, preencha o provedor e clique em **Salvar e testar conexão**. O botão usa diretamente os valores exibidos na tela.
6. Recarregue as páginas já abertas e clique em um campo de texto.

## Configurar qualquer API compatível com OpenAI

A tela aceita três valores independentes: **URL da API**, **chave da API** e **nome exato do modelo**. A chave pode ter qualquer formato; ela não precisa começar com `sk-`. Em servidores locais sem autenticação, deixe a chave vazia.

Exemplos de formato de URL:

- OpenAI oficial: `https://api.openai.com/v1`
- Outro serviço compatível: `https://provedor.exemplo/v1`
- Servidor local: `http://localhost:11434/v1`
- Endpoint completo: `https://provedor.exemplo/v1/chat/completions`

Em **Formato da API**, escolha:

- **Detectar automaticamente**: tenta Responses e, quando o endpoint não existe ou não aceita o formato, tenta Chat Completions.
- **Responses API**: usa somente `/responses`.
- **Chat Completions**: usa somente `/chat/completions`.

A extensão tenta primeiro JSON Schema estrito e recua para JSON simples quando o provedor não oferece saída estruturada. No modo automático pode haver mais de uma chamada rejeitada durante a descoberta; consulte as regras de cobrança do provedor. O provedor ainda precisa aceitar mensagens no formato OpenAI e retornar JSON válido conforme solicitado. Modelos sem instruções ou JSON confiável podem não funcionar bem.

Para proteger a credencial, URLs remotas exigem HTTPS. HTTP é permitido somente em `localhost`, `127.0.0.1` e `[::1]`. A chave é vinculada à URL em que foi cadastrada e enviada apenas no cabeçalho `Authorization: Bearer` para essa URL. Ao mudar de provedor, informe a chave correspondente ou deixe o campo vazio para um servidor sem autenticação.

## Revisar e reescrever

- O indicador no canto do campo mostra o estado, a quantidade de ocorrências e as contagens de palavras e caracteres.
- Pressione `Alt+Shift+E` com um campo ativo para abrir ou fechar o painel sem usar o mouse.
- Vermelho indica ortografia; âmbar, gramática, pontuação e tipografia; violeta, estilo e tom. Os cartões também identificam a categoria por escrito.
- Passe o mouse ou clique no grifo, ou navegue pelo teclado. O balão mostra a regra, uma explicação e as substituições.
- Clique em uma substituição para aplicá-la. **Ignorar** oculta a ocorrência até a próxima edição. **Desfazer** restaura a última alteração se o campo não tiver mudado.
- Para reescrever, selecione um trecho de até 6.000 caracteres e abra o indicador. Escolha o estilo e clique em **Gerar alternativas**.
- Nas Configurações, escolha idioma, tema e **Modo Exigente**. A detecção automática usa PT-BR para português e en-US para inglês; PT-PT e en-GB podem ser selecionados explicitamente.
- Adicione termos pelo cartão de ortografia ou pelo dicionário nas Configurações. Eles deixam de gerar alertas ortográficos naquele idioma; verificações gramaticais continuam ativas.

## Se nada aparecer

Abra o ícone da extensão. O diagnóstico informa versão, URL, formato, modelo, presença de credencial, serviço de fundo, permissão do site, campo detectado e as estatísticas da sessão (análises, ocorrências encontradas e sugestões aplicadas). Clique em **Verificar e reconectar**. Se necessário, recarregue a página e confira o botão **Erros** em `chrome://extensions`.

Sem um provedor pronto, o indicador continua disponível e a verificação local de espaços duplicados funciona. Falhas da API nunca são apresentadas como “texto correto”. **Testar conexão** faz uma chamada real com uma frase de exemplo e pode gerar cobrança.

## Privacidade e custos

O conteúdo do campo ativo é enviado diretamente à URL configurada. A extensão não envia a página inteira nem publica mensagens. Há limite de 100.000 caracteres por campo; textos longos são divididos por parágrafos em blocos com contexto. Blocos inalterados podem ser reutilizados em cache de memória de até 50 respostas, apagado quando o serviço de fundo termina.

Privacidade, retenção, modelos disponíveis e cobrança dependem do provedor escolhido. Na OpenAI oficial, as chamadas da Responses API incluem `store: false`; provedores externos não recebem esse parâmetro específico. A extensão não pode garantir como um serviço externo trata os dados.

A chave persistente fica no perfil local, sem sincronização. O armazenamento é restrito aos contextos confiáveis da extensão. Scripts executados nas páginas recebem somente preferências e o estado da configuração, nunca a chave. Esse armazenamento não protege contra alguém com acesso ao perfil do computador. **Apagar chave** remove as cópias local e de sessão.

## Compatibilidade

Campos HTML e `contenteditable` comuns, inclusive inserção dinâmica, páginas locais autorizadas, frames HTTP/HTTPS e frames herdados `about:blank`/`blob`, além de Shadow DOM aberto. Há adaptadores para formatos de editor usados por ChatGPT, Instagram, Facebook, LinkedIn e X, testados em cenários controlados. Isso não substitui validação na sessão real de cada serviço: veja **VALIDACAO.md**.

Para arquivos locais, ative **Permitir acesso a URLs de arquivo** nos detalhes da extensão. O Chrome não permite extensões em páginas internas como `chrome://`, na Chrome Web Store e em algumas áreas protegidas. Também não há garantia em Google Docs, canvas ou Shadow DOM fechado. Campos de senha, credenciais identificadas e campos somente leitura são excluídos.

O catálogo contém 36 variantes em 34 idiomas. A qualidade depende do modelo e não foi certificada uniformemente em todos eles.

## Testes e código

- `npm test` executa testes locais da lógica, do serviço de fundo e dos transportes Responses e Chat Completions, sem chamada real.
- `node tests/browser.cjs` requer Playwright e Chrome. O teste carrega a extensão real em perfil isolado com uma API simulada.
- O corpus `tests/linguistic-cases.json` contém exemplos de avaliação; testes offline não certificam os julgamentos de uma IA real.

Referências: [OpenAI: saídas estruturadas](https://developers.openai.com/api/docs/guides/structured-outputs), [Chrome: scripts de conteúdo](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome: armazenamento](https://developer.chrome.com/docs/extensions/reference/api/storage).
