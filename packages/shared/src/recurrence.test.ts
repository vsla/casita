import { describe, expect, it } from 'vitest';
import { describeRecurrence, nextDueAfterCompletion, nextOccurrence, type Recurrence } from './recurrence.ts';

describe('nextOccurrence — diária', () => {
  it('todo dia: amanhã', () => {
    expect(nextOccurrence({ kind: 'daily', interval: 1 }, '2026-11-10', '2026-11-10')).toBe('2026-11-11');
  });
  it('a cada 3 dias mantém a fase da âncora', () => {
    expect(nextOccurrence({ kind: 'daily', interval: 3 }, '2026-11-01', '2026-11-05')).toBe('2026-11-07');
  });
  it('âncora no futuro é a própria âncora', () => {
    expect(nextOccurrence({ kind: 'daily', interval: 2 }, '2026-11-20', '2026-11-10')).toBe('2026-11-20');
  });
  it('atravessa virada de ano', () => {
    expect(nextOccurrence({ kind: 'daily', interval: 1 }, '2026-12-31', '2026-12-31')).toBe('2027-01-01');
  });
});

describe('nextOccurrence — semanal', () => {
  // 2026-11-10 é terça-feira
  it('toda segunda: próxima segunda', () => {
    expect(nextOccurrence({ kind: 'weekly', interval: 1, weekdays: [1] }, '2026-11-09', '2026-11-10')).toBe('2026-11-16');
  });
  it('vários dias na semana: o próximo deles', () => {
    expect(nextOccurrence({ kind: 'weekly', interval: 1, weekdays: [1, 4] }, '2026-11-09', '2026-11-10')).toBe('2026-11-12');
  });
  it('a cada 2 semanas pula a semana intermediária', () => {
    // âncora seg 09/11 → próximas: 23/11, 07/12
    expect(nextOccurrence({ kind: 'weekly', interval: 2, weekdays: [1] }, '2026-11-09', '2026-11-09')).toBe('2026-11-23');
    expect(nextOccurrence({ kind: 'weekly', interval: 2, weekdays: [1] }, '2026-11-09', '2026-11-24')).toBe('2026-12-07');
  });
  it('a cada 2 semanas com dois dias usa os dois na semana ativa', () => {
    expect(nextOccurrence({ kind: 'weekly', interval: 2, weekdays: [1, 5] }, '2026-11-09', '2026-11-09')).toBe('2026-11-13');
    expect(nextOccurrence({ kind: 'weekly', interval: 2, weekdays: [1, 5] }, '2026-11-09', '2026-11-13')).toBe('2026-11-23');
  });
});

describe('nextOccurrence — mensal', () => {
  it('todo dia 5', () => {
    expect(nextOccurrence({ kind: 'monthly', interval: 1, day: 5 }, '2026-11-05', '2026-11-05')).toBe('2026-12-05');
  });
  it('dia 31 em meses curtos vira o último dia', () => {
    expect(nextOccurrence({ kind: 'monthly', interval: 1, day: 31 }, '2027-01-31', '2027-01-31')).toBe('2027-02-28');
    expect(nextOccurrence({ kind: 'monthly', interval: 1, day: 31 }, '2028-01-31', '2028-01-31')).toBe('2028-02-29');
  });
  it('a cada 3 meses', () => {
    expect(nextOccurrence({ kind: 'monthly', interval: 3, day: 10 }, '2026-11-10', '2026-11-10')).toBe('2027-02-10');
  });
  it('atravessa o ano', () => {
    expect(nextOccurrence({ kind: 'monthly', interval: 1, day: 15 }, '2026-12-15', '2026-12-20')).toBe('2027-01-15');
  });
});

describe('nextDueAfterCompletion', () => {
  const weeklyMon: Recurrence = { kind: 'weekly', interval: 1, weekdays: [1] };
  it('concluída no prazo agenda a próxima ocorrência', () => {
    expect(nextDueAfterCompletion(weeklyMon, '2026-11-09', '2026-11-09')).toBe('2026-11-16');
  });
  it('concluída antes do prazo não pula o prazo atual para trás', () => {
    expect(nextDueAfterCompletion(weeklyMon, '2026-11-16', '2026-11-12')).toBe('2026-11-23');
  });
  it('concluída com atraso não cria fila de ocorrências vencidas', () => {
    expect(nextDueAfterCompletion(weeklyMon, '2026-10-12', '2026-11-10')).toBe('2026-11-16');
  });
  it('sem prazo usa a data de conclusão como âncora', () => {
    expect(nextDueAfterCompletion({ kind: 'daily', interval: 2 }, null, '2026-11-10')).toBe('2026-11-12');
  });
});

describe('describeRecurrence', () => {
  it('textos em português', () => {
    expect(describeRecurrence(null)).toBe('Não se repete');
    expect(describeRecurrence({ kind: 'daily', interval: 1 })).toBe('Todo dia');
    expect(describeRecurrence({ kind: 'weekly', interval: 1, weekdays: [4, 1] })).toBe('Toda semana (seg, qui)');
    expect(describeRecurrence({ kind: 'monthly', interval: 2, day: 5 })).toBe('A cada 2 meses, dia 5');
  });
});
