<?php

/**
 * Dados temporários para conferir os fluxos do admin pelo navegador.
 * Executar com o scheduler parado. LEGADO_FLOW_ACTION: seed, inspect, probe, cleanup.
 * LEGADO_FLOW_RUN identifica exclusivamente esta execução. O manifest permite
 * limpar somente estes registros e conferir os hashes das linhas originais.
 */
require '/var/www/backend/vendor/autoload.php';
$app = require '/var/www/backend/bootstrap/app.php';
$app->instance('request', Illuminate\Http\Request::create('http://localhost'));
$app->make(Illuminate\Contracts\Http\Kernel::class)->bootstrap();

use App\Models\AuditLog;
use App\Models\EmailQueue;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleTransfer;
use Illuminate\Support\Facades\DB;

function originalSnapshot(): array {
    $snapshot = [];
    foreach (['users', 'model_has_roles', 'vehicles', 'vehicle_transfers', 'audit_logs', 'email_queues', 'service_types', 'service_type_fields', 'settings', 'invite_request'] as $table) {
        $rows = DB::table($table)->get()->map(fn ($row) => json_encode((array) $row, JSON_THROW_ON_ERROR))->all();
        sort($rows);
        $snapshot[$table] = ['count' => count($rows), 'sha256' => hash('sha256', implode("\n", $rows))];
    }
    return $snapshot;
}
function totals(): array {
    return ['users' => User::role('client')->count(), 'vehicles' => Vehicle::count(), 'open_transfers' => VehicleTransfer::whereIn('status', ['pending', 'expired'])->count()];
}
function cpfFor(int $index): string {
    $base = (string) (900000000 + $index);
    foreach ([10, 11] as $weight) {
        $sum = 0;
        foreach (str_split($base) as $position => $digit) $sum += (int) $digit * ($weight - $position);
        $remainder = $sum % 11;
        $base .= $remainder < 2 ? '0' : (string) (11 - $remainder);
    }
    return $base;
}
function observation(array $manifest): array {
    $userIds = array_column($manifest['users'], 'id');
    $vehicleIds = array_column($manifest['vehicles'], 'id');
    $transferIds = array_column($manifest['transfers'], 'id');
    return [
        'observed_at' => gmdate('c'),
        'totals' => totals(),
        'users' => User::withTrashed()->whereIn('id', $userIds)->get()->map(fn ($user) => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'document' => $user->document, 'deleted_at' => $user->deleted_at?->toISOString(), 'vehicles_count' => $user->vehicles()->count()])->all(),
        'vehicles' => Vehicle::withTrashed()->whereIn('id', $vehicleIds)->get()->map(fn ($vehicle) => ['id' => $vehicle->id, 'plate' => $vehicle->plate, 'user_id' => $vehicle->user_id, 'mileage' => $vehicle->mileage, 'deleted_at' => $vehicle->deleted_at?->toISOString()])->all(),
        'transfers' => VehicleTransfer::whereIn('id', $transferIds)->get(['id', 'vehicle_id', 'current_owner_id', 'recipient_id', 'recipient_email', 'status', 'failed_attempts'])->toArray(),
        'audits' => AuditLog::where(function ($query) use ($vehicleIds, $transferIds) {
            $query->where(fn ($q) => $q->where('auditable_type', Vehicle::class)->whereIn('auditable_id', $vehicleIds))
                ->orWhere(fn ($q) => $q->where('auditable_type', VehicleTransfer::class)->whereIn('auditable_id', $transferIds));
        })->get()->map(fn ($audit) => ['id' => $audit->id, 'user_id' => $audit->user_id, 'entity_type' => class_basename($audit->auditable_type), 'entity_id' => $audit->auditable_id, 'event' => $audit->event, 'created_at' => $audit->created_at->format('Y-m-d H:i:s'), 'old_values' => array_intersect_key($audit->old_values ?? [], array_flip(['user_id', 'status', 'mileage', 'enabled', 'note'])), 'new_values' => array_intersect_key($audit->new_values ?? [], array_flip(['user_id', 'status', 'mileage', 'enabled', 'note']))])->all(),
        'email_queue' => EmailQueue::whereIn('recipient', $manifest['emails'])->get(['id', 'recipient', 'subject', 'template', 'status'])->toArray(),
    ];
}

