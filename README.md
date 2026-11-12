# Casita

Painel doméstico para acompanhar agenda, tarefas, compras, recados, pets, fotos e câmera. Funciona no navegador do PC, celular e TV na mesma rede. Cada instalação começa com seu próprio banco e um único administrador escolhido por quem instala.

## Instale em três passos

1. Instale e abra o Docker Desktop (Windows/macOS) ou inicie o Docker Engine com Compose (Linux). Extraia o ZIP e abra o terminal na pasta que contém este README.
2. Copie `.env.example` para `.env`. No Windows, use `Copy-Item .env.example .env`. No Linux/macOS, use `cp .env.example .env`. Abra o novo arquivo e preencha:

   ```dotenv
   BOOTSTRAP_HOUSE_NAME="Minha casa"
   BOOTSTRAP_HOUSE_TIMEZONE=America/Sao_Paulo
   BOOTSTRAP_ADMIN_USERNAME=admin
   BOOTSTRAP_ADMIN_NAME="Meu nome"
   BOOTSTRAP_ADMIN_PASSWORD=
   ```

   Escolha uma senha com **pelo menos 12 caracteres**. Se ela tiver `$` ou `#`, coloque o valor entre aspas simples. Os campos `BOOTSTRAP_` só são usados ao criar a primeira casa; depois, altere nome e senha pelo painel.
3. Suba o painel:

   ```sh
   docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d --build --wait
   ```

   Abra [http://localhost:3100](http://localhost:3100/) e entre com o usuário e a senha que escolheu. A primeira execução baixa e monta as imagens. Não precisa instalar Node nem criar contas em serviços externos.

## Deixe com a cara da sua casa

- **Ajustes → Identidade da casa:** nome, subtítulo, fuso e localização opcional para o clima.
- **Ajustes → Moradores e acessos:** crie usuários separados e adicione fotos de perfil se quiser. Use o papel **Painel (kiosk)** para a TV.
- **Ajustes → Layout da tela inicial:** personalize o painel e o celular separadamente. No monitor, use **Editar o layout à mão** para mover ou redimensionar cards.
- Use **+** para adicionar o primeiro recado, tarefa, compra, compromisso, pet ou foto.
- Na TV ou no celular conectado ao mesmo Wi-Fi, abra `http://IP-DO-PC:3100`. Descubra o IPv4 do PC com `ipconfig` no Windows. Se o firewall pedir permissão, permita o acesso do Docker na rede privada.

## Integrações opcionais

| Integração | Onde configurar |
|---|---|
| Clima | Ative em **Identidade da casa** e informe latitude e longitude. |
| Câmera RTSP | [Guia do gateway da câmera](docs/camera-gateway.md). |
| Calendário e fotos do iCloud | [Guia de integrações](docs/integracoes.md). |
| Spotify | [Guia do Spotify](docs/spotify.md). |

Midea e Alexa estão previstas. Para acessar de fora de casa, use um serviço privado como Tailscale Serve. Para HTTPS atrás de um proxy no mesmo PC, use `CASITA_BIND_IP=127.0.0.1` e `COOKIE_SECURE=true`. O exemplo em [deploy/Caddyfile](deploy/Caddyfile) pressupõe um domínio próprio e certificado válido.

## Ligar de novo, atualizar e guardar os dados

Depois de abrir o Docker, ligue de novo com:

```sh
docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d --wait
```

Após baixar uma atualização do código, use o mesmo comando da instalação com `--build`. A API aplica as migrações ao iniciar. O banco e as fotos ficam nos volumes `pgdata` e `uploads` do projeto Compose. Faça backup dos dois e guarde o `.env` em local privado. Para parar, use `docker compose --env-file .env -f deploy/docker-compose.prod.yml stop`.

Se a instalação não terminar, veja os logs:

```sh
docker compose --env-file .env -f deploy/docker-compose.prod.yml logs --tail 80 app
```

Se a porta 3100 estiver ocupada, altere `CASITA_PORT` no `.env` e use essa porta no navegador. Se já houver uma instalação Compose antiga, mantenha o nome de projeto que ela usava com `docker compose -p NOME-ANTIGO ...` para continuar usando os volumes existentes.

## Desenvolvimento

Requisitos: Node 24, pnpm 12.18.0 e Docker. Configure o `.env` como acima. Se o Corepack não conseguir instalar essa versão do pnpm, use `npm install --global pnpm@12.18.0`.

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm dev
```

Abra [http://localhost:5173](http://localhost:5173/). O servidor aplica as migrações e cria a primeira casa automaticamente. Para explorar com dados fictícios, use um **banco separado e vazio**, rode `pnpm db:migrate` e depois `pnpm db:seed` com `SEED_PASSWORD` de pelo menos 12 caracteres. Esse comando é destinado a demonstração e testes.

- `apps/web`: React, Vite e Tailwind.
- `apps/api`: Fastify, Drizzle, PostgreSQL e Socket.IO.
- `packages/shared`: tipos, validação e recorrência.
- `deploy`: Docker Compose, gateway da câmera e exemplos de implantação.
