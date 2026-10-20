This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Cadastro integrado à API

Copie `.env.example` para `.env.local`. A configuração local usa
`NEXT_PUBLIC_API_URL=http://localhost:8000/api`. Reinicie `npm run dev` depois de
alterar a URL; em produção, configure essa variável antes do build.

O cadastro segue as requisições atuais do Postman, nesta ordem:

| Etapa | Requisição | JSON |
| --- | --- | --- |
| Solicitar código | `POST /auth/pre-register` | `name`, `email` |
| Confirmar e-mail | `POST /auth/validate-email` | `email`, `code` (string de seis dígitos) |
| Criar conta | `POST /auth/register` | `name`, `email`, `document_type` (`CPF`/`CNPJ`), `document` sem máscara, `password`, `password_confirmation`, `terms_accepted` |

O reenvio repete `pre-register` com nome e e-mail e respeita o intervalo de dois
minutos. Fechar e reabrir a confirmação mantém o código solicitado e o tempo de
espera. A API continua responsável pela validade do código e da confirmação.

O frontend interpreta o envelope Laravel `{ status, message, data }` e os erros
de validação em `errors`. Cadastro e confirmação exigem respostas reais de
sucesso; API ausente, indisponível ou com resposta inválida não simula sucesso.
Ao receber `201` com o usuário criado e `access_token`, salva a sessão usando o
mesmo mecanismo do login (`sessionStorage`) e abre `/garagem` imediatamente.
O cadastro não exibe uma tela intermediária de sucesso nem faz outra requisição
de login: utiliza o token emitido pela própria API. A navegação usa `replace`
para não acrescentar o formulário concluído ao histórico. Se o token não vier
na resposta, informa que a conta foi criada e orienta acessar pelo login.

As regras locais de cadastro acompanham `PreRegisterRequest`, `RegisterRequest`
e `CpfCnpj` da API: nome obrigatório até 255 caracteres (sem exigir sobrenome),
e-mail obrigatório até 255 caracteres e formato válido, CPF ou CNPJ com dígitos
verificadores, senha com ao menos oito caracteres, letra, número e símbolo,
confirmação igual e aceite dos termos. CNPJ aceita letras nas primeiras 12
posições; normalização, máscara e envio preservam essas letras em maiúsculas.
As categorias Unicode da senha seguem a regra Laravel, inclusive os separadores
que ela considera símbolos. O formulário não impõe os antigos limites extras de
100 caracteres no nome e 72 na senha, ausentes nesses FormRequests.

O formato de e-mail no navegador usa uma verificação simples; o backend usa o
validador RFC do Laravel. Não são validadores idênticos para todos os formatos
raros. Duplicidade de e-mail/documento, existência e expiração do código e
confirmação efetiva dependem da API. As validações do navegador ajudam na UX e
não substituem as do servidor. Outros módulos ainda não foram auditados aqui.

Erros por campo aparecem associados ao input, com um aviso geral para corrigir
os campos destacados. Conexão, timeout, credenciais inválidas, serviço ausente,
limite de tentativas e falhas internas têm mensagens próprias; erros 500 não
expõem mensagens de campos nem detalhes internos. No login a senha só precisa
estar preenchida, conforme `LoginRequest`; as regras de criação não são
reaplicadas para autenticar uma conta existente.

Para o ambiente atual do André, use `docker-compose.resend.yml` conforme o
README do repositório Docker. Esse complemento envia os e-mails pelo Resend
configurado no `.env` da API, sem expor credenciais ao frontend. Para testes
apenas locais, `docker-compose.local.yml` é a alternativa com Mailpit em
`http://localhost:8025`. Não combine os dois complementos.

Validação: `npm test`, `npm run lint` e `npm run build`. Os testes automatizados
isolam a rede para verificar contratos e falhas; a aplicação não usa essas
respostas de teste em execução. Os mocks dos módulos de garagem serão removidos
nas próximas integrações.

## Login integrado à API

A tela envia `POST /auth/login` com `{ email, password }`. O e-mail é normalizado
com trim e letras minúsculas; a senha é enviada sem alteração. Antes de enviar,
o formulário exige e-mail válido e senha preenchida, sem reaplicar regras de
criação da senha. Durante a requisição, o botão mostra “Entrando...” e fica desabilitado.

`loginWithCredentials`, em `src/app/auth-api.js`, exige HTTP 200, envelope
`status: success` e os dados `access_token`, `token_type: bearer`, `expires_in`
positivo e `user` com ID e e-mail. Respostas incompletas não iniciam uma sessão.
Credenciais incorretas (401), campos inválidos (422), limite de tentativas (429),
falhas internas, timeout e conexão usam as mensagens do tratamento de autenticação.

`src/app/auth-session.js` salva token, usuário e validade no `sessionStorage`,
sem salvar a senha. A validade respeita o menor prazo entre `expires_in` e
`exp` do JWT; no cadastro, que não retorna `expires_in`, utiliza `exp`.
A leitura de `exp` só controla a interface: a API continua responsável por
validar a assinatura e autorizar cada requisição. Sessões demonstrativas,
corrompidas ou vencidas são descartadas.

