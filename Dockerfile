# Imagem única: API + build do React (a API serve o frontend em produção).
FROM node:24-alpine
WORKDIR /app
RUN npm install --global pnpm@12.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_API_URL=
RUN pnpm --filter web build && mkdir -p data/uploads
ENV NODE_ENV=production
EXPOSE 3100
CMD ["pnpm", "--filter", "api", "start"]
