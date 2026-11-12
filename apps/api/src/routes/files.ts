import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { HttpError, notFound } from '../lib/errors.js';

export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function safePath(rel: string) {
  const full = resolve(config.uploadDir, normalize(rel));
  if (!full.startsWith(config.uploadDir + sep)) throw notFound('Arquivo');
  return full;
}

/** Salva um upload de imagem em UPLOAD_DIR/<pasta>/<aaaa-mm>/<aleatório>.<ext> */
export async function saveUpload(file: MultipartFile, folder: string) {
  const ext = IMAGE_TYPES[file.mimetype];
  if (!ext) {
    file.file.resume();
    throw new HttpError(
      415,
      file.mimetype === 'image/heic' || file.mimetype === 'image/heif'
        ? 'Formato HEIC não suportado. No iPhone, escolha "Mais compatível" ou envie pelo Safari.'
        : 'Envie uma imagem JPG, PNG, WEBP ou GIF',
    );
  }
  const month = new Date().toISOString().slice(0, 7);
  const rel = join(folder, month, `${randomBytes(12).toString('hex')}.${ext}`);
  const full = safePath(rel);
  await mkdir(dirname(full), { recursive: true });
  await pipeline(file.file, createWriteStream(full));
  if (file.file.truncated) {
    await unlink(full).catch(() => {});
    throw new HttpError(413, `Imagem maior que ${config.maxUploadMb} MB`);
  }
  return { path: rel, mimeType: file.mimetype };
}

export async function deleteUpload(rel: string) {
  await unlink(safePath(rel)).catch(() => {});
}

// Arquivos enviados só são servidos para usuários autenticados (hook de /api)
export async function fileRoutes(app: FastifyInstance) {
  app.get('/api/files/*', async (request, reply) => {
    const rel = (request.params as { '*': string })['*'];
    const full = safePath(rel);
    const info = await stat(full).catch(() => null);
    if (!info?.isFile()) throw notFound('Arquivo');
    const ext = full.split('.').pop()!;
    const type = Object.entries(IMAGE_TYPES).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
    return reply
      .header('Content-Type', type)
      .header('Content-Length', info.size)
      .header('Cache-Control', 'private, max-age=31536000, immutable')
      .send(createReadStream(full));
  });
}
