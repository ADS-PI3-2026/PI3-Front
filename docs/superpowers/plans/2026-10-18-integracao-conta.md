# Integração da conta — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execute as etapas nesta sessão, preservando o trabalho local.

**Goal:** Deixar os fluxos de conta disponíveis na API atual prontos para o teste manual do André.
**Architecture:** Manter as telas existentes; compartilhar o transporte JSON e a sessão Bearer. Renovar antes da expiração, sem simular sucesso. O backend continua responsável pelas permissões e pelos códigos.
**Tech Stack:** Next.js 16.3, React 19, testes node:test, Laravel no Docker.
**Spec:** Pedido do André de 18/10 e a lista de pendências apresentada nesta conversa.

## Global Constraints
- Trabalhar na branch de integração existente, com as alterações locais preservadas; não criar outro checkout para o Docker.
- Não criar nem modificar endpoints do backend. Puxar somente mudanças já incorporadas à main; não mesclar branches de colegas ainda em revisão.
- A entrega de 18/10 permaneceu local para testes. Em 20/10, após os testes manuais, o responsável autorizou commits e publicação por PR, com prévia das mensagens antes do push.
- Não expor credenciais, JWTs ou códigos; testes reais somente com contas fictícias isoladas.
- Não enviar e-mails para pessoas nos testes automatizados; usar fila isolada/log no teste real.
- Edição de perfil e consulta de termos não possuem rotas atuais: documentar dependência, mostrar dados reais e não simular gravação.

## Review Focus
- Requisições concorrentes devem compartilhar uma renovação; logout não pode ser revertido por resposta atrasada.
- Erro de rede não deve apagar uma sessão ainda válida; 401 deve encerrá-la.
- Recuperação deve enviar password_confirmation e usar o código apenas na etapa de validação.
- Exclusão depende de action_token, usado em X-Action-Token uma única vez; falha exige nova confirmação.
- Falhas de validação, cooldown e serviço devem aparecer sem detalhes técnicos e sem sucesso de demonstração.

### Task 1: Atualizar o projeto preservando alterações
- [x] Backup de diffs e arquivos locais em /tmp/pi3-backup-20261018.
- [x] git pull --ff-only origin main nos três repositórios; API passou a 42feebd, frontend e Docker já atuais.
- [x] Conferir migrations e rotas no Docker sem zerar o banco.

### Task 2: Transporte e sessão
**Files:** src/app/auth-api.js, auth-session.js, session-api.js, account-api.js, components/app-shell.js; tests/session-api.test.js e account-api.test.js.
**Interfaces:** ensureAuthSession() -> sessão válida, refreshAuthSession() -> sessão renovada, logoutAuthSession() -> encerra sessão local e remota; requestAccount(endpoint, options) -> envelope validado.
- [x] RED: testes do Bearer, timeout/401, renovação única, corrida com logout e falha de rede.
- [x] GREEN: implementar funções e monitor de renovação da sessão.
- [x] npm test e npm run lint devem terminar com código 0.

### Task 3: Recuperação de senha
**Files:** src/app/page.js, auth-api.js; tests/auth-api.test.js.
**Interfaces:** POST /auth/forgot-password {email}; /auth/validate-reset-code {email,code}; /auth/reset-password {email,password,password_confirmation}.
- [x] RED: contratos atuais e mensagens de erro.
- [x] GREEN: corrigir rotas, payload, erros por campo, reenvio 120s e limpar senhas ao concluir.
- [x] npm test deve passar; resposta real de erro não deve avançar etapas.

### Task 4: Perfil e exclusão
**Files:** src/app/perfil/page.js, garagem/page.js, account-api.js, components/app-shell.js; tests/account-api.test.js.
**Interfaces:** GET /me; POST /otp/request {purpose:account_deletion}; POST /otp/validate {purpose,code} -> action_token; DELETE /me com X-Action-Token.
- [x] RED: contrato do usuário e OTP, recusa de token de ação ausente.
- [x] GREEN: dados reais, edição indisponível sem simulação, logout real e exclusão confirmada.
- [x] npm test e lint; verificar que a identidade fictícia saiu das telas de conta.

### Task 5: Verificação e roteiro manual
**Files:** README.md e docs/TESTE-CONTA-2026-10-19.md.
- [x] npm test, npm run lint, npm run build.
- [x] Testes reais com conta fictícia: login/me/refresh/logout, recuperação e exclusão; não usar dados do André.
- [x] Conferir novamente main dos três repos, serviços, migrations e HTTP do frontend/API.
- [x] Revisão final do diff e registrar limites: perfil sem endpoint de edição, termos sem endpoint/conteúdo aprovado e veículos/manutenções fora da atribuição do André.

## Progresso
- 18/10: escopo e contratos conferidos; backups e pull concluídos. Sem conflito: mudanças locais de composer.lock e config/cors.php preservadas.

- Transporte e sessão: 43 testes passaram, incluindo renovação concorrente e resposta tardia após troca de conta. Lint e build passaram após corrigir inicialização preguiçosa do relógio no modal de recuperação.
- Docker iniciado; migrations user_otps e maintenances_alerts aplicadas no banco existente sem apagar dados.
- Teste real será feito em SQLite e storage/cache isolados dentro do container. A primeira tentativa encontrou dependência de cache na migration de permissões; o ambiente temporário foi ajustado para file com storage próprio.

- Teste real isolado concluído: cadastro/login/me/refresh/logout/reset/OTP/delete e processamento da fila em log. SQLite e storage confirmados antes das requisições.
- Revisão independente: corrigidos dois P2 (OTP recebido durante refresh não é perdido; modal recovery retoma senha após fechar). Testes reproduziram falha antes da correção.
- Identificador local de sessão distingue refresh de nova autenticação. 401 com JWT anterior pode repetir uma vez com JWT já renovado, sem retries automáticos de falhas de rede. 48 testes passaram após as correções.
- Limites aceitos: edição de perfil e documentos legais dependem do grupo; veículos/manutenções seguem fora desta entrega. Instância inicial de teste recarregou .env principal; registro fictício removido especificamente. Repetição com --no-reload e prova de isolamento concluída.

- Verificação final: 48/48 testes, lint e build aprovados. Teste HTTP real repetido após as correções, com todos os fluxos aprovados na instância isolada.
- Comparação final e novo pull: Docker 22285ce, frontend b8ff82a e API 42feebd iguais às respectivas origin/main. composer.lock e config/cors.php idênticos ao backup inicial.
- Decisão de entrega: manter a branch e as mudanças locais para o teste de amanhã, conforme pedido; sem push, PR ou fechamento de issues.

## Revisão para publicação — 20/10
- Tarefas abertas confirmadas no GitHub: #9, #12 e #13. As três estão atendidas pelo frontend.
- Revisão independente identificou 401 chegando antes do refresh; cenário reproduzido em teste que falhou e corrigido aguardando a renovação da mesma sessão. Suite passou com 49 testes.
- Manter separados os commits de frontend e infraestrutura Docker; não publicar as alterações locais de composer.lock/config/cors.php da API.
- A branch de William recebeu commits ainda fora da main. Esses commits não integram esta publicação.

## Escopo final de publicação — 20/10
- Publicar somente PI3-Front na branch feat/integracao-cadastro-email.
- PR de infraestrutura fechado e branch remota do Docker removida; ajustes e commit Docker preservados exclusivamente no checkout local para testes.
