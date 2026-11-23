# Integração do painel administrativo

Verificação atualizada em 22/11/2026 no backend local `54d27fa`, com a API do Docker e o MySQL `PI_3`.

## Operações disponíveis e integradas

| Recurso | Operações |
| --- | --- |
| `/api/admin/internal-users` | Listagem paginada, busca por nome ou e-mail, ordenação e cadastro de contas administrativas |
| `/api/admin/internal-users/{id}` | Consulta, edição de nome, e-mail e senha opcional, exclusão com anonimização |
| `/api/admin/service-types` | Listagem paginada, filtros, ordenação e cadastro |
| `/api/admin/service-types/{identifier}` | Consulta, edição parcial, ativação, desativação e exclusão |
| `/api/admin/service-types/{identifier}/fields` | Consulta ordenada, criação por lote e atualização por lote |
| `/api/admin/service-types/{identifier}/fields/{id}/enable` | Ativação de campo |
| `/api/admin/service-types/{identifier}/fields/{id}/disable` | Desativação de campo |
| `/api/admin/settings?group=legal` | Leitura dos termos e da política para edição |
| `/api/admin/settings/batch` | Publicação de HTML por `PUT`, enviando apenas o documento selecionado |
| `/api/settings/{key}` | Consulta pública dos documentos, integrada ao cadastro e ao perfil |
| `/api/admin/users` e `/{id}` | Listagem de usuários `client`, busca por nome/e-mail/documento, ordenação, paginação, inclusão de excluídos e veículos da conta |
| `/api/admin/vehicles` e `/{id}` | Consulta de veículos, proprietário, contagens e transferência em aberto; inclusão de excluídos |
| `/api/admin/transfers` e `/{id}` | Consulta administrativa de transferências, partes, confirmações, tentativas e prazos |
| `/api/admin/transfers/{id}/mediate-complete` | Conclusão por mediação com RENAVAM digitado e confirmação explícita no painel |
| `/api/admin/audit-logs` e `/{id}` | Consulta de eventos, autor, período, registro, valores anteriores/posteriores, IP e agente |

O acesso usa `auth:api` e `role:admin`. As requests de cadastro interno aceitam e-mails válidos e atribuem o papel administrativo. A implementação atual usa o papel da conta para autorizar o acesso.

O identificador do serviço é a chave das rotas e é imutável na atualização. Campos possuem identificador permanente, nome de exibição, tipo, opções, descrição, obrigatoriedade, dependência pelo nome de outro campo, ordem e status.

## Falha confirmada ao limpar descrição

Um tipo de serviço com descrição preenchida conserva esse texto depois de uma atualização que envia descrição vazia ou nula. A API responde HTTP 200 com `status: success`, e a descrição retornada continua sendo a anterior.

Reprodução em um serviço que já tenha descrição preenchida

1. Enviar `PATCH /api/admin/service-types/{identifier}` com o corpo abaixo.
2. Conferir a descrição no recurso retornado.
3. Consultar o mesmo recurso por GET e conferir que o texto anterior continua persistido.

```json
{
  "description": ""
}
```

O middleware do Laravel converte a string vazia em `null`. Em `app/Http/Controllers/Admin/ServiceTypeController.php`, o método `update` filtra os valores nulos com `array_filter` antes de executar a atualização. Com isso, a descrição enviada desaparece do payload de atualização.

A correção sugerida é manter o `null` explicitamente recebido para `description`. A request já distingue propriedades ausentes e valida as propriedades presentes. Usar `$serviceType->update($request->validated())` nesse controlador permite limpar a descrição e preserva atualizações parciais, inclusive `is_active: false`.

Após a correção, verificar descrição vazia, descrição nula, atualização contendo apenas nome e desativação com `false`. O formulário do painel usa os valores retornados pela API depois de salvar.

## Falha confirmada ao combinar entidade e período na auditoria

`GET /api/admin/audit-logs` retorna eventos fora do período informado quando `filter[entity_type]` é combinado com `filter[date_from]` e `filter[date_to]`. A resposta é HTTP 200; a lista e `meta.total` incluem os eventos indevidos.

Reprodução com dois eventos `updated` do mesmo veículo, mesmo autor, um em 20/11 e outro em 22/11:

```http
GET /api/admin/audit-logs?filter[entity_type]=Vehicle&filter[event]=updated&filter[user_id]=ID_ADMIN&filter[auditable_id]=ID_VEICULO&filter[date_from]=2026-11-20&filter[date_to]=2026-11-20
```

