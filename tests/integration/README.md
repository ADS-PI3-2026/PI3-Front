# Validação local dos fluxos administrativos

`admin-local.php` verifica os contratos pelo kernel Laravel, com cenários em uma transação revertida. `admin-flow-fixtures.php` prepara dados fictícios **persistidos temporariamente**, para operar o frontend real pelo navegador. Os executores usam somente o banco local `PI_3`.

A rodada de 22/11/2026 percorreu Usuários, Veículos, Mediações e Auditoria: 12 roteiros, 23 checkpoints de navegador e conferência dos efeitos no banco. Os dados, resultados, capturas e hashes foram reunidos no relatório `relatorio-fluxos-admin.html`, acompanhado de `evidencias-completas.json`. Nesta rodada, os mocks foram removidos e o scheduler foi retomado. Não há alterações novas no comportamento do aplicativo por causa deste roteiro de testes.

Para repetir, executar da pasta `PI3-Docker`, com um identificador novo a cada rodada. Exemplo: `fluxos-admin-repeticao-01`.

1. Parar o scheduler usando o complemento que já estiver configurado no ambiente. No ambiente atual:

   ```bash
   docker compose --env-file backend/PI3-API/.env -f docker-compose.yml -f docker-compose.resend.yml stop scheduler
   ```

2. Preparar os mocks e salvar o manifest emitido, que contém nomes, documentos sintéticos, placas, RENAVAMs fictícios e IDs:

   ```bash
   docker compose exec -T -e LEGADO_FLOW_ACTION=seed -e LEGADO_FLOW_RUN=fluxos-admin-repeticao-01 backend php < frontend/PI3-Front/tests/integration/admin-flow-fixtures.php > /tmp/admin-flow-dados.json
   ```

3. Operar o painel em `http://127.0.0.1:3000/admin` com a conta administrativa local. Os dados de autenticação existentes não são modificados nem incluídos no manifest. Usar exclusivamente os IDs e placas emitidos pelo executor. Os mocks são criados diretamente pelo ORM; isso não testa o cadastro público de usuários/veículos.

4. Observar os efeitos e reproduzir os dois problemas de auditoria, sem expor credenciais:

   ```bash
   docker compose exec -T -e LEGADO_FLOW_ACTION=inspect -e LEGADO_FLOW_RUN=fluxos-admin-repeticao-01 backend php < frontend/PI3-Front/tests/integration/admin-flow-fixtures.php > /tmp/admin-flow-estado.json
   docker compose exec -T -e LEGADO_FLOW_ACTION=probe -e LEGADO_FLOW_RUN=fluxos-admin-repeticao-01 backend php < frontend/PI3-Front/tests/integration/admin-flow-fixtures.php > /tmp/admin-flow-auditoria.json
   ```

5. Limpar os mocks. O executor remove somente os IDs da própria execução e as notificações para os respectivos e-mails fictícios. Antes de confirmar a limpeza, confere os hashes das linhas originais. Se a comparação falhar, a limpeza é revertida para investigação e o scheduler deve continuar parado.

   ```bash
   docker compose exec -T -e LEGADO_FLOW_ACTION=cleanup -e LEGADO_FLOW_RUN=fluxos-admin-repeticao-01 backend php < frontend/PI3-Front/tests/integration/admin-flow-fixtures.php > /tmp/admin-flow-limpeza.json
   ```

6. Depois de confirmar a limpeza, retomar o scheduler pelo mesmo complemento:

   ```bash
   docker compose --env-file backend/PI3-API/.env -f docker-compose.yml -f docker-compose.resend.yml start scheduler
   ```

O manifest também é guardado em `storage/app/<identificador>.json` no backend para permitir encerrar uma rodada interrompida. Os e-mails dos mocks terminam em `example.invalid`; o scheduler fica parado para que nem esses itens sejam processados. As sequências de IDs do MySQL podem avançar mesmo depois de remover os mocks.

O roteiro de navegador tem passos e evidências no relatório. Ele não é apresentado como uma suíte automatizada de interface executável por um único comando. O gerador `scripts/build-admin-flow-report.py` reúne os arquivos de observação da rodada e confere os efeitos no banco antes de produzir o HTML portátil.
