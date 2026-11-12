// URL da API configurável para a futura VPS. Vazio = mesma origem (recomendado).
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  issues?: { path: string; message: string }[];
  constructor(status: number, message: string, issues?: { path: string; message: string }[]) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

type Init = { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown; form?: FormData };

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: init.method ?? (init.body !== undefined || init.form ? 'POST' : 'GET'),
      credentials: 'include',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor da casa');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Erro ${res.status}`, data?.issues);
  return data as T;
}

/** Arquivos da API (/api/files/...) precisam do prefixo quando a API estiver em outro domínio. */
export const assetUrl = (url: string | null | undefined) => (url?.startsWith('/api/') ? `${API_URL}${url}` : (url ?? ''));

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado');
