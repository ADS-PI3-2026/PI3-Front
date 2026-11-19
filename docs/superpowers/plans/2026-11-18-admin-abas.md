# Painel administrativo em abas

**Objetivo:** manter os totalizadores acima de uma área única com abas, preservando as operações existentes e os dados locais.

**Decisões do pedido:** abas no lugar de páginas de listagem; ações de cadastro junto à tabela correspondente; testes com o banco local; nenhuma alteração no backend. A API atual lista apenas administradores (1 de 5 contas locais).

**Arquitetura:** `/admin?aba=...` seleciona o painel. Componentes das tabelas permanecem montados para preservar buscas e filtros, com consultas habilitadas apenas na aba ativa. Rotas antigas redirecionam para a aba equivalente. Detalhes de tipos de serviço mantêm sua rota. Remover a navegação lateral do shell administrativo.

**Stack:** Next.js 16.4.3, React 19.2.8, CSS Modules, node:test; sem novas dependências.

## Etapas

- [x] Testar primeiro a seleção de abas, navegação por teclado, URLs legadas e totais baseados nos metadados da API, incluindo falhas de consulta.
- [x] Extrair os painéis existentes, compor resumo e abas, contextualizar os botões e preservar os filtros. Redirecionar rotas antigas e simplificar o shell.
- [x] Rodar testes, lint e build. Conferir no navegador os dados reais, troca de abas, busca preservada, teclado, modais, rotas antigas e retorno do detalhe. Revisar o diff.

## Foco da revisão

- URL inválida deve selecionar uma aba segura e válida.
- Totais não podem representar a quantidade de itens da primeira página.
- Uma falha no resumo não pode impedir o uso das tabelas.
- Abas inativas não devem carregar dados nem expor seus controles ao teclado.
- As alterações anteriores na dock e no título do veículo devem ser preservadas.

## Progresso

- Diagnóstico confirmado no controlador, nas rotas, no painel e no banco: 5 usuários, 1 administrador, 0 tipos de serviço. Usuário confirmou que não deseja alterar o backend.
- Abas implementadas e verificadas com dados reais. Revisão independente identificou histórico do modal de serviço, paginação ao filtrar por totalizador e diálogo nativo em painel inativo; os três foram corrigidos. Primeiro ciclo: 159 testes, lint e build aprovados. Regressões adicionais em validação.

## Ampliação solicitada durante o trabalho

O usuário autorizou atualizar o backend com as novas rotas existentes e integrar Lexical para editar os termos e a política, refletindo o HTML salvo nas telas do usuário. Não criar rotas próprias nem alterar controladores.

- Backend atualizado por fast-forward de `97b81dc` para `2c5ff79`; preservados `composer.lock` e `config/cors.php` locais.
- Migrações publicadas aplicadas no MySQL local. Backup dos dois textos iniciais em `/private/tmp/legadocar-legal-original.json` para restauração após testes.
- Contratos: `GET /settings/{key}` público; `GET /admin/settings?group=legal`; `PUT /admin/settings/batch` com `{settings:[{key,value}]}`. Chaves `terms_of_use` e `privacy_policy`.
- [x] Testar clientes públicos/administrativos, envio do HTML, erros, conteúdo vazio e sanitização.
- [x] Criar editor Lexical com formatação, listas, links, desfazer/refazer e prévia; publicar apenas o documento selecionado. Exibir conteúdo da API no cadastro e no perfil, com carregamento/erro/repetição sem fallback estático.
- [x] Validar publicação de texto temporário, leitura pública sem sessão, reabertura e restauração dos textos iniciais. Reexecutar testes, lint/build e revisão da integração.

- Revisão independente da integração legal apontou os exemplos da migração, Enter no campo de link e a referência de publicação imediatamente após salvar. Corrigidos: importação idempotente dos documentos anteriores; Enter aplica o link e não submete o formulário; referência de concorrência avança assim que o PUT termina, independentemente da recarga dos metadados.
- Validação real: termos com negrito/link e política com lista numerada exibidos ao usuário; segunda publicação e desfazer/refazer aprovados. Textos e datas restaurados por cópia anterior ao QA; serviço temporário `qa_admin_tabs_20261118` removido. Contagens finais 5 usuários, 1 administrador, 0 serviços, 2 documentos.
- Verificação final: 167 testes aprovados, lint global aprovado, build aprovado e `git diff --check` sem problemas. Duas revisões independentes; os achados foram corrigidos. Inspeção visual efetiva em 1280 × 720. A capacidade de viewport do navegador não alterou a resolução, portanto não foi declarada validação visual mobile nesta execução.
- Capturas: `admin-abas-e-editor-2026-11-18/01-admin-abas.jpg`, `02-editor-legal.jpg` e `03-politica-no-aplicativo.jpg` no diretório de artefatos da conversa. App deixado em `/admin?aba=textos`, com os conteúdos originais restaurados e sem publicação pendente.

## Ajuste de 19/11 e publicação autorizada sob confirmação

- A prévia dos documentos passou a abrir no modal nativo compartilhado, com o HTML do rascunho atual e fechamento por X, Escape ou Entendi. O editor permanece montado; ao fechar, o foco retorna ao botão de prévia. Sair da aba desmonta o modal para não bloquear outro painel.
- Conferência real dos dois documentos; rascunho temporário preservado após fechar e descartado por recarga, sem publicar ou alterar o banco. Retorno pelo histórico remove o diálogo. Captura `admin-previa-modal-2026-11-19.jpg` no diretório de artefatos da conversa.
- O usuário autorizou publicar na main depois desse ajuste, exigindo confirmar a mensagem antes de qualquer novo commit. Até essa confirmação: não commitar nem fazer push. Main remota consultada, ancestral da branch atual.
- Em 19/11, o usuário confirmou a mensagem `Painel administrativo, textos legais e ajustes de navegação` e autorizou prosseguir com o commit e a publicação na main.
