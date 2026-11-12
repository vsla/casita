// Nuvem · Fotos do iPhone via Álbum Compartilhado do iCloud com link público.
//
// A Apple não oferece API oficial para a biblioteca de fotos. O caminho viável é um
// álbum compartilhado com link público. Há dois formatos:
//  - novo (photos.icloud.com/shared/album/<token>): CloudKit — "records/resolve" devolve
//    um token anônimo de acesso e a zona do álbum; "records/query" lista as fotos.
//  - antigo (icloud.com/sharedalbum/#<token>): endpoints webstream e webasseturls.
// São os mesmos endpoints que a página pública usa. Qualquer pessoa com o link vê o álbum.
//
// As fotos são BAIXADAS para data/uploads/icloud — o painel continua mostrando tudo
// sem internet, e o link não é exposto ao navegador.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { and, eq, notInArray } from 'drizzle-orm';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';
import { deleteUpload } from '../routes/files.js';
import { getIntegration, saveIntegration } from './configStore.js';

type StreamPhoto = {
  photoGuid: string;
  caption?: string;
  dateCreated?: string;
  mediaAssetType?: string;
  derivatives: Record<string, { checksum: string; fileSize: string; width: string; height: string }>;
};
type WebStream = { photos?: StreamPhoto[]; streamName?: string; 'X-Apple-MMe-Host'?: string };
type AssetUrls = { items: Record<string, { url_location: string; url_path: string }> };

const MAX_WIDTH = 2560; // suficiente para o monitor; evita baixar originais enormes
const MAX_PHOTOS = 300;

export type AlbumRef = { kind: 'cloudkit' | 'stream'; token: string };

/**
 * Reconhece os dois formatos de link:
 * https://photos.icloud.com/shared/album/<TOKEN> (novo)
 * https://www.icloud.com/sharedalbum/#<TOKEN> (antigo, também pt-br/…)
 */
export function albumRef(url: string): AlbumRef | null {
  const u = url.trim();
  const ck = u.match(/^https:\/\/(?:photos|share)\.icloud\.com\/shared\/album\/([A-Za-z0-9_-]+)/);
  if (ck) return { kind: 'cloudkit', token: ck[1]! };
  const old = u.match(/sharedalbum\/(?:[a-z-]+\/)?#([A-Za-z0-9]+)/);
  return old ? { kind: 'stream', token: old[1]! } : null;
}

/** Foto do álbum, independente do formato */
type AlbumPhoto = { id: string; caption?: string; takenAt?: Date; download: () => Promise<Response | null> };

// O token indica a "partição" do servidor; se errar, a Apple responde 330 com o host certo
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function partitionHost(token: string) {
  const n = token[0] === 'A' ? BASE62.indexOf(token[1]!) : BASE62.indexOf(token[1]!) * 62 + BASE62.indexOf(token[2]!);
  return `p${n}-sharedstreams.icloud.com`;
}

async function post<T>(host: string, token: string, path: string, body: unknown): Promise<{ status: number; json: T }> {
  const res = await fetch(`https://${host}/${token}/sharedstreams/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status !== 200 && res.status !== 330) throw new Error(`iCloud respondeu HTTP ${res.status} (o álbum tem "Site Público" ativado?)`);
  return { status: res.status, json: (await res.json()) as T };
}

// ---------- formato antigo ----------
async function fetchStreamAlbum(token: string): Promise<{ name: string; photos: AlbumPhoto[] }> {
  let host = partitionHost(token);
  let r = await post<WebStream>(host, token, 'webstream', { streamCtag: null });
  if (r.status === 330 && r.json['X-Apple-MMe-Host']) {
    host = r.json['X-Apple-MMe-Host'];
    r = await post<WebStream>(host, token, 'webstream', { streamCtag: null });
  }
  const list = (r.json.photos ?? []).filter((p) => p.mediaAssetType !== 'video').slice(0, MAX_PHOTOS);
  // A Apple devolve URLs temporárias; pedidas em lote só quando alguma foto precisa ser baixada
  let urls: Promise<AssetUrls> | undefined;
  const assetUrls = () =>
    (urls ??= post<AssetUrls>(host, token, 'webasseturls', { photoGuids: list.map((p) => p.photoGuid) }).then((x) => x.json));
  return {
    name: r.json.streamName ?? 'Álbum',
    photos: list.map((p) => ({
      id: p.photoGuid,
      caption: p.caption,
      takenAt: p.dateCreated ? new Date(p.dateCreated) : undefined,
      download: async () => {
        const d = bestDerivative(p);
        const item = d && (await assetUrls()).items[d.checksum];
        return item ? fetch(`https://${item.url_location}${item.url_path}`, { signal: AbortSignal.timeout(30_000) }) : null;
      },
    })),
  };
}

function bestDerivative(p: StreamPhoto) {
  const ds = Object.values(p.derivatives).sort((a, b) => Number(a.width) - Number(b.width));
  return ds.filter((d) => Number(d.width) <= MAX_WIDTH).at(-1) ?? ds[0];
}

// ---------- formato novo (CloudKit) ----------
const CK = 'database/1/com.apple.photos.cloud/production';
type CkField = { value: unknown; type: string };
type CkRecord = { recordName: string; recordType: string; fields: Record<string, CkField> };
type CkResolve = {
  results?: Array<{
    zoneID: unknown;
    share?: { fields?: Record<string, CkField> };
    anonymousPublicAccess?: { token: string; databasePartition: string };
  }>;
};

async function ckPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`iCloud respondeu HTTP ${res.status} (o link público do álbum está ativo?)`);
  return (await res.json()) as T;
}

