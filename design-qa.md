# Design QA — Garagem e configurações

## Evidências

- Source visual truth: `/tmp/legadocar-screen-12.png`
- Implementação final: `/tmp/legadocar-garagem-impl-v4.png`
- Configurações do perfil mobile: `/tmp/legadocar-profile-tabs-grid.png`
- Configurações do perfil desktop: `/tmp/legadocar-profile-tabs-desktop.png`
- Rota comparada: `http://localhost:3000/garagem`
- Viewport CSS: `428 x 1135`
- Pixels da fonte: `428 x 1135`
- Pixels da implementação: `428 x 1135`
- Normalização: comparação 1:1, mesma largura, altura e densidade de captura; sem moldura de dispositivo.
- Estado: dashboard carregado com os dois veículos e o resumo de gastos do documento.

## Comparação visual final

A comparação full-view foi feita com a fonte e a implementação no mesmo input visual. A hierarquia, a ordem do conteúdo, o gráfico, as três categorias, os cartões de veículos, os estados de manutenção, o botão flutuante e a navegação inferior estão presentes e alinhados ao mockup.

As diferenças residuais são aceitáveis: a implementação usa ícones da biblioteca Phosphor e pequenos ajustes de raio/sombra para manter consistência com as telas de autenticação existentes. Não foi necessária uma comparação de região separada porque textos, ícones, placas, gráfico, barras de progresso e navegação estão legíveis na comparação 1:1 de 428 px.

## Superfícies de fidelidade

- Tipografia: escala, pesos e hierarquia equivalentes; sem truncamento ou quebra inesperada.
- Espaçamento e layout: ritmo vertical, cartões, gráfico, veículos, botão flutuante e barra inferior preservam a composição do mockup.
- Cores e tokens: azul principal, cinzas, vermelho de atraso e marrom de fluidos mantêm o significado e o contraste da referência.
- Imagens e ativos: a tela não depende de fotografia ou ilustração; gráfico e ícones são vetoriais e nítidos.
- Copy e conteúdo: saudação, resumo, categorias, veículos, placas, quilometragens e estados correspondem ao documento.
- Responsividade: sem overflow horizontal em `428`, `768` e `1280` px.
- Acessibilidade: regiões nomeadas, títulos semânticos, links/botões rotulados e foco visível.

## Histórico de iterações P0/P1/P2

1. Primeira comparação (`/tmp/legadocar-garagem-impl.png`):
   - P2 — densidade e hierarquia divergiam por cabeçalhos auxiliares, valores extras na legenda e CTA de largura total.
   - Correção — removidos elementos auxiliares, compactada a copy e substituído o CTA pelo botão flutuante da referência.
2. Segunda comparação (`/tmp/legadocar-garagem-impl-v2.png`):
   - P2 — a animação do gráfico permitia uma captura intermediária com o anel incompleto.
   - Correção — animação desativada para renderização determinística do dashboard.
3. Comparação final (`/tmp/legadocar-garagem-impl-v4.png`):
   - Evidência pós-correção em `428 x 1135`, sem diferenças P0/P1/P2 acionáveis.

## Testes de interação

- Login em modo de preview navega para `/garagem`.
- Navegação inferior alterna entre `/garagem` e `/perfil`.
- Perfil alterna entre quatro painéis por abas, incluindo navegação por setas do teclado.
- Atualização do perfil valida os campos e prepara `PATCH /users/me` em JSON.
- Termos abrem em modal e retornam para `/perfil` ao fechar.
- Solicitação de exclusão exige `EXCLUIR` e prepara `POST /users/me/deletion-requests` em JSON, sem exclusão real.
- Console verificado sem erros ou avisos nas rotas testadas.

## Achados restantes

- P3 — o botão flutuante de adicionar veículo está visualmente pronto, mas permanece desabilitado nesta entrega parcial; ele será ativado junto ao formulário FIPE na próxima etapa.

## Checklist

- [x] Dashboard alinhado ao mockup.
- [x] Configurações responsivas e navegáveis.
- [x] JSONs de perfil e exclusão preparados.
- [x] Estados de navegação e documentos legais testados.
- [x] Sem P0/P1/P2 pendente neste recorte.

final result: passed
