import { afterAll, describe, expect, it } from 'vitest';
import { sql } from '../src/db/index.js';
import { expandIcs } from '../src/integrations/calendar.js';
import { albumRef } from '../src/integrations/icloudPhotos.js';

afterAll(() => sql.end());

const ics = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//teste//PT\r\n${body}END:VCALENDAR\r\n`;

describe('iCloud CalDAV → eventos', () => {
  const from = new Date('2026-11-01T00:00:00Z');
  const to = new Date('2026-12-01T00:00:00Z');

  it('evento simples', () => {
    const out = expandIcs(
      ics('BEGIN:VEVENT\r\nUID:a1\r\nSUMMARY:Vôlei\r\nLOCATION:Quadra\r\nDTSTART:20261110T000000Z\r\nDTEND:20261110T010000Z\r\nEND:VEVENT\r\n'),
      from,
      to,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: 'Vôlei', location: 'Quadra', allDay: false });
    expect(out[0]!.startsAt.toISOString()).toBe('2026-11-10T00:00:00.000Z');
  });

  it('recorrência semanal com exceção movida e ocorrência cancelada', () => {
    const out = expandIcs(
      ics(
        'BEGIN:VEVENT\r\nUID:r1\r\nSUMMARY:Treino\r\nDTSTART:20261102T213000Z\r\nDTEND:20261102T223000Z\r\nRRULE:FREQ=WEEKLY;BYDAY=MO\r\nEXDATE:20261116T213000Z\r\nEND:VEVENT\r\n' +
          'BEGIN:VEVENT\r\nUID:r1\r\nRECURRENCE-ID:20261109T213000Z\r\nSUMMARY:Treino (remarcado)\r\nDTSTART:20261110T213000Z\r\nDTEND:20261110T223000Z\r\nEND:VEVENT\r\n',
      ),
      from,
      to,
    );
    const titles = out.map((o) => `${o.startsAt.toISOString().slice(0, 10)} ${o.title}`);
    expect(titles).toEqual(['2026-11-02 Treino', '2026-11-10 Treino (remarcado)', '2026-11-23 Treino', '2026-11-30 Treino']);
    // ids estáveis por ocorrência (base para atualizar sem duplicar)
    expect(new Set(out.map((o) => o.externalId)).size).toBe(4);
  });

  it('dia inteiro termina no próprio dia', () => {
    const [ev] = expandIcs(ics('BEGIN:VEVENT\r\nUID:d1\r\nSUMMARY:Aniversário\r\nDTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261121\r\nEND:VEVENT\r\n'), from, to);
    expect(ev!.allDay).toBe(true);
    expect(ev!.endsAt!.getTime()).toBeLessThan(new Date(ev!.startsAt.getTime() + 86_400_000).getTime());
  });

  it('ignora o que está fora do intervalo', () => {
    expect(expandIcs(ics('BEGIN:VEVENT\r\nUID:x\r\nSUMMARY:Antigo\r\nDTSTART:20250101T100000Z\r\nEND:VEVENT\r\n'), from, to)).toHaveLength(0);
  });
});

describe('link do álbum compartilhado', () => {
  it('aceita formatos do iCloud', () => {
    expect(albumRef('https://photos.icloud.com/shared/album/token-ficticio_cloudkit')).toEqual({ kind: 'cloudkit', token: 'token-ficticio_cloudkit' });
    expect(albumRef('https://www.icloud.com/sharedalbum/#A00TokenFicticio')).toEqual({ kind: 'stream', token: 'A00TokenFicticio' });
    expect(albumRef('https://www.icloud.com/sharedalbum/pt-br/#B2x5Abc')).toEqual({ kind: 'stream', token: 'B2x5Abc' });
    expect(albumRef('https://www.icloud.com/photos/#0abc')).toBeNull();
    expect(albumRef('https://evil.com/shared/album/abc')).toBeNull();
  });
});