async function fetchCloudKitAlbum(token: string): Promise<{ name: string; photos: AlbumPhoto[] }> {
  const key = encodeURIComponent(token);
  const resolved = await ckPost<CkResolve>(`https://ckdatabasews.icloud.com/${CK}/public/records/resolve?remapEnums=true&sharing_url_key=${key}`, {
    shortGUIDs: [{ value: token }],
  });
  const share = resolved.results?.[0];
  const access = share?.anonymousPublicAccess;
  if (!share || !access) throw new Error('Álbum sem acesso público. No iPhone, ative o link público do álbum compartilhado.');

  const qs = `remapEnums=true&sharing_url_key=${key}&publicAccessAuthToken=${encodeURIComponent(access.token)}`;
  const masters = new Map<string, CkRecord>();
  const assets: CkRecord[] = [];
  let marker: string | undefined;
  do {
    const page = await ckPost<{ records?: CkRecord[]; continuationMarker?: string }>(`${access.databasePartition}/${CK}/shared/records/query?${qs}`, {
      query: {
        recordType: 'CPLAssetAndMasterByAssetDateWithoutHiddenOrDeleted',
        filterBy: [{ fieldName: 'direction', comparator: 'EQUALS', fieldValue: { value: 'DESCENDING', type: 'STRING' } }],
      },
      zoneID: share.zoneID,
      resultsLimit: 100,
      ...(marker ? { continuationMarker: marker } : {}),
    });
    for (const r of page.records ?? []) {
      if (r.recordType === 'CPLMaster') masters.set(r.recordName, r);
      else if (r.recordType === 'CPLAsset') assets.push(r);
    }
    marker = page.continuationMarker;
  } while (marker && assets.length < MAX_PHOTOS);

  const photos: AlbumPhoto[] = [];
  for (const a of assets.slice(0, MAX_PHOTOS)) {
    const master = masters.get((a.fields.masterRef?.value as { recordName?: string } | undefined)?.recordName ?? '');
    if (!master) continue;
    const f = master.fields;
    const itemType = String(f.itemType?.value ?? '');
    if (/movie|video|mpeg/i.test(itemType)) continue;
    // HEIC não abre no Chromium; a versão "Med" é um JPEG já redimensionado pela Apple
    const res = (f.resJPEGMedRes ?? (/jpeg|png/.test(itemType) ? f.resOriginalRes : undefined) ?? f.resJPEGThumbRes)?.value as
      | { downloadURL?: string }
      | undefined;
    if (!res?.downloadURL) continue;
    const assetDate = a.fields.assetDate?.value;
    photos.push({
      id: master.recordName,
      takenAt: typeof assetDate === 'number' ? new Date(assetDate) : undefined,
      download: () => fetch(res.downloadURL!.replace('${f}', 'foto.jpg'), { signal: AbortSignal.timeout(30_000) }),
    });
  }
  const title = share.share?.fields?.['cloudkit.title']?.value;
  return { name: typeof title === 'string' ? title : 'Álbum', photos };
}

export function fetchAlbum(ref: AlbumRef) {
  return ref.kind === 'cloudkit' ? fetchCloudKitAlbum(ref.token) : fetchStreamAlbum(ref.token);
}

// IDs do CloudKit têm "/" e "+": o nome do arquivo usa um hash
const fileId = (id: string) => createHash('sha1').update(id).digest('hex').slice(0, 24);

export async function syncIcloudPhotos(householdId: number) {
  const cfg = await getIntegration(householdId, 'icloud_photos');
  const url = String(cfg?.settings.albumUrl ?? '');
  const ref = albumRef(url);
  if (!cfg?.enabled || !ref) return { skipped: true as const };

  try {
    const { name, photos } = await fetchAlbum(ref);
    const existing = await db
      .select({ externalId: schema.photos.externalId })
      .from(schema.photos)
      .where(and(eq(schema.photos.householdId, householdId), eq(schema.photos.source, 'icloud')));
    const have = new Set(existing.map((e) => e.externalId));

    let added = 0;
    for (const p of photos.filter((p) => !have.has(p.id))) {
      const res = await p.download().catch(() => null);
      if (!res?.ok) continue;
      const type = res.headers.get('content-type') ?? 'image/jpeg';
      if (!type.startsWith('image/') || type.includes('heic')) continue;
      const rel = join('icloud', `${fileId(p.id)}.${type.includes('png') ? 'png' : 'jpg'}`);
      const full = join(config.uploadDir, rel);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, Buffer.from(await res.arrayBuffer()));
      await db
        .insert(schema.photos)
        .values({ householdId, path: rel, mimeType: type, caption: p.caption || null, source: 'icloud', externalId: p.id, takenAt: p.takenAt ?? null })
        .onConflictDoNothing();
      added++;
    }

    // Fotos removidas do álbum somem do painel também
    const guids = photos.map((p) => p.id);
    const gone = await db
      .delete(schema.photos)
      .where(
        and(
          eq(schema.photos.householdId, householdId),
          eq(schema.photos.source, 'icloud'),
          guids.length ? notInArray(schema.photos.externalId, guids) : undefined,
        ),
      )
      .returning({ path: schema.photos.path });
    await Promise.all(gone.map((g) => deleteUpload(g.path)));

    // Com fotos reais, as ilustrações de exemplo saem
    if (photos.length) await db.delete(schema.photos).where(and(eq(schema.photos.householdId, householdId), eq(schema.photos.demo, true)));

    await saveIntegration(householdId, 'icloud_photos', {
      lastSyncAt: new Date(),
      lastError: null,
      settings: { ...cfg.settings, albumName: name, count: photos.length },
    });
    return { skipped: false as const, added, removed: gone.length, total: photos.length, name };
  } catch (e) {
    await saveIntegration(householdId, 'icloud_photos', { lastError: (e as Error).message });
    throw e;
  }
}

