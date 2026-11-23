#!/usr/bin/env python3
"""Gera um relatório portátil a partir das evidências reais dos fluxos do admin."""
import argparse
import base64
import hashlib
import html
import json
import re
import subprocess
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote


def read_json(root, name):
    return json.loads((root / name).read_text())


def esc(value):
    return html.escape(str(value))


def pretty(value):
    return esc(json.dumps(value, ensure_ascii=False, indent=2))


def table(headers, rows):
    return '<div class="table-wrap"><table><thead><tr>' + ''.join(f'<th>{esc(x)}</th>' for x in headers) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{esc(x)}</td>' for x in row) + '</tr>' for row in rows) + '</tbody></table></div>'


def image_uri(path):
    return 'data:image/jpeg;base64,' + base64.b64encode(path.read_bytes()).decode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('evidence_dir', type=Path)
    args = parser.parse_args()
    root = args.evidence_dir.resolve()
    seed = read_json(root, 'dados-iniciais.json')
    cases = read_json(root, 'resultados-navegador.json')
    rejected = read_json(root, 'estado-apos-renavam-invalido.json')
    normal = read_json(root, 'estado-apos-transferencia-normal.json')
    ending = read_json(root, 'resultado-final-e-limpeza.json')
    probes = read_json(root, 'pendencias-api-reproduzidas.json')
    final = ending['final']
    cleanup = ending['cleanup']
    users = {u['key']: u for u in seed['users']}
    vehicles = {v['key']: v for v in seed['vehicles']}
    transfers = {t['key']: t for t in seed['transfers']}
    final_vehicles = {v['id']: v for v in final['vehicles']}
    final_transfers = {t['id']: t for t in final['transfers']}

    # Cada condição confere uma consequência observável da ação feita no navegador.
    checks = {}
    checks['todos_checkpoints_navegador_aprovados'] = len(cases) == 23 and all(c['passed'] for c in cases)
    checks['renavam_errado_preservou_custodia'] = next(v for v in rejected['vehicles'] if v['id'] == vehicles['normal']['id'])['user_id'] == users['ana']['id'] and next(t for t in rejected['transfers'] if t['id'] == transfers['normal']['id'])['status'] == 'pending' and not rejected['email_queue']
    checks['transferencia_normal_concluida_e_concorrente_cancelada'] = final_vehicles[vehicles['normal']['id']]['user_id'] == users['bruno']['id'] and final_transfers[transfers['normal']['id']]['status'] == 'completed' and final_transfers[transfers['competing']['id']]['status'] == 'cancelled'
    checks['email_atual_do_destinatario_usado_na_fila'] = len(normal['email_queue']) == 2 and {e['recipient'] for e in normal['email_queue']} == {users['ana']['email'], users['bruno']['email']} and all(e['status'] == 'pending' for e in normal['email_queue'])
    checks['veiculo_excluido_restaurado_e_transferido'] = final_vehicles[vehicles['expired_deleted']['id']]['deleted_at'] is None and final_vehicles[vehicles['expired_deleted']['id']]['user_id'] == users['bruno']['id'] and final_transfers[transfers['expired_deleted']['id']]['status'] == 'completed'
    checks['ultima_pendencia_concluida_e_quinze_restantes'] = final_transfers[transfers['page_1']['id']]['status'] == 'completed' and final_vehicles[vehicles['page_1']['id']]['user_id'] == users['paulo']['id'] and sum(final_transfers[t['id']]['status'] == 'pending' for t in seed['transfers'] if t['key'].startswith('page_')) == 15
    checks['impedimentos_sem_alteracao_de_dados'] = all(final_transfers[transfers[key]['id']]['status'] == 'pending' and final_vehicles[vehicles[key]['id']]['user_id'] == users['ana']['id'] for key in ['no_renavam', 'removed_recipient', 'wrong_renavam'])
    checks['auditoria_real_da_mudanca_de_custodia'] = any(a['entity_type'] == 'Vehicle' and a['entity_id'] == vehicles['normal']['id'] and a['event'] == 'updated' and a['user_id'] == seed['administrator_id'] and a['old_values'].get('user_id') == users['ana']['id'] and a['new_values'].get('user_id') == users['bruno']['id'] for a in final['audits'])
    checks['auditoria_real_da_conclusao_da_transferencia'] = any(a['entity_type'] == 'VehicleTransfer' and a['entity_id'] == transfers['normal']['id'] and a['event'] == 'updated' and (a['old_values'] or {}).get('status') == 'pending' and (a['new_values'] or {}).get('status') == 'completed' for a in final['audits'])
    checks['seis_emails_ficticios_removidos_sem_envio'] = len(final['email_queue']) == 6 and all(e['status'] == 'pending' for e in final['email_queue']) and cleanup['mock_emails_removed_without_sending'] == 6
    checks['linhas_originais_preservadas_por_hash'] = cleanup['original_rows_preserved'] and seed['baseline'] == cleanup['snapshot_after']
    checks['filtro_sem_entidade_respeitou_periodo'] = [r['id'] for r in probes['period_filter'][0]['actual']] == probes['period_filter'][0]['expected_ids']
    if not all(checks.values()):
        raise SystemExit('Evidências inconsistentes: ' + ', '.join(k for k, v in checks.items() if not v))

    groups = defaultdict(list)
    for case in cases:
        groups[re.match(r'F\d+', case['id']).group()].append(case)
    groups = dict(sorted(groups.items()))
    repo = Path(__file__).resolve().parents[1]
    git = lambda *args: subprocess.check_output(['git', *args], cwd=repo, text=True).strip()
    source_paths = ['src/app/admin/operations-api.js', 'src/app/admin/_components/operation-tables.js', 'src/app/admin/_components/admin-record-dialog.js', 'src/app/admin/_lib/admin-operations.js']
    meta = {'generated_at': datetime.now().astimezone().isoformat(), 'run': seed['run'], 'frontend_branch': git('branch', '--show-current'), 'frontend_base_commit': git('rev-parse', '--short', 'HEAD'), 'backend_commit': subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=repo.parents[1] / 'backend' / 'PI3-API', text=True).strip(), 'database': 'PI_3', 'app_url': 'http://127.0.0.1:3000/admin', 'api_url': 'http://localhost:8000/api', 'source_sha256': {p: hashlib.sha256((repo / p).read_bytes()).hexdigest() for p in source_paths}}
    bundle = {'metadata': meta, 'fixtures': seed, 'browser_checkpoints': cases, 'database_cross_checks': checks, 'after_invalid_renavam': rejected, 'after_normal_transfer': normal, 'final_state_and_cleanup': ending, 'api_limitations': probes}
    bundle_bytes = json.dumps(bundle, ensure_ascii=False, indent=2).encode()
    (root / 'evidencias-completas.json').write_bytes(bundle_bytes)
    competing_audits = [a for a in final['audits'] if a['entity_type'] == 'VehicleTransfer' and a['entity_id'] == transfers['competing']['id'] and a['event'] == 'updated']
    summary = {'run': seed['run'], 'flows': len(groups), 'browser_checkpoints': len(cases), 'failed_browser_checkpoints': [], 'cross_checks': checks, 'completed_mock_transfers': [transfers[k]['id'] for k in ['normal', 'expired_deleted', 'page_1']], 'original_data_preserved': True, 'mock_emails_not_sent': 6, 'api_limitations_reproduced': ['audit_entity_period', 'audit_sensitive_values'], 'competing_cancellation_has_individual_audit_event': bool(competing_audits)}
    (root / 'sumario-validado.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))

    flow_summaries = [
        ['F01', 'Buscar e paginar usuários', '18 pessoas fictícias; busca por e-mail; nome A–Z', '15 na página 1 e 3 na página 2; nenhum repetido; estado preservado entre abas.'],
        ['F02', 'Localizar CNPJ alfanumérico', '12.abc.345/01de-35 e documento inexistente', 'Somente Bruno #140 no documento válido; lista vazia no inexistente.'],
        ['F03', 'Abrir conta e seu veículo', 'Ana #139 → Corolla #121', 'Placa, 100 km, proprietário e vínculo corretos; RENAVAM não exibido.'],
        ['F04', 'Confirmar conscientemente a mediação', 'Transferência #54; e-mail original diferente do atual', 'Aceite obrigatório; conta #140 e e-mail atual; desistir limpa o formulário.'],
        ['F05', 'Recusar RENAVAM incorreto', 'FCT1A01; RENAVAM 11111111111', 'Recusa na tela; Ana continua proprietária; transferência pendente; fila vazia.'],
        ['F06', 'Concluir transferência pendente', 'FCT1A01; RENAVAM 00990000001', 'Ana → Bruno; #54 concluída; #55 cancelada; duas notificações na fila.'],
        ['F07', 'Restaurar veículo por mediação', 'Onix FCT1A02 excluído; #56 expirada', 'Consulta de excluídos funciona; veículo restaurado, ativo e transferido para Bruno.'],
        ['F08', 'Bloquear casos impossíveis', 'FCT1A04 sem RENAVAM; FCT1A05 com destinatário excluído', 'Conclusão indisponível; custódia e estado preservados no banco.'],
        ['F09', 'Concluir a última linha da página 2', '16 pendências de Paulo; concluir #62', '15 restantes na página válida; filtros mantidos; nenhuma lista vazia indevida.'],
        ['F10', 'Filtrar e inspecionar auditoria', 'Autor 6; registro 121; dias 20 e 22/11; evento sintético #474', 'Período exato, horários UTC, 0/false/null e ocultação dos dados de validação corretos.'],
        ['F11', 'Rastrear a mediação executada', 'Evento real #476, gerado por #54', 'Auditoria mostra user_id 139 → 140 e autor administrador.'],
        ['F12', 'Consultar conta excluída', 'Carla #142, anonimizada pelo backend', 'Omitida por padrão; disponível ao incluir excluídos; estado e anonimização corretos.'],
    ]
    overview_rows = [[r[0], r[1], r[2], r[3], 'Conferido'] for r in flow_summaries]
    status_labels = {'pending': 'Pendente', 'completed': 'Concluída', 'cancelled': 'Cancelada', 'expired': 'Expirada'}
    vehicle_rows = [[v['id'], v['plate'], v['model'], v['initial_owner_id'], v['renavam'] or 'Não cadastrado', 'Excluído' if v['initial_deleted'] else 'Ativo'] for v in seed['vehicles']]
    user_rows = [[u['id'], u['name'], u['email'], u['document_type'], u['document']] for u in seed['users']]
    transfer_rows = [[t['id'], t['plate'], t['owner_id'], t['recipient_id'], status_labels[t['initial_status']], status_labels[final_transfers[t['id']]['status']]] for t in seed['transfers']]
    transitions = [
        ['FCT1A01 / #54', 'Ana #139; pendente', 'Bruno #140; concluída', 'Concorrente #55 cancelada'],
        ['FCT1A02 / #56', 'Ana #139; veículo excluído; expirada', 'Bruno #140; veículo ativo; concluída', 'Restauração confirmada no banco e na tela'],
        ['FCT2A01 / #62', 'Pessoa 01 #143; pendente; página 2', 'Paulo #141; concluída; lista com 15 pendências', 'Retorno automático à página válida'],
    ]
    sections = []
    for flow, group in groups.items():
        label = next(row[1] for row in flow_summaries if row[0] == flow)
        cards = []
        for case in sorted(group, key=lambda x: x['id']):
            shot = root / case['screenshot'] if case['screenshot'] else None
            figure = f'<details class="capture"><summary>Ver captura da tela · {esc(case["id"])}</summary><figure><img loading="lazy" src="{image_uri(shot)}" alt="{esc(case["title"])}"><figcaption>Captura do estado conferido em {esc(case["checkedAt"])}.</figcaption></figure></details>' if shot else ''
            cards.append(f'<article class="checkpoint"><div class="checkpoint-title"><h3>{esc(case["id"])} · {esc(case["title"])}</h3><span class="pill">Conferido</span></div><p class="time">{esc(case["checkedAt"])}</p><div class="two"><div><h4>Dados de entrada</h4><pre>{pretty(case["input"])}</pre></div><div><h4>Ações no navegador</h4><ol>{"".join(f"<li>{esc(step)}</li>" for step in case["steps"])}</ol><h4>Resultado esperado</h4><p>{esc(case["expected"])}</p></div></div><h4>Resultado observado</h4><pre>{pretty(case["observed"])}</pre>{figure}</article>')
        sections.append(f'<section id="{flow}" class="flow"><h2>{flow} · {esc(label)}</h2>{"".join(cards)}</section>')

    baseline_rows = [[name, state['count'], cleanup['snapshot_after'][name]['count'], 'Hash idêntico'] for name, state in seed['baseline'].items()]
    api_rows = [[('Sem entidade (usado no painel)' if index == 0 else 'Com entidade (pendência da API)'), response['http'], ', '.join(map(str, response['expected_ids'])), ', '.join(str(r['id']) for r in response['actual']), response['total']] for index, response in enumerate(probes['period_filter'])]
    embedded_download = 'data:application/json;base64,' + base64.b64encode(bundle_bytes).decode()
    nav = ''.join(f'<a href="#{flow}">{flow} · {esc(next(r[1] for r in flow_summaries if r[0] == flow))}</a>' for flow in groups)
    markup = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Validação dos fluxos do admin — 22/11/2026</title><style>
*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{margin:0;background:#f4f6fa;color:#20324a;font:15px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:1240px;margin:auto;padding:44px 28px 90px}}h1,h2,h3,h4{{line-height:1.3;color:#173453}}h1{{font-size:36px;letter-spacing:-1.2px;margin:8px 0 18px}}h2{{font-size:23px;margin:0 0 18px}}h3{{font-size:17px;margin:0}}h4{{font-size:13px;margin:18px 0 9px}}p{{margin:10px 0}}.eyebrow{{color:#51749a;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase}}.lead{{max-width:90ch;color:#55657b;font-size:17px}}.meta,.time,figcaption{{color:#6a7788;font-size:12px}}.stats{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:28px 0}}.stat,.panel,.flow{{background:white;border:1px solid #dfe6ee;border-radius:14px}}.stat{{padding:20px}}.stat strong{{font-size:31px;display:block;color:#123d6d}}.stat span{{font-size:13px;color:#627289}}.panel{{padding:28px;margin:24px 0}}.panel p{{max-width:100ch}}.flow{{padding:28px;margin:28px 0;scroll-margin-top:18px}}nav{{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0}}nav a,.download{{padding:8px 12px;border:1px solid #d2dfed;border-radius:8px;background:white;text-decoration:none;color:#24558b;font-size:12px}}.download{{display:inline-block;font-size:14px;margin-top:12px}}.table-wrap{{overflow:auto;margin:18px 0}}table{{width:100%;border-collapse:collapse;font-size:13px;min-width:650px}}th,td{{padding:13px 12px;text-align:left;vertical-align:top;border-bottom:1px solid #e6ebf1;overflow-wrap:anywhere}}th{{background:#f5f8fc;color:#596d85;font-size:12px}}td:first-child{{font-weight:600}}.checkpoint{{padding:24px 0;border-top:1px solid #e7edf4}}.checkpoint-title{{display:flex;align-items:start;justify-content:space-between;gap:20px}}.pill{{display:inline-block;background:#eaf6ee;color:#226b43;border-radius:6px;padding:3px 9px;font-size:12px;white-space:nowrap}}.two{{display:grid;grid-template-columns:1fr 1fr;gap:24px}}pre{{font:12px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f8fb;padding:16px;border:1px solid #e4eaf1;border-radius:8px;margin:10px 0}}ol{{padding-left:22px}}summary{{cursor:pointer;color:#24558b;font-weight:600;padding:12px 0}}details{{margin-top:14px}}figure{{margin:12px 0}}figure img{{display:block;width:100%;height:auto;border:1px solid #d8e0eb;border-radius:8px}}figcaption{{margin-top:8px}}.limit{{border-left:4px solid #cf993e;padding-left:18px;margin:22px 0}}.ok{{border-left:4px solid #3d9562;padding-left:18px}}code{{font-size:.9em}}footer{{margin-top:32px;color:#6a7788;font-size:12px}}@media(max-width:760px){{main{{padding:24px 16px}}h1{{font-size:29px}}.stats{{grid-template-columns:1fr 1fr}}.two{{grid-template-columns:1fr}}.panel,.flow{{padding:20px}}.checkpoint-title{{display:block}}.pill{{margin-top:10px}}}}@media print{{body{{background:white}}main{{max-width:none;padding:0}}nav,.download{{display:none}}.flow,.panel,.stat{{break-inside:avoid}}}}
</style></head><body><main>
<header><p class="eyebrow">LegadoCar · evidências de execução · 22 de novembro de 2026</p><h1>Validação dos fluxos do admin</h1><p class="lead">Dados fictícios conhecidos, frontend e API reais, MySQL local. Cada roteiro registra a entrada, as ações no navegador, o resultado esperado, o resultado observado e a captura correspondente.</p><p class="meta">Execução: {esc(seed['run'])} · API {esc(meta['backend_commit'])} · frontend na branch {esc(meta['frontend_branch'])}, com alterações locais sobre {esc(meta['frontend_base_commit'])}.</p></header>
<div class="stats"><div class="stat"><strong>{len(groups)}</strong><span>fluxos do admin</span></div><div class="stat"><strong>{len(cases)}</strong><span>checkpoints de navegador conferidos</span></div><div class="stat"><strong>3</strong><span>transferências fictícias concluídas</span></div><div class="stat"><strong>0</strong><span>registros originais alterados</span></div></div>
<section class="panel"><h2>Resultado desta rodada</h2><p class="ok">Os fluxos de Usuários, Veículos, Mediações e Auditoria tiveram os resultados esperados. As consequências das transferências também foram consultadas diretamente no banco. Duas limitações da API de auditoria foram reproduzidas e estão descritas separadamente abaixo.</p><p>Os mocks são registros fictícios criados para o teste; as respostas do servidor não foram simuladas. Cadastros, convites e aceites reais de usuários não foram executados para preparar esses dados: as fixtures foram criadas diretamente pelo executor local.</p><p>O processamento de e-mails ficou parado durante o teste. Foram conferidas seis entradas na fila, todas ainda pendentes, e removidas antes de retomar o scheduler. O envio externo e a entrega em caixa de entrada não fazem parte do resultado.</p>{table(['Roteiro','Fluxo','Entrada principal','Resultado observado','Situação'],overview_rows)}</section>
<section class="panel"><h2>Três mudanças de custódia conferidas</h2>{table(['Veículo / solicitação','Antes','Depois','Efeito adicional'],transitions)}<p>Depois dos testes, os 22 usuários, 22 veículos e 24 transferências fictícios foram removidos. Os números acima e as capturas são evidências da execução; esses cadastros não permanecem disponíveis no banco.</p></section>
<section class="panel"><h2>Dados usados</h2><p>Todas as pessoas e documentos abaixo são sintéticos. Os endereços terminam em <code>example.invalid</code>. A conta administradora local existente foi usada apenas para operar o painel; sua senha e seu token não são incluídos.</p><h3>Pessoas dos cenários principais</h3>{table(['ID','Nome preparado','E-mail preparado','Tipo','Documento sintético'],user_rows[:4])}<p>Carla #142 foi excluída pelo modelo do backend durante a preparação. Por isso, sua consulta exibe “Usuário Removido”, documento zerado e e-mail anonimizado, conforme F12.</p><details><summary>Ver os 18 usuários adicionais de paginação</summary>{table(['ID','Nome','E-mail','Tipo','Documento sintético'],user_rows[4:])}</details><h3>Veículos principais</h3>{table(['ID','Placa','Modelo','Proprietário inicial (ID)','RENAVAM fictício','Estado inicial'],vehicle_rows[:6])}<details><summary>Ver os 16 veículos de paginação</summary>{table(['ID','Placa','Modelo','Proprietário inicial (ID)','RENAVAM fictício','Estado inicial'],vehicle_rows[6:])}</details><details><summary>Ver as 24 transferências preparadas e seus estados finais</summary>{table(['ID','Placa','Origem (ID)','Destinatário (ID)','Estado inicial','Estado final observado'],transfer_rows)}</details><p>A solicitação #54 guarda o e-mail original <code>bruno.antigo.{esc(seed['run'])}@example.invalid</code>; a conta #140 usa o endereço atual listado acima. A confirmação e a fila utilizaram a conta e o e-mail atuais.</p></section>
<section class="panel"><h2>Roteiros e evidências</h2><p>Os horários dos checkpoints são UTC. As capturas mostram o estado no momento do teste; os totalizadores incluem os dados fictícios e variam durante as transferências.</p><nav aria-label="Roteiros">{nav}</nav></section>
{''.join(sections)}
<section class="panel"><h2>Limitações confirmadas na API</h2><div class="limit"><h3>Entidade combinada com período na auditoria</h3><p>Com autor 6, veículo 121, evento updated e período 20/11/2026, o painel recebeu apenas o evento #475. Ao acrescentar <code>entity_type=Vehicle</code> à mesma chamada da API, o servidor devolveu também #474 e #476, de 22/11. O painel permanece sem esse filtro de entidade.</p>{table(['Consulta','HTTP','IDs esperados','IDs retornados','Total'],api_rows)}<details><summary>Ver chamadas exatas, sem token</summary><pre>{pretty([{**p,'request':unquote(p['request'])} for p in probes['period_filter']])}</pre></details></div><div class="limit"><h3>Dados de validação presentes na resposta de auditoria</h3><p>O evento sintético #474 foi preparado com as chaves <code>renavam</code> e <code>code</code>. O endpoint de detalhe devolveu ambas, mas o painel não mostrou os campos nem seus valores (F10b). A filtragem na API, inclusive dos eventos históricos, continua pendente.</p><pre>{pretty(probes['sensitive_response'])}</pre></div><h3>Observação sobre o cancelamento concorrente</h3><p>A solicitação #55 foi cancelada e a alteração foi conferida na tabela e no banco. Não foi encontrado um evento individual de alteração de #55 na auditoria. A API realiza esse cancelamento em lote. A mudança de custódia de #121 e a conclusão de #54 geraram os eventos #476 e #477, que foram conferidos. A equipe pode avaliar se precisa registrar também o cancelamento individual.</p></section>
<section class="panel"><h2>Preservação dos dados e encerramento</h2><p>Após a limpeza, a quantidade e o hash de todas as linhas originais coincidiram em cada tabela abaixo. O scheduler foi retomado somente depois de remover os seis e-mails fictícios.</p>{table(['Tabela','Linhas antes','Linhas depois','Comparação'],baseline_rows)}<p>As sequências automáticas de ID avançam quando o MySQL reserva IDs. A conferência garante a preservação das linhas originais, não o retrocesso dessas sequências.</p><details><summary>Ver todas as conferências de banco</summary><pre>{pretty(checks)}</pre></details><details><summary>Versões e hashes dos arquivos do frontend exercitados</summary><pre>{pretty(meta)}</pre></details><a class="download" download="evidencias-fluxos-admin-20261122.json" href="{embedded_download}">Baixar dados completos desta execução (JSON)</a></section>
<footer>Relatório gerado das capturas e observações desta execução. A preparação reproduz cenários administrativos com dados sintéticos; os eventos de mediação destacados como reais foram gerados pelas ações no navegador, contra a API local.</footer>
</main></body></html>'''
    output = root / 'relatorio-fluxos-admin.html'
    output.write_text(markup)
    print(json.dumps({'report': str(output), 'bytes': output.stat().st_size, 'flows': len(groups), 'checkpoints': len(cases), 'cross_checks': checks}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
