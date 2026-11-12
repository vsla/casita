import { addDaysISO, todayISO } from '@home-hub/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from '../src/db/index.js';
import { login, makeApp } from './helpers.js';

let app: FastifyInstance;
let adminClient: Awaited<ReturnType<typeof login>>;
const today = todayISO('America/Sao_Paulo');

beforeAll(async () => {
  app = await makeApp();
  adminClient = await login(app);
});
afterAll(async () => {
  await app.close();
  await sql.end();
});

describe('autenticação', () => {
  it('bloqueia a API sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/Sessão/);
  });

  it('recusa senha errada com mensagem genérica', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'demo-admin', password: 'x' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Usuário ou senha inválidos');
  });

  it('cookie é HttpOnly e /me devolve o papel', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'DEMO-MEMBER', password: 'senha-fixture-2026' } });
    const cookie = res.cookies.find((c) => c.name === 'hh_session')!;
    expect(cookie.httpOnly).toBe(true);
    const meRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: `hh_session=${cookie.value}` } });
    expect(meRes.json()).toMatchObject({ username: 'demo-member', role: 'member' });
  });

  it('logout invalida a sessão', async () => {
    const s = await login(app, 'demo-member');
    await s.call('POST', '/api/auth/logout');
    expect((await s.call('GET', '/api/auth/me')).status).toBe(401);
  });

  it('não há cadastro público e só admin cria moradores', async () => {
    const memberClient = await login(app, 'demo-member');
    const res = await memberClient.call('POST', '/api/members', { username: 'intruso', displayName: 'X', password: '123456' });
    expect(res.status).toBe(403);
  });
});

