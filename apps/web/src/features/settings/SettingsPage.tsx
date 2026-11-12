import {
  layoutPresetLabels,
  layoutPresets,
  widgetIds,
  widgetLabels,
  type DashboardLayout,
  type IntegrationState,
  type Member,
  type MemberRole,
} from '@home-hub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Cloud, House, LayoutDashboard, LogOut, MonitorSmartphone, Plug, Server, UserPlus, Users } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/button';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { ChoiceChips, Field, Input, Segmented, Switch } from '../../components/ui/form';
import { Avatar, Badge, PageHeader } from '../../components/ui/misc';
import { ListSkeleton } from '../../components/ui/states';
import { api, assetUrl, errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useApiMutation, useHousehold, useIntegrations, useLayout, useMe, useMembers } from '../../lib/queries';
import { slotsFor } from '../dashboard/registry';
import { Link } from 'react-router';
import { SpotifyConfig } from '../music/SpotifyConfig';

function Section({ icon, title, children, hint }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-display text-xl [&>svg]:size-5 [&>svg]:text-sage-deep">
        {icon}
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const { data: me } = useMe();
  const isAdmin = me?.role === 'admin';
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="Ajustes" subtitle={me && `Conectado como ${me.displayName}`} />
      <HouseSection editable={isAdmin} />
      <LayoutSection editable={me?.role !== 'kiosk'} />
      <MembersSection />
      <IntegrationsSection />
      <AccountSection />
    </div>
  );
}

function HouseSection({ editable }: { editable: boolean }) {
  const { data: h } = useHousehold();
  const [form, setForm] = useState({ name: '', subtitle: '', city: '', latitude: '', longitude: '', timezone: '', weatherEnabled: true });
  useEffect(() => {
    if (h)
      setForm({
        name: h.name,
        subtitle: h.subtitle,
        city: h.city,
        latitude: h.latitude?.toString() ?? '',
        longitude: h.longitude?.toString() ?? '',
        timezone: h.timezone,
        weatherEnabled: h.weatherEnabled,
      });
  }, [h]);
  const save = useApiMutation((body: Record<string, unknown>) => api('/household', { method: 'PATCH', body }), {
    invalidate: [['household'], ['weather'], ['integrations']],
    success: 'Casa atualizada',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Section icon={<House />} title="Identidade da casa" hint={editable ? undefined : 'Somente administradores alteram estes dados.'}>
      {!h ? (
        <ListSkeleton rows={3} />
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              name: form.name,
              subtitle: form.subtitle,
              city: form.city,
              latitude: form.latitude ? Number(form.latitude) : null,
              longitude: form.longitude ? Number(form.longitude) : null,
              timezone: form.timezone,
              weatherEnabled: form.weatherEnabled,
            });
          }}
        >
          <fieldset disabled={!editable} className="contents">
            <Field label="Nome">
              <Input required maxLength={60} value={form.name} onChange={set('name')} />
            </Field>
            <Field label="Subtítulo">
              <Input maxLength={120} value={form.subtitle} onChange={set('subtitle')} />
            </Field>
            <Field label="Cidade (clima)">
              <Input maxLength={60} value={form.city} onChange={set('city')} />
            </Field>
            <Field label="Fuso horário" hint="Ex.: America/Sao_Paulo ou Europe/Lisbon">
              <Input required maxLength={60} value={form.timezone} onChange={set('timezone')} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Latitude">
                <Input inputMode="decimal" value={form.latitude} onChange={set('latitude')} />
              </Field>
              <Field label="Longitude">
                <Input inputMode="decimal" value={form.longitude} onChange={set('longitude')} />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-paper-2 px-4 py-3 sm:col-span-2">
              <span>
                <span className="block font-semibold">Mostrar clima</span>
                <span className="text-xs text-muted">Usa a internet (Open-Meteo). Sem conexão, o clima apenas some.</span>
              </span>
              <Switch checked={form.weatherEnabled} onChange={(v) => setForm((f) => ({ ...f, weatherEnabled: v }))} label="Mostrar clima" disabled={!editable} />
            </div>
          </fieldset>
          {editable && (
            <Button type="submit" className="sm:col-span-2" loading={save.isPending}>
              Salvar
            </Button>
          )}
        </form>
      )}
    </Section>
  );
}

