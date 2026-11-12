import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const notFound = (what = 'Registro') => new HttpError(404, `${what} não encontrado`);
export const forbidden = () => new HttpError(403, 'Sem permissão para esta ação');

// Formato único de erro para o frontend: { error: string, issues?: [...] }
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: error.issues[0]?.message ?? 'Dados inválidos',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) request.log.error(error);
    return reply.code(status).send({ error: status >= 500 ? 'Erro interno. Tente novamente.' : (error as Error).message });
  });
}