Esperado: somente o evento de 20/11. Obtido: eventos de 20/11 e 22/11. Sem `filter[entity_type]`, a mesma consulta respeita todas as restrições e retorna apenas o evento esperado.

Em `app/Http/Controllers/Admin/AuditLogController.php`, o callback de `entity_type` adiciona `where(...)->orWhere(...)` sem agrupar as duas alternativas. Os filtros de data são adicionados depois: a precedência de `AND` e `OR` faz a primeira alternativa ignorar o período. A sugestão para o backend é envolver as alternativas em um único `where(fn ($entity) => $entity->where(...)->orWhere(...))`.

O painel oferece período, autor, evento e ID do registro. O filtro de entidade foi omitido até a correção, para evitar resultados incorretos. A entidade continua visível nas linhas e nos detalhes. Nenhum diagnóstico específico dessa falha foi incluído na interface.

## Dados de validação retornados pela auditoria

O trait `app/Traits/Auditable.php` registra atributos por `getAttributes()` e não exclui `renavam` nem `code`. Assim, o RENAVAM aparece em `old_values`/`new_values` de eventos de veículo. Foi confirmado pelo GET de detalhe de um evento criado nos cenários locais, sem imprimir o valor no relatório. `InviteRequest` também usa esse trait e tem o atributo `code`; pelo mesmo caminho, o código de convite é registrado. A lista e o detalhe de auditoria devolvem os mapas de valores sem filtrar essas propriedades.

O painel oculta RENAVAM, código, senha, remember_token e hashes de OTP ao montar as diferenças. A proteção completa precisa ocorrer no backend: impedir novos registros desses atributos e removê-los das respostas de listagem e detalhe, inclusive nos eventos históricos já salvos. O `$hidden` do modelo Vehicle não se aplica a `getAttributes()` nem ao JSON de AuditLog. Esta tarefa não altera controladores nem registros históricos do backend.

## Limites dos contratos publicados

Usuários do aplicativo e veículos possuem consulta administrativa. Não há operações publicadas de bloqueio, exclusão administrativa ou edição dessas contas e veículos; o painel não apresenta ações sem suporte da API. `internal-users` continua exclusivo para administradores.

A mediação permite concluir somente transferências `pending` ou `expired`. Exige destinatário cadastrado e ativo, RENAVAM correto e destinatário diferente do proprietário atual. A API restaura veículo excluído, muda a custódia e cancela outras transferências `pending` do veículo. A conclusão gera notificações por e-mail para as partes. O RENAVAM não é retornado pela consulta administrativa de veículos, apenas `has_renavam`.

## Validação local

### Atualização de 22/11: integração final

Backend atualizado de `2c5ff79` para `54d27fa`, com a migração de `invite_request` aplicada. `composer.lock` e o arquivo local de CORS preexistentes foram preservados.

Novas abas: Usuários e Veículos. Mediações e Auditoria passam a consultar a API real. Os totalizadores usam `meta.total`, incluindo transferências `pending,expired`; clicar nesse cartão aplica o mesmo filtro à tabela. Os detalhes abrem em modal compartilhado, com retorno ao registro anterior. Filtros e ordenação permanecem ao alternar abas. Usuários e veículos são consultivos. A auditoria exibe dias e horários em UTC para corresponder aos filtros de data da API; as demais datas usam o horário local do navegador.

Na mediação, a confirmação identifica o destinatário pelo ID e e-mail atual da conta. O e-mail original da solicitação aparece à parte. Desistir limpa RENAVAM e aceite; não há preenchimento automático. Somente a resposta `completed` para o mesmo ID é reconhecida como conclusão. Se a quantidade de resultados diminuir e a página deixar de existir, o cliente consulta novamente a última página válida com os mesmos filtros.

Validação final: **183 testes do frontend**, lint e build de produção aprovados. A revisão independente gerou cinco correções importantes, verificadas com testes observados em RED e depois GREEN: dados protegidos no diff, CNPJ alfanumérico, identificação atual do destinatário, recuperação de página e fuso da auditoria. Também foram conferidos o filtro do totalizador, as opções de exclusão e a limpeza do aceite ao desistir.

O executor `tests/integration/admin-local.php` passou **74 verificações** pelo kernel Laravel, usando o banco local e cenários temporários em uma transação externa. Cobertura: listagem/detalhes, 401/403/404, paginação de 15, buscas exatas e combinadas, CNPJ alfanumérico, excluídos, mediação válida e repetida, RENAVAM inválido ou ausente, destinatário removido/inexistente, custódia já pertencente ao destinatário, restauração de veículo, cancelamento de outras pendências, filas de e-mail, auditoria, administradores, catálogo, campos e publicação/leitura de textos legais.