function LayoutSection({ editable }: { editable: boolean }) {
  const [device, setDevice] = useState<'panel' | 'mobile'>('panel');
  const { data: layout } = useLayout(device);
  const qc = useQueryClient();
  const save = useApiMutation((l: DashboardLayout) => api(`/layout?device=${device}`, { method: 'PUT', body: l }), {
    invalidate: [['layout']],
    optimistic: undefined,
  });
  const update = (l: DashboardLayout) => {
    qc.setQueryData(['layout', device], l); // resposta imediata
    save.mutate(l);
  };

  return (
    <Section icon={<LayoutDashboard />} title="Tela inicial" hint="Organização dos widgets. O monitor da casa e os celulares podem ter layouts diferentes.">
      <Segmented
        className="mb-4"
        value={device}
        onChange={setDevice}
        options={[
          { value: 'panel', label: 'Monitor da casa' },
          { value: 'mobile', label: 'Celulares' },
        ]}
      />
      {!layout ? (
        <ListSkeleton rows={2} />
      ) : (
        <fieldset disabled={!editable} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {layoutPresets.filter((p) => p !== 'custom' || layout.custom).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update({ ...layout, preset: p })}
                aria-pressed={layout.preset === p}
                className={cn('press rounded-2xl border p-2 text-sm font-semibold', layout.preset === p ? 'border-sage bg-sage-soft text-sage-deep' : 'border-line bg-white/60')}
              >
                {/* Miniatura da grade 4×3 */}
                <div className="mb-1.5 grid aspect-[16/9] grid-flow-dense grid-cols-4 grid-rows-3 gap-0.5">
                  {slotsFor({ ...layout, preset: p })
                    .slice(0, 12)
                    .map((s) => (
                      <span
                        key={s.id}
                        className="rounded-[3px] bg-sage/40"
                        style={{ gridColumn: `span ${s.col ?? 1}`, gridRow: `span ${s.row ?? 1}` }}
                      />
                    ))}
                </div>
                {layoutPresetLabels[p]}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {widgetIds.map((id) => {
              const visible = !layout.hidden.includes(id);
              return (
                <div key={id} className="flex items-center justify-between rounded-xl bg-paper-2 px-4 py-2.5">
                  <span className={cn('font-semibold', !visible && 'text-muted')}>{widgetLabels[id]}</span>
                  <Switch
                    checked={visible}
                    label={`Mostrar ${widgetLabels[id]}`}
                    disabled={!editable}
                    onChange={(v) => update({ ...layout, hidden: v ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id] })}
                  />
                </div>
              );
            })}
          </div>
          {device === 'panel' && editable && (
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/?editar" className="press inline-flex h-11 items-center gap-2 rounded-xl bg-sage px-4 font-semibold text-white">
                <LayoutDashboard className="size-5" /> Editar o layout à mão
              </Link>
              <span className="text-sm text-muted">Mova, aumente ou diminua cada card direto na tela (abra num PC ou monitor).</span>
            </div>
          )}
          {!editable && <p className="text-sm text-muted">O painel da casa não altera o layout; use o celular de um morador.</p>}
        </fieldset>
      )}
    </Section>
  );
}

const ROLE_LABEL: Record<MemberRole, string> = { admin: 'Administrador', member: 'Morador', kiosk: 'Painel (kiosk)' };
const COLORS = ['#6f9a85', '#d9925b', '#5fa8a0', '#a78bc9', '#c97a7a', '#8a9a8e'];

function MemberAvatar({ member, size = 36 }: { member: Member; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 overflow-hidden rounded-full">
      <Avatar name={member.displayName} color={member.color} size={size} />
      {member.photoUrl && (
        <img
          key={member.photoUrl}
          src={assetUrl(member.photoUrl)}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      )}
    </span>
  );
}

function MemberPhoto({ member }: { member: Member }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const update = useApiMutation(
    (file: File | null) => {
      const path = `/members/${member.id}/photo`;
      if (!file) return api(path, { method: 'DELETE' });
      const form = new FormData();
      form.append('file', file);
      return api(path, { form });
    },
    { invalidate: [['members']], success: (_, file) => file ? 'Foto atualizada' : 'Foto removida' },
  );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <MemberAvatar member={member} size={56} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" loading={update.isPending} onClick={() => fileInput.current?.click()}>
          {member.photoUrl ? 'Trocar foto' : 'Adicionar foto'}
        </Button>
        {member.photoUrl && (
          <Button type="button" variant="ghost" disabled={update.isPending} onClick={() => update.mutate(null)}>
            Remover foto
          </Button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) update.mutate(file);
        }}
      />
    </div>
  );
}