try {
    $action = getenv('LEGADO_FLOW_ACTION') ?: '';
    $run = getenv('LEGADO_FLOW_RUN') ?: '';
    if (!in_array($action, ['seed', 'inspect', 'probe', 'cleanup'], true) || !preg_match('/^fluxos-admin-[a-z0-9-]+$/', $run)) throw new RuntimeException('Ação ou execução inválida.');
    if (DB::getDatabaseName() !== 'PI_3') throw new RuntimeException('Este executor está restrito ao MySQL local PI_3.');
    $path = storage_path('app/'.$run.'.json');
    if ($action !== 'seed') {
        if (!is_file($path)) throw new RuntimeException('Manifest da execução não encontrado.');
        $manifest = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        if ($manifest['run'] !== $run) throw new RuntimeException('Manifest de outra execução.');
    }
    if ($action === 'seed') {
        if (is_file($path)) throw new RuntimeException('Esta execução já foi criada. Use inspect ou cleanup.');
        $manifest = ['run' => $run, 'started_at' => gmdate('c'), 'baseline' => originalSnapshot(), 'baseline_totals' => totals(), 'users' => [], 'vehicles' => [], 'transfers' => [], 'emails' => [], 'audit_examples' => [], 'administrator_id' => User::role('admin')->firstOrFail()->id];
        DB::beginTransaction();
        $createUser = function (string $key, string $name, string $emailPrefix, int $index, bool $company = false) use (&$manifest, $run): User {
            $email = "{$emailPrefix}.{$run}@example.invalid";
            $document = $company ? '12ABC34501DE35' : cpfFor($index);
            if (User::withTrashed()->where('email', $email)->orWhere('document', $document)->exists()) throw new RuntimeException('Colisão de dados fictícios. Nenhum dado foi confirmado.');
            $user = User::create(['name' => $name, 'email' => $email, 'document_type' => $company ? 'CNPJ' : 'CPF', 'document' => $document, 'password' => bin2hex(random_bytes(32)), 'terms_accepted_at' => now()]);
            $user->assignRole('client');
            $manifest['users'][] = ['key' => $key, 'id' => $user->id, 'name' => $name, 'email' => $email, 'document_type' => $user->document_type, 'document' => $document];
            $manifest['emails'][] = $email;
            return $user;
        };
        $ana = $createUser('ana', 'MOCK Ana Costa', 'ana', 41);
        $bruno = $createUser('bruno', 'MOCK Bruno Lima Ltda', 'bruno.atual', 42, true);
        $paulo = $createUser('paulo', 'MOCK Paulo Nunes', 'paginacao', 43);
        $carla = $createUser('carla_removed', 'MOCK Carla Dias', 'carla', 44);
        $pagingUsers = [];
        for ($i = 1; $i <= 18; $i++) $pagingUsers[] = $createUser('user_page_'.$i, 'MOCK Pessoa '.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'pessoa'.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 50 + $i);
        $createVehicle = function (string $key, int $index, User $owner, string $brand, string $model, bool $removed = false, bool $missingRenavam = false) use (&$manifest): Vehicle {
            $plate = $index < 100 ? 'FCT1A'.str_pad((string) $index, 2, '0', STR_PAD_LEFT) : 'FCT2A'.str_pad((string) ($index - 100), 2, '0', STR_PAD_LEFT);
            $renavam = $missingRenavam ? '' : '0099'.str_pad((string) $index, 7, '0', STR_PAD_LEFT);
            if (Vehicle::withTrashed()->where('plate', $plate)->orWhere('renavam', $renavam)->exists()) throw new RuntimeException('Placa ou RENAVAM fictício já existe. Nenhuma escrita confirmada.');
            $vehicle = Vehicle::create(['user_id' => $owner->id, 'type' => 'car', 'brand' => $brand, 'model' => 'MOCK '.$model, 'year' => 2024, 'plate' => $plate, 'renavam' => $renavam, 'mileage' => $index * 100, 'color' => 'Prata']);
            if ($removed) $vehicle->delete();
            $manifest['vehicles'][] = ['key' => $key, 'id' => $vehicle->id, 'initial_owner_id' => $owner->id, 'brand' => $brand, 'model' => $vehicle->model, 'plate' => $plate, 'year' => 2024, 'renavam' => $renavam, 'mileage' => $vehicle->mileage, 'initial_deleted' => $removed];
            return $vehicle;
        };
        $normal = $createVehicle('normal', 1, $ana, 'Toyota', 'Corolla');
        $expired = $createVehicle('expired_deleted', 2, $ana, 'Chevrolet', 'Onix', true);
        $wrong = $createVehicle('wrong_renavam', 3, $ana, 'Hyundai', 'HB20');
        $noRenavam = $createVehicle('no_renavam', 4, $ana, 'Fiat', 'Argo', false, true);
        $removedRecipient = $createVehicle('removed_recipient', 5, $ana, 'Renault', 'Kwid');
        $archived = $createVehicle('archived', 6, $bruno, 'Renault', 'Sandero', true);
        $createTransfer = function (string $key, Vehicle $vehicle, User $recipient, string $status = 'pending', ?string $originalEmail = null) use (&$manifest): VehicleTransfer {
            $transfer = VehicleTransfer::create(['vehicle_id' => $vehicle->id, 'current_owner_id' => $vehicle->user_id, 'recipient_id' => $recipient->id, 'recipient_email' => $originalEmail ?? $recipient->email, 'initiated_by' => 'owner', 'owner_otp_hash' => 'mock-no-valid-otp', 'recipient_otp_hash' => 'mock-no-valid-otp', 'status' => $status, 'expires_at' => $status === 'expired' ? now()->subDay() : now()->addDays(2)]);
            $manifest['transfers'][] = ['key' => $key, 'id' => $transfer->id, 'vehicle_id' => $vehicle->id, 'plate' => $vehicle->plate, 'initial_status' => $status, 'owner_id' => $vehicle->user_id, 'recipient_id' => $recipient->id, 'recipient_email_original' => $transfer->recipient_email, 'recipient_email_current' => $recipient->email];
            $manifest['emails'][] = $transfer->recipient_email;
            return $transfer;
        };
        $createTransfer('normal', $normal, $bruno, 'pending', "bruno.antigo.{$run}@example.invalid");
        $createTransfer('competing', $normal, $bruno);
        $createTransfer('expired_deleted', $expired, $bruno, 'expired');
        $createTransfer('wrong_renavam', $wrong, $bruno);
        $createTransfer('no_renavam', $noRenavam, $bruno);
        $createTransfer('removed_recipient', $removedRecipient, $carla);
        $createTransfer('historical_completed', $archived, $bruno, 'completed');
        $createTransfer('historical_cancelled', $wrong, $bruno, 'cancelled');
        $carla->delete();
        for ($i = 1; $i <= 16; $i++) {
            $vehicle = $createVehicle('page_'.$i, 100 + $i, $pagingUsers[0], 'MOCK Paginação', 'Veículo '.str_pad((string) $i, 2, '0', STR_PAD_LEFT));
            $transfer = $createTransfer('page_'.$i, $vehicle, $paulo);
            $transfer->created_at = now()->subMinutes(100 - $i); $transfer->saveQuietly();
        }
        foreach ([['diff_midnight', '2026-11-22 01:00:00', ['mileage' => 0, 'enabled' => false, 'note' => null, 'renavam' => '00990000001', 'code' => 'CONVITE-MOCK-ANTES'], ['mileage' => 12500, 'enabled' => true, 'note' => 'Conferido no teste', 'renavam' => '00990000002', 'code' => 'CONVITE-MOCK-DEPOIS']], ['period_day20', '2026-11-20 12:00:00', ['note' => 'Antes'], ['note' => 'Evento de 20/11']]] as [$key, $date, $before, $after]) {
            $audit = AuditLog::create(['user_id' => $manifest['administrator_id'], 'auditable_type' => Vehicle::class, 'auditable_id' => $normal->id, 'event' => 'updated', 'old_values' => $before, 'new_values' => $after, 'ip_address' => '127.0.0.1', 'user_agent' => $run]);
            $audit->created_at = $date; $audit->save();
            $manifest['audit_examples'][] = ['key' => $key, 'id' => $audit->id, 'entity_id' => $normal->id, 'created_at_utc' => $date, 'before' => $before, 'after' => $after];
        }
        $manifest['emails'] = array_values(array_unique($manifest['emails']));
        $manifest['initial'] = observation($manifest);
        file_put_contents($path, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        DB::commit();
        echo json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n";
    } elseif ($action === 'inspect') {
        echo json_encode(observation($manifest), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n";
    } elseif ($action === 'probe') {
        $admin = User::role('admin')->findOrFail($manifest['administrator_id']);
        $token = auth('api')->login($admin);
        $call = function (string $path) use ($app, $token): array {
            $app['auth']->forgetGuards();
            $app['tymon.jwt']->unsetToken();
            $app['tymon.jwt.auth']->unsetToken();
            $request = Illuminate\Http\Request::create('/api'.$path, 'GET', [], [], [], ['HTTP_ACCEPT' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.$token]);
            $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
            $response = $kernel->handle($request);
            $body = json_decode($response->getContent(), true);
            $kernel->terminate($request, $response);
            return ['http' => $response->getStatusCode(), 'data' => $body['data'] ?? null];
        };
        $vehicle = collect($manifest['vehicles'])->firstWhere('key', 'normal');
        $expected = collect($manifest['audit_examples'])->firstWhere('key', 'period_day20');
        $diff = collect($manifest['audit_examples'])->firstWhere('key', 'diff_midnight');
        $filters = ['event' => 'updated', 'user_id' => $admin->id, 'auditable_id' => $vehicle['id'], 'date_from' => '2026-11-20', 'date_to' => '2026-11-20'];
        $result = [];
        foreach ([false, true] as $entityFilter) {
            $query = $filters;
            if ($entityFilter) $query['entity_type'] = 'Vehicle';
            $path = '/admin/audit-logs?'.http_build_query(['filter' => $query]);
            $response = $call($path);
            $result[] = ['request' => '/api'.$path, 'http' => $response['http'], 'expected_ids' => [$expected['id']], 'actual' => array_map(fn ($log) => array_intersect_key($log, array_flip(['id', 'entity_type', 'entity_id', 'event', 'created_at'])), $response['data']['data'] ?? []), 'total' => $response['data']['meta']['total'] ?? null];
        }
        $raw = $call('/admin/audit-logs/'.$diff['id']);
        echo json_encode(['period_filter' => $result, 'sensitive_response' => ['request' => '/api/admin/audit-logs/'.$diff['id'], 'http' => $raw['http'], 'sensitive_keys_present_in_response' => array_values(array_intersect(['renavam', 'code'], array_keys($raw['data']['new_values'] ?? []))), 'visible_in_panel' => false, 'panel_verification' => 'F10b']], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n";
    } else {
        if (isset($manifest['cleanup'])) { echo json_encode($manifest['cleanup'], JSON_PRETTY_PRINT)."\n"; exit(0); }
        $final = observation($manifest);
        $userIds = array_column($manifest['users'], 'id');
        $vehicleIds = array_column($manifest['vehicles'], 'id');
        $transferIds = array_column($manifest['transfers'], 'id');
        DB::beginTransaction();
        $removedEmails = DB::table('email_queues')->whereIn('recipient', $manifest['emails'])->delete();
        foreach ([[User::class, $userIds], [Vehicle::class, $vehicleIds], [VehicleTransfer::class, $transferIds]] as [$type, $ids]) DB::table('audit_logs')->where('auditable_type', $type)->whereIn('auditable_id', $ids)->delete();
        DB::table('vehicle_transfers')->whereIn('id', $transferIds)->delete();
        DB::table('vehicles')->whereIn('id', $vehicleIds)->delete();
        DB::table('model_has_roles')->where('model_type', User::class)->whereIn('model_id', $userIds)->delete();
        DB::table('users')->whereIn('id', $userIds)->delete();
        $after = originalSnapshot();
        if ($after !== $manifest['baseline']) throw new RuntimeException('Os hashes originais diferem. Limpeza revertida para investigação; mantenha scheduler parado.');
        DB::commit();
        $manifest['final'] = $final;
        $manifest['cleanup'] = ['finished_at' => gmdate('c'), 'original_rows_preserved' => true, 'mock_users_removed' => count($userIds), 'mock_vehicles_removed' => count($vehicleIds), 'mock_transfers_removed' => count($transferIds), 'mock_emails_removed_without_sending' => $removedEmails, 'snapshot_after' => $after];
        file_put_contents($path, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        echo json_encode(['cleanup' => $manifest['cleanup'], 'final' => $final], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n";
    }
} catch (Throwable $e) {
    while (DB::transactionLevel() > 0) DB::rollBack();
    fwrite(STDERR, get_class($e).': '.$e->getMessage()."\n");
    exit(1);
}