Após salvar a sessão, `src/app/page.js` limpa a senha e usa `router.replace`
para abrir `/garagem`. O `AppShell` consulta `/me`, compartilha o usuário real
com as telas e verifica a sessão a cada 30 segundos e ao voltar à aba.
`session-api.js` renova o JWT no último minuto de validade, compartilhando uma
única requisição entre chamadas concorrentes. O identificador local de sessão
é mantido no refresh e trocado no login/cadastro, para não confundir renovação
com troca de conta. Respostas de uma sessão encerrada não restauram o acesso.
Uma resposta 401 com o JWT anterior aguarda uma renovação em andamento e pode
ser repetida uma vez com o JWT renovado; não há repetição automática de operações por falha de rede.

O logout chama `POST /auth/logout` e apaga a sessão local. Se houver refresh em
andamento, aguarda a troca para revogar o token mais recente. Mesmo sem conexão,
a sessão local é apagada e o login informa que a saída no servidor não pôde ser
confirmada. Sessões inválidas ou expiradas voltam ao login. Falhas temporárias
de rede preservam uma sessão que ainda esteja válida, com aviso e opção de tentar
novamente. A sessão continua restrita ao `sessionStorage` da aba.

## Recuperação de senha

O modal usa as rotas publicadas na main da API:

| Etapa | POST | Dados |
| --- | --- | --- |
| Solicitar código | `/auth/forgot-password` | `email` |
| Validar código | `/auth/validate-reset-code` | `email`, `code` |
| Redefinir | `/auth/reset-password` | `email`, `password`, `password_confirmation` |

O código de seis dígitos é usado apenas na validação. O backend controla a
confirmação recente por e-mail, sem retornar um token fictício para o frontend.
A nova senha segue as mesmas regras de cadastro. O reenvio espera 120 segundos;
fechar e reabrir o modal mantém o e-mail, o relógio e a etapa de senha quando a
confirmação ainda vale, sem preservar senhas digitadas. A confirmação expira em
dez minutos, conforme a API. Erros 422 aparecem nos campos correspondentes e
erros de serviço/rede não avançam etapas.

## Perfil e exclusão de conta

`account-api.js` faz as chamadas protegidas usando Bearer. `/me` fornece nome,
e-mail e documento reais; o nome da saudação da garagem também usa esses dados.
**A main atual não oferece atualização do perfil:** a tela mostra os dados
somente para leitura, sem simular que um PATCH foi salvo.

A exclusão usa `POST /otp/request` com `purpose: account_deletion`, depois
`POST /otp/validate` com `purpose` e `code`. A resposta precisa conter
`action_token`. Após o usuário digitar DELETAR, `DELETE /me` recebe o token no
cabeçalho `X-Action-Token`. Não são enviados os campos inventados do protótipo
anterior. O backend consome essa autorização e faz a remoção/anonimização; uma
falha na conclusão pede nova confirmação, pois o token pode ter sido consumido.
Com sucesso, apaga a sessão e volta ao login com o aviso de conta excluída.

## Estado da entrega de 18/10/2026

API atualizada de `eb45e53` para `42feebd`; migrations de OTP e alertas aplicadas
no banco local sem apagar dados. Frontend (`b8ff82a`) e Docker (`22285ce`) já
correspondiam às respectivas mains; o trabalho de integração está na branch `feat/integracao-cadastro-email`.
A publicação se vincula às issues #9, #12 e #13; elas serão encerradas quando
o pull request correspondente for incorporado à main.
Alterações prévias de `composer.lock` e `config/cors.php` foram preservadas.
Nenhuma alteração autoral de código de backend foi necessária.

Testes reais de cadastro, login, `/me`, refresh, logout, recuperação, OTP e
exclusão foram executados com uma conta fictícia e API temporária usando banco,
cache e storage separados; os e-mails desse teste foram processados em log.
Isso valida contratos e gravação real sem exigir exclusão de uma conta do André.
A entrega de e-mail real pelo Resend deve ser conferida no teste manual.

Pendências dependentes do grupo: endpoint de edição de perfil e conteúdo/endpoint
oficial de termos e privacidade (a tela legal ainda tem conteúdo provisório).
Veículos, gastos e manutenções ainda usam mocks, nas tarefas atribuídas a outro
integrante; as atualizações publicadas do backend já estão disponíveis localmente.

Roteiro para o teste de 19/10: [docs/TESTE-CONTA-2026-10-19.md](docs/TESTE-CONTA-2026-10-19.md).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Revisão para publicação — 20/10/2026

As tarefas #9 (confirmação de e-mail), #12 (cadastro) e #13 (login, refresh e
logout) foram comparadas com a implementação. O teste manual foi concluído pelo
responsável antes da publicação. A revisão também cobriu recuperação de senha,
consulta do perfil e exclusão com OTP. Um caso adicional de 401 recebido antes
do término do refresh foi reproduzido e corrigido com teste de regressão.

Alterações do ambiente são publicadas separadamente em PI3-Docker. O backend
não faz parte do commit desta integração. As dependências de edição do perfil
e conteúdo legal continuam indicadas nas seções anteriores.
