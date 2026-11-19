# Integração do painel administrativo

Verificação realizada em 18/11/2026 no backend local, com a API do Docker e o MySQL `PI_3`.

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

## Módulos que precisam de endpoints

### Usuários do aplicativo e moderação

`internal-users` consulta exclusivamente contas com papel `admin`. Para acompanhar os usuários do aplicativo, é necessária uma listagem administrativa com paginação, busca e consulta individual. As operações de moderação precisam dos respectivos contratos e regras de negócio no backend.

Como ponto de partida, a equipe pode adotar `GET /api/admin/users` e `GET /api/admin/users/{id}`, com dados e permissões apropriados à consulta administrativa.

### Mediações técnicas

As rotas atuais de transferências atendem aos envolvidos no processo. O painel precisa de consulta administrativa abrangendo as transferências, seus veículos, as partes, os prazos, as confirmações e os estados, com filtros e paginação.

Uma família `/api/admin/transfers` pode atender à listagem e ao detalhe. A equipe precisa definir quais intervenções administrativas serão permitidas e os contratos correspondentes antes de disponibilizar essas ações no painel.

### Trilha de auditoria

O backend já possui `AuditLog` e o trait `Auditable`, mas ainda precisa disponibilizar a consulta administrativa paginada. Os dados existentes incluem autor, evento, tipo e ID do registro, valores anteriores e posteriores, IP, agente de usuário e data.

Uma família `/api/admin/audit-logs` pode permitir consulta por período, autor, evento e recurso. Eventos executados por rotinas podem ter autor nulo. A consulta deve respeitar o tratamento de atributos sensíveis que o backend já aplica ao registrar os eventos.

## Validação local

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