O rollback foi verificado por contagem e hash de todas as linhas nas tabelas afetadas, incluindo documentos legais, papéis e filas de e-mail. As filas geradas permaneceram sem commit e não foram vistas pelo scheduler. Não houve transferência de veículo real nem envio de e-mails dos testes. IDs temporariamente reservados podem ser consumidos pelo AUTO_INCREMENT do MySQL mesmo após rollback.

Conferência visual em 390, 1024 e 1440 pixels: listas e estados vazios, preservação de filtros, navegação entre registros, teclado, histórico, prévia legal em modal, período válido/invertido, dados protegidos na auditoria, totalizador de pendências e confirmação/cancelamento da mediação. Em 390 pixels, a tabela tem rolagem própria sem ampliar a largura da página.

Executar novamente a partir de `PI3-Docker`:

```bash
docker compose exec -T backend php < frontend/PI3-Front/tests/integration/admin-local.php
```

O executor separa falhas inesperadas de `known_backend_issues`. Os problemas descritos acima continuam reportados, sem transformar um resultado incorreto da API em aprovação silenciosa.

### Atualização de 18/11: abas e documentos legais

O backend foi atualizado de `97b81dc` para `2c5ff79`, preservando as alterações locais preexistentes. As três migrações publicadas foram aplicadas sem apagar os registros existentes. Não foram criadas rotas ou alterações próprias nos controladores.

O painel agora usa abas em `/admin?aba=...`, com totalizadores acima e ações de cadastro junto da tabela. A listagem foi identificada como **Administradores**: o banco tem 5 contas, das quais 1 é administrativa. As rotas antigas continuam redirecionando para a aba correspondente.

Os documentos `terms_of_use` e `privacy_policy` são editados com Lexical, publicados em HTML e lidos diretamente da API nas telas do usuário, sem fallback para uma cópia estática. O HTML passa pela mesma sanitização na publicação e na exibição. O formulário detecta uma publicação diferente da versão carregada antes de gravar; a API ainda não oferece revisão/ETag ou escrita condicional para garantir exclusão mútua em gravações estritamente simultâneas.

A migração do backend insere textos de exemplo. Para preservar os documentos que o app já exibia, foi criada uma importação idempotente: ela substitui somente esses exemplos exatos e preserva qualquer texto já editado. Os textos anteriores estão em `docs/initial-legal-documents.json`. Executar após as migrações e antes de disponibilizar a nova leitura aos usuários:

```bash
node --experimental-default-type=module scripts/bootstrap-legal-documents.mjs \
  --api-url http://127.0.0.1:8000/api \
  --backend-env ../../backend/PI3-API/.env
```

Em outros ambientes, informar explicitamente a API correspondente e as credenciais pelas variáveis `LEGADO_ADMIN_EMAIL` e `LEGADO_ADMIN_PASSWORD`, omitindo `--backend-env`.

Essa importação já foi executada no ambiente local. Foram publicados textos temporários nos dois documentos pelo painel e conferidos na leitura pública, incluindo negrito, links e listas. Depois, os textos preservados e suas datas foram restaurados. O cadastro temporário de serviço foi removido: o banco permaneceu com 5 usuários, 1 administrador, 0 tipos de serviço e 2 documentos legais.

Também foram conferidos: buscas e filtros preservados ao alternar abas, teclado, redirecionamento dos links antigos, retorno após cadastro, fechamento de diálogos pelo histórico, paginação reiniciada pelo totalizador, prévia do editor e desfazer/refazer.

### Verificação anterior

O banco inicialmente consultado tinha 4 usuários ativos, nenhum administrador e nenhum tipo de serviço. Com autorização do usuário, foi executado `AdminUserSeeder`, utilizando `ADMIN_EMAIL` e `ADMIN_PASSWORD` já configurados no `.env` local.

Os testes verificaram as operações reais da API, criação e edição de campos, ativação e desativação, condições de obrigatoriedade, busca, status, identificadores com acentos e espaços, atualização parcial em edição concorrente e atualização da sessão ao editar a própria conta.

Cadastro, edição e exclusão de uma conta interna adicional foram verificados em uma transação desfeita ao final. A contagem de usuários permaneceu em 5, incluindo a conta administrativa local autorizada. Os serviços criados para a validação foram identificados como temporários e removidos ao concluir os testes.