describe('validação e erros', () => {
  it('payload inválido vira 400 com mensagem', async () => {
    const res = await adminClient.call('POST', '/api/tasks', { title: '' });
    expect(res.status).toBe(400);
    expect(res.body.issues[0].path).toBe('title');
  });

  it('id de outra casa / inexistente vira 404', async () => {
    const res = await adminClient.call('PATCH', '/api/tasks/999999', { title: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('tarefas', () => {
  it('tarefa avulsa: concluir, aparecer no histórico e desfazer', async () => {
    const created = await adminClient.call('POST', '/api/tasks', { title: 'Levar o lixo', dueDate: today });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const done = await adminClient.call('POST', `/api/tasks/${id}/complete`, {});
    expect(done.body.completedAt).not.toBeNull();
    // Concluir duas vezes não duplica histórico
    expect((await adminClient.call('POST', `/api/tasks/${id}/complete`, {})).status).toBe(409);

    const history = await adminClient.call('GET', `/api/tasks/history?taskId=${id}`);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({ taskTitle: 'Levar o lixo', userName: 'Pessoa A' });

    const undone = await adminClient.call('POST', `/api/tasks/${id}/complete`, { undo: true });
    expect(undone.body.completedAt).toBeNull();
    expect((await adminClient.call('GET', `/api/tasks/history?taskId=${id}`)).body).toHaveLength(0);
  });

  it('tarefa recorrente é reagendada e continua aberta; desfazer restaura o prazo', async () => {
    const created = await adminClient.call('POST', '/api/tasks', {
      title: 'Regar as plantas',
      dueDate: today,
      recurrence: { kind: 'daily', interval: 2 },
    });
    const id = created.body.id;
    const done = await adminClient.call('POST', `/api/tasks/${id}/complete`, {});
    expect(done.body.completedAt).toBeNull();
    expect(done.body.dueDate).toBe(addDaysISO(today, 2));

    const undone = await adminClient.call('POST', `/api/tasks/${id}/complete`, { undo: true });
    expect(undone.body.dueDate).toBe(today);
  });

  it('recorrente exige data inicial', async () => {
    const res = await adminClient.call('POST', '/api/tasks', { title: 'X', recurrence: { kind: 'daily', interval: 1 } });
    expect(res.status).toBe(400);
  });

  it('filtro "minhas" inclui as de "Todos" e exclui as dos outros', async () => {
    const memberClient = await login(app, 'demo-member');
    const me = (await memberClient.call('GET', '/api/auth/me')).body;
    await adminClient.call('POST', '/api/tasks', { title: 'Só da Pessoa B', assigneeId: me.id });
    await adminClient.call('POST', '/api/tasks', { title: 'De todos', assigneeId: null });
    const mine = (await adminClient.call<{ title: string }[]>('GET', '/api/tasks?assignee=me')).body.map((t) => t.title);
    expect(mine).toContain('De todos');
    expect(mine).not.toContain('Só da Pessoa B');
  });

  it('excluir arquiva mas mantém o histórico', async () => {
    const { body } = await adminClient.call('POST', '/api/tasks', { title: 'Temporária' });
    await adminClient.call('POST', `/api/tasks/${body.id}/complete`, {});
    await adminClient.call('DELETE', `/api/tasks/${body.id}`);
    const list = (await adminClient.call<{ id: number }[]>('GET', '/api/tasks')).body;
    expect(list.find((t) => t.id === body.id)).toBeUndefined();
    expect((await adminClient.call('GET', `/api/tasks/history?taskId=${body.id}`)).body).toHaveLength(1);
  });
});

describe('compras', () => {
  it('não duplica item pendente com o mesmo nome e atualiza a quantidade', async () => {
    const a = await adminClient.call('POST', '/api/shopping', { name: 'Tomate', quantity: '1 kg', category: 'hortifruti' });
    const b = await adminClient.call('POST', '/api/shopping', { name: 'tomate', quantity: '2 kg' });
    expect(b.body.id).toBe(a.body.id);
    expect(b.body.quantity).toBe('2 kg');
  });

  it('marcar, limpar marcados e virar sugestão', async () => {
    const { body } = await adminClient.call('POST', '/api/shopping', { name: 'Azeite', category: 'mercearia' });
    await adminClient.call('PATCH', `/api/shopping/${body.id}`, { checked: true });
    await adminClient.call('POST', '/api/shopping/clear-checked');
    const list = (await adminClient.call<{ id: number }[]>('GET', '/api/shopping')).body;
    expect(list.find((i) => i.id === body.id)).toBeUndefined();
    const sugg = (await adminClient.call<{ name: string }[]>('GET', '/api/shopping/suggestions')).body.map((s) => s.name);
    expect(sugg).toContain('Azeite');
  });

  it('categoria inválida é rejeitada', async () => {
    expect((await adminClient.call('POST', '/api/shopping', { name: 'X', category: 'nada' })).status).toBe(400);
  });
});

describe('recados', () => {
  it('fixar, editar e excluir; vencidos somem', async () => {
    const { body } = await adminClient.call('POST', '/api/notes', { body: 'Oi' });
    expect(body.authorName).toBe('Pessoa A');
    const edited = await adminClient.call('PATCH', `/api/notes/${body.id}`, { body: 'Oi de novo', pinned: true });
    expect(edited.body).toMatchObject({ body: 'Oi de novo', pinned: true });
    const list = (await adminClient.call<{ id: number }[]>('GET', '/api/notes')).body;
    expect(list[0]!.id).toBe(body.id); // fixado vem primeiro

    // Validade no passado é recusada; quando vence, some da lista
    expect((await adminClient.call('POST', '/api/notes', { body: 'X', expiresAt: new Date(Date.now() - 1000) })).status).toBe(400);
    await sql`update notes set expires_at = now() - interval '1 minute' where id = ${body.id}`;
    const after = (await adminClient.call<{ id: number }[]>('GET', '/api/notes')).body;
    expect(after.find((n) => n.id === body.id)).toBeUndefined();
  });
});

describe('pets', () => {
  it('registrar atividade atualiza "último" e lembrete concluído sai da lista', async () => {
    const pets = (await adminClient.call<any[]>('GET', '/api/pets')).body;
    expect(pets.map((p) => p.name)).toEqual(['Pipoca', 'Nuvem']);
    const pet = pets[0];

    await adminClient.call('POST', `/api/pets/${pet.id}/activities`, { kind: 'walk', notes: 'Volta no quarteirão' });
    const reminder = await adminClient.call('POST', `/api/pets/${pet.id}/activities`, {
      kind: 'vet',
      scheduledAt: new Date(Date.now() + 86_400_000),
      done: false,
    });
    let updated = (await adminClient.call<any[]>('GET', '/api/pets')).body[0];
    expect(updated.lastByKind.walk).toBeTruthy();
    expect(updated.reminders.some((r: any) => r.id === reminder.body.id)).toBe(true);

    await adminClient.call('PATCH', `/api/pet-activities/${reminder.body.id}`, { done: true });
    updated = (await adminClient.call<any[]>('GET', '/api/pets')).body[0];
    expect(updated.reminders.some((r: any) => r.id === reminder.body.id)).toBe(false);

    const history = (await adminClient.call<any[]>('GET', `/api/pets/${pet.id}/activities`)).body;
    expect(history[0]).toMatchObject({ kind: 'vet', doneByName: 'Pessoa A' });
  });

  it('editar cadastro', async () => {
    const pets = (await adminClient.call<any[]>('GET', '/api/pets')).body;
    const res = await adminClient.call('PATCH', `/api/pets/${pets[1].id}`, { breed: 'SRD', status: 'Dormindo' });
    expect(res.body).toMatchObject({ name: 'Nuvem', breed: 'SRD', status: 'Dormindo' });
  });
});

describe('agenda', () => {
  it('lista por intervalo e valida fim antes do início', async () => {
    const start = new Date();
    const bad = await adminClient.call('POST', '/api/calendar', { title: 'X', startsAt: start, endsAt: new Date(start.getTime() - 1000) });
    expect(bad.status).toBe(400);
    const { body } = await adminClient.call('POST', '/api/calendar', { title: 'Consulta', startsAt: start });
    const from = new Date(start.getTime() - 3_600_000).toISOString();
    const to = new Date(start.getTime() + 3_600_000).toISOString();
    const list = (await adminClient.call<{ id: number }[]>('GET', `/api/calendar?from=${from}&to=${to}`)).body;
    expect(list.some((e) => e.id === body.id)).toBe(true);
  });
});

describe('integrações', () => {
  it('nada é reportado como conectado sem configuração real', async () => {
    const list = (await adminClient.call<any[]>('GET', '/api/integrations')).body;
    const byKind = Object.fromEntries(list.map((i) => [i.kind, i.state]));
    expect(byKind.camera).toBe('not_configured');
    expect(byKind.icloud_calendar).toBe('not_configured');
    expect(byKind.midea).toBe('planned');
    expect(byKind.alexa).toBe('planned');
    expect((await adminClient.call('GET', '/api/camera')).body).toEqual({ state: 'not_configured' });
  });
});

describe('layout', () => {
  it('salva por tipo de tela e valida widgets', async () => {
    const saved = await adminClient.call('PUT', '/api/layout?device=panel', { preset: 'pets', hidden: ['laundry'] });
    expect(saved.status).toBe(200);
    expect((await adminClient.call('GET', '/api/layout?device=panel')).body).toEqual({ preset: 'pets', hidden: ['laundry'] });
    expect((await adminClient.call('GET', '/api/layout?device=mobile')).body.preset).toBe('balanced');
    expect((await adminClient.call('PUT', '/api/layout', { preset: 'x', hidden: [] })).status).toBe(400);
  });

  it('painel (kiosk) não altera configurações da casa', async () => {
    const kiosk = await login(app, 'casa');
    expect((await kiosk.call('PATCH', '/api/household', { name: 'X' })).status).toBe(403);
    expect((await kiosk.call('PUT', '/api/layout', { preset: 'balanced', hidden: [] })).status).toBe(403);
  });
});