function MembersSection() {
  const { data: me } = useMe();
  const { data: members } = useMembers();
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const isAdmin = me?.role === 'admin';
  return (
    <Section icon={<Users />} title="Moradores e acessos" hint="Sem cadastro público: só um administrador cria acessos.">
      {!members ? (
        <ListSkeleton rows={3} />
      ) : (
        <ul className="divide-y divide-line/70">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <MemberAvatar member={m} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {m.displayName} {m.id === me?.id && <span className="text-sm font-normal text-muted">(você)</span>}
                </p>
                <p className="text-sm text-muted">
                  @{m.username} · {ROLE_LABEL[m.role]}
                </p>
              </div>
              {(isAdmin || m.id === me?.id) && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
                  Editar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && (
        <Button variant="outline" className="mt-3" onClick={() => setEditing('new')}>
          <UserPlus /> Novo acesso
        </Button>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Novo acesso' : 'Editar acesso'}>
        {editing && <MemberForm member={editing === 'new' ? undefined : members?.find((member) => member.id === editing.id) ?? editing} isAdmin={isAdmin} selfId={me?.id} onDone={() => setEditing(null)} />}
      </Dialog>
    </Section>
  );
}

function MemberForm({ member, isAdmin, selfId, onDone }: { member?: Member; isAdmin: boolean; selfId?: number; onDone: () => void }) {
  const [username, setUsername] = useState(member?.username ?? '');
  const [displayName, setDisplayName] = useState(member?.displayName ?? '');
  const [color, setColor] = useState(member?.color ?? COLORS[0]!);
  const [role, setRole] = useState<MemberRole>(member?.role ?? 'member');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(false);
  const save = useApiMutation(
    (body: Record<string, unknown>) => (member ? api(`/members/${member.id}`, { method: 'PATCH', body }) : api('/members', { body })),
    { invalidate: [['members'], ['me']], success: member ? 'Acesso atualizado' : 'Acesso criado' },
  );
  const remove = useApiMutation(() => api(`/members/${member!.id}`, { method: 'DELETE' }), { invalidate: [['members']], success: 'Acesso removido' });
  const self = member?.id === selfId;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await save.mutateAsync(
          member
            ? { displayName, color, ...(isAdmin && !self ? { role } : {}), ...(password ? { password } : {}) }
            : { username, displayName, color, role, password },
        );
        onDone();
      }}
    >
      {member && <MemberPhoto member={member} />}
      {!member && (
        <Field label="Usuário (login)" hint="Letras minúsculas, sem espaço">
          <Input required autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
        </Field>
      )}
      <Field label="Nome">
        <Input required maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </Field>
      <Field label="Cor">
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn('press size-10 rounded-full ring-offset-2 ring-offset-paper', color === c && 'ring-2 ring-ink-soft')}
              style={{ background: c }}
            />
          ))}
        </div>
      </Field>
      {isAdmin && !self && (
        <Field label="Tipo de acesso">
          <ChoiceChips
            value={role}
            onChange={setRole}
            options={(['member', 'admin', 'kiosk'] as const).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
        </Field>
      )}
      <Field label={member ? 'Nova senha (opcional)' : 'Senha'} hint="Mínimo de 6 caracteres">
        <Input type="password" autoComplete="new-password" required={!member} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        {member && isAdmin && !self && (
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Remover
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" loading={save.isPending}>
          Salvar
        </Button>
      </div>
      {member && (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={`Remover ${member.displayName}?`}
          description="O acesso é encerrado em todos os aparelhos. Tarefas e recados continuam."
          confirmLabel="Remover"
          onConfirm={async () => {
            await remove.mutateAsync(undefined);
            onDone();
          }}
        />
      )}
    </form>
  );
}

const STATE: Record<IntegrationState, { label: string; tone: 'sage' | 'clay' | 'neutral' | 'danger' | 'teal' }> = {
  connected: { label: 'Conectado', tone: 'sage' },
  not_configured: { label: 'Não configurado', tone: 'clay' },
  unavailable: { label: 'Indisponível', tone: 'danger' },
  planned: { label: 'Futuro', tone: 'neutral' },
  disabled: { label: 'Desligado', tone: 'neutral' },
};

function IntegrationsSection() {
  const { data } = useIntegrations();
  const { data: me } = useMe();
  const isAdmin = me?.role === 'admin';
  return (
    <Section icon={<Plug />} title="Integrações" hint="Nada aparece como conectado sem uma conexão real. Credenciais ficam só no servidor.">
      {!data ? (
        <ListSkeleton rows={4} />
      ) : (
        <ul className="divide-y divide-line/70">
          {data.map((i) => (
            <li key={i.kind} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 text-ink-soft" title={i.scope === 'local' ? 'Local (rede da casa)' : 'Nuvem'}>
                {i.scope === 'local' ? <Server className="size-5" /> : <Cloud className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{i.name}</p>
                  <Badge tone={STATE[i.state].tone}>{STATE[i.state].label}</Badge>
                </div>
                <p className="text-sm text-muted">{i.detail}</p>
                {isAdmin && i.kind === 'icloud_photos' && <IcloudPhotosConfig />}
                {isAdmin && i.kind === 'icloud_calendar' && i.configurable && <IcloudCalendarConfig />}
                {isAdmin && i.kind === 'spotify' && i.configurable && <SpotifyConfig />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function AccountSection() {
  const qc = useQueryClient();
  return (
    <Section icon={<MonitorSmartphone />} title="Este aparelho">
      <p className="mb-3 text-sm text-ink-soft">
        No iPhone: Safari → Compartilhar → “Adicionar à Tela de Início” para abrir como aplicativo.
      </p>
      <Button
        variant="outline"
        onClick={async () => {
          await api('/auth/logout', { body: {} }).catch(() => {});
          qc.clear();
          qc.setQueryData(['me'], null);
        }}
      >
        <LogOut /> Sair deste aparelho
      </Button>
    </Section>
  );
}

function IcloudPhotosConfig() {
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api<{ albumUrl: string }>('/integrations/icloud-photos').then((c) => {
      setUrl(c.albumUrl);
      setLoaded(true);
    });
  }, []);
  const save = useApiMutation((albumUrl: string) => api('/integrations/icloud-photos', { method: 'PUT', body: { albumUrl, enabled: !!albumUrl } }), {
    invalidate: [['integrations']],
  });
  const sync = useApiMutation(() => api<{ added: number; total: number; name: string }>('/integrations/icloud-photos/sync', { body: {} }), {
    invalidate: [['integrations'], ['photos']],
    success: (r) => `${r.total} fotos de “${r.name}” (${r.added} novas)`,
  });
  if (!loaded) return null;
  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        await save.mutateAsync(url);
        if (url) await sync.mutateAsync(undefined);
        qc.invalidateQueries({ queryKey: ['integrations'] });
      }}
    >
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://photos.icloud.com/shared/album/…" inputMode="url" aria-label="Link do álbum" />
      <Button type="submit" loading={save.isPending || sync.isPending}>
        {url ? 'Salvar e sincronizar' : 'Salvar'}
      </Button>
    </form>
  );
}

function IcloudCalendarConfig() {
  const [cals, setCals] = useState<{ url: string; name: string; color: string; selected: boolean }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<typeof cals>('/integrations/icloud-calendar/calendars').then(setCals, (e) => setError(errorMessage(e)));
  }, []);
  const save = useApiMutation(
    async (urls: string[]) => {
      await api('/integrations/icloud-calendar', { method: 'PUT', body: { calendarUrls: urls } });
      return urls.length ? api<{ events: number }>('/integrations/icloud-calendar/sync', { body: {} }) : null;
    },
    { invalidate: [['integrations'], ['calendar']], success: (r) => (r ? `${r.events} eventos sincronizados` : 'Salvo') },
  );
  if (error) return <p className="mt-2 text-sm text-danger">{error}</p>;
  if (!cals) return <ListSkeleton rows={2} />;
  const toggle = (url: string) => setCals((cs) => cs!.map((c) => (c.url === url ? { ...c, selected: !c.selected } : c)));
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-sm font-semibold text-ink-soft">Quais calendários aparecem no painel?</p>
      {cals.map((c) => (
        <div key={c.url} className="flex items-center justify-between rounded-xl bg-paper-2 px-4 py-2.5">
          <span className="flex items-center gap-2 font-semibold">
            <span className="size-3 rounded-full" style={{ background: c.color }} />
            {c.name}
          </span>
          <Switch checked={c.selected} label={`Mostrar ${c.name}`} onChange={() => toggle(c.url)} />
        </div>
      ))}
      <Button loading={save.isPending} onClick={() => save.mutate(cals.filter((c) => c.selected).map((c) => c.url))}>
        Salvar e sincronizar
      </Button>
    </div>
  );
}
