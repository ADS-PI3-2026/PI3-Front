# Revisão de requisições na navegação

## Causas encontradas

1. AppShell era criado dentro de cada página e começava sempre com user=null.
   Garagem e perfil faziam GET /me novamente antes de mostrar o conteúdo.
2. A lista de veículos era buscada a cada abertura da garagem.
3. Chamadas GET iguais em andamento não eram compartilhadas, inclusive quando
   efeitos eram repetidos no modo de desenvolvimento.

## Mudanças

- SessionProvider no layout raiz mantém a sessão entre navegações; o usuário vem
  da resposta real de login, cadastro ou refresh salva na sessão da aba.
- Um único monitor cuida da validade e do refresh. A leitura da sessão não faz
  GET /me. O Perfil revalida os dados em segundo plano ao ser aberto e quando
  o usuário retorna à aba, usando GET /me sem cache HTTP. Assim, alterações
  feitas em outro dispositivo são refletidas sem exigir um novo login.
  Atualizações do usuário notificam os componentes que usam a sessão.
- O conteúdo permanece visível durante essa revalidação; se ela falhar, uma
  mensagem informa que os dados podem estar desatualizados e permite tentar
  novamente. Não há consulta periódica de perfil em todas as telas.
- GETs JSON simultâneos são deduplicados por sessão, URL e revisão dos dados.
- ListVehicles usa cache de 30s. GetCachedVehicles entrega o snapshot existente
  para renderizar a volta à garagem sem reiniciar o loading da lista. Após vencer,
  o efeito atualiza os dados; alterações invalidam o cache.
- Cache e respostas antigas não atravessam uma nova autenticação. Escritas,
  download de arquivos e validações OTP não são deduplicados como leituras JSON.
- Uma leitura iniciada antes de uma alteração não repopula o cache depois dela.

## Resultado esperado: garagem → perfil → garagem

Com sessão válida e lista consultada há menos de 30s:

| Chamada | Antes | Agora |
| --- | --- | --- |
| GET /me | A cada entrada nas páginas, bloqueando a tela | Ao entrar no Perfil, em segundo plano; não ao voltar à Garagem |
| GET /vehicles | A cada retorno à garagem | Reutiliza a resposta recente |
| POST /auth/refresh | Só próximo do vencimento | Mesma regra; monitor compartilhado |

A tela de carregamento de sessão continua no primeiro carregamento/hidratação
ou quando não há sessão válida. A troca comum de telas usa o estado já pronto.
Atualizações de veículo/manutenção continuam solicitando dados reais quando
necessário; não foi aplicado cache permanente aos módulos.

## Verificações

Testes cobrem reutilização, vencimento, leituras simultâneas, invalidação após
escrita, nova autenticação, erro não armazenado e resposta antiga após alteração.
O store foi verificado com snapshots de SSR estáveis, logout imediato,
atualização explícita do perfil e ausência de GET /me no monitor da sessão.
Testes de revalidação cobrem mudança de e-mail entre entradas no Perfil,
retorno do foco, consultas simultâneas, desmontagem e recuperação de falha.

No navegador, recarregue uma vez após a mudança no layout e abra Network. Alterne
entre garagem e perfil dentro de 30s: deve aparecer /me ao entrar no Perfil,
sem uma tela inteira de carregamento, e nenhum novo /vehicles ao voltar à Garagem.
Uma alteração no usuário feita em outro dispositivo deve aparecer após entrar
novamente no Perfil ou retornar à aba. Não há sincronização em tempo real
enquanto a pessoa permanece na mesma tela sem esses eventos.
Depois de alterar um veículo, retornar à garagem deve consultar a lista
atualizada. O recebimento de 401 continua encerrando a sessão.
