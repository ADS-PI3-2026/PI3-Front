# Integração final do painel administrativo

**Pedido:** puxar o backend publicado, integrar os módulos previstos no admin e testar amplamente no banco local, preservando os dados existentes.

**Estado inicial:** frontend limpo na main `fa5406a`; trabalho separado na branch `feat/admin-integracao-final`. Backend atualizado por fast-forward de `2c5ff79` para `54d27fa`; preservadas as alterações locais anteriores em `composer.lock` e `config/cors.php`. Nova migração `create_invite_request_table` aplicada.

**Banco local:** MySQL `PI_3`, Docker frontend :3000 / API :8000. Antes dos testes: 5 usuários ativos (4 client, 1 admin), 1 veículo, 1 transferência, 11 registros de auditoria e 0 tipos de serviço. Não alterar registros reais nem enviar e-mails.

## Contratos publicados

- `GET /admin/users`: paginação de 15, busca parcial por name/email, document exato, include_deleted e ordenação, inclusive vehicles_count. `GET /admin/users/{id}` inclui veículos e contas excluídas. Somente consulta; não há operações de moderação.
- `GET /admin/vehicles`: filtros user_id/brand/model/plate/year/include_deleted, contagens de manutenções/alertas/transferências, proprietário e transferência ativa. Detalhe por ID inclui excluídos; RENAVAM não é retornado (apenas has_renavam).
- `GET /admin/transfers`: filtros status/initiated_by/vehicle_id/current_owner_id/recipient_id/recipient_email/plate; detalhe inclui veículo e partes, confirmações, tentativas e prazo.
- `POST /admin/transfers/{id}/mediate-complete` recebe `{renavam: string}`. Somente pending/expired, destinatário existente e veículo com RENAVAM correspondente. Restaura veículo excluído, transfere custódia e cancela outras pendências. Não preencher RENAVAM automaticamente.
- `GET /admin/audit-logs`: filtros user_id/event/auditable_id/entity_type/date_from/date_to e ordenação. Detalhe inclui diferenças, autor, IP e agente.

## Implementação

Manter o painel em abas, desktop primeiro. Acrescentar Usuários e Veículos, substituir os placeholders de Mediações e Auditoria. Preservar Administradores, catálogo/campos e textos legais. Detalhes em modal compartilhado com navegação entre registros relacionados. Nenhuma nova rota ou alteração própria no backend.

Totalizadores: usuários do app, veículos, transferências em aberto e catálogo (incluindo ativos). Contagens vêm de `meta.total`, sem confundir tamanho da página com total.

### 1. Clientes e regras

- [x] Testes primeiro para paginação, filtros, excluídos, validação de IDs, erros/401/403 e contrato da mediação.
- [x] Extrair o parser compartilhado de recursos; criar `admin/operations-api.js` e regras em `admin/_lib/admin-operations.js`.
- [x] Ampliar totalizadores e abas, mantendo URLs anteriores e preservando estado entre abas.

### 2. Telas

- [x] Tabelas de usuários, veículos, transferências e auditoria com filtros, ordenação, paginação, carregamento, lista vazia, erros e repetição.
- [x] Detalhes completos, relações entre registros e diferenças de auditoria; autor nulo deve aparecer como rotina do sistema. Valores false/0/null devem ser diferenciados.
- [x] Mediação com RENAVAM digitado, confirmação clara da mudança de custódia, bloqueio de envio duplicado, tratamento de erro e atualização das listas/contadores após sucesso.
- [x] Fechar modais ao sair da aba, ignorar respostas atrasadas e preservar as buscas.

### 3. Validação

- [x] Testes HTTP pelo kernel Laravel no banco local, incluindo acesso permitido/negado e filtros combinados. Criar cenários temporários dentro de transação e fazer rollback; verificar propriedade, restauração, cancelamento de pendências e rejeições da mediação. As filas de e-mail não podem ser confirmadas no banco.
- [x] Conferência visual no navegador com os dados existentes; testar filtros, detalhes, erros de entrada, teclado, navegação e modais. Não concluir mediação em veículos reais.
- [x] Suíte completa, lint, build e revisão independente. Atualizar o relatório de integração com evidências e eventuais falhas do backend.

## Progresso

- Diagnóstico e contratos lidos. Serviços Docker ativos. Baseline frontend: 167 testes aprovados.
- Clientes e regras: 11 testes novos observados em RED e depois GREEN; resumo existente ampliado. 24 testes direcionados (incluindo navegação) e lint aprovados. Build de produção aprovado.
- Ruling: não expor filtro de entidade na auditoria enquanto o callback do backend não agrupar o OR — teste no kernel confirmou que a combinação ignora o período e altera os totais — custo: entidade permanece visível, mas não filtrável no painel até correção do backend.
- Conferência no navegador: usuários locais, busca vazia, preservação entre abas, detalhes relacionados e bloqueio de confirmação da mediação sem RENAVAM/aceite. Nenhuma mediação real foi enviada.
- Baseline detalhado do executor local inclui 6 linhas em users (5 ativas e 1 excluída), 1 veículo, 1 transferência, 12 eventos e 16 itens históricos de e-mail. O executor compara o hash de todas as linhas antes/depois, incluindo textos legais e pivôs de papéis.
- Revisão independente de toda a alteração realizada por review_admin_final_integration. Cinco achados importantes corrigidos em uma rodada, com cinco testes de regressão observados em RED→GREEN: ocultação de dados de validação nos diffs; busca de CNPJ alfanumérico; identificação atual do destinatário; recuperação da última página; horários de auditoria em UTC. 183/183 testes finais, lint e build aprovados.
- Conferência final de interface: filtros de data UTC válidos e invertidos, histórico fecha modais, End seleciona última aba, RENAVAM oculto no evento real do veículo, cartão aplica pending,expired, cancelamento limpa aceite/RENAVAM e prévia legal continua em modal. Layouts observados em 390, 1024 e 1440 px. Nenhuma publicação ou mediação real foi enviada.
- Final: Ruling: a revisão visual e a mediação contra veículos reais foram excluídas da revisão independente — a revisão visual foi feita diretamente no navegador; a mudança de custódia foi coberta por cenários no kernel com rollback — custo: envio real de notificações e alteração de veículo real não foram exercitados neste teste, preservando os dados do usuário.
- Final: Ruling: proteção completa dos atributos sensíveis da auditoria depende do backend — o painel os omite dos diffs e a pendência documenta a filtragem das respostas e do histórico — custo: administradores ainda conseguem receber esses valores pela API até a correção pelo responsável do backend.
