# Spotify → painel

O card **Música** mostra o que está tocando em qualquer aparelho da conta (celular, PC, TV) e
controla play/pausa/pular. **Na TV** passa a música para a TV, ou começa a playlist padrão quando
não há nada para continuar. Usa a API oficial do Spotify, e controlar a reprodução exige **Premium**.

O token da conta fica só no servidor. O navegador nunca vê credenciais.

## 1. Criar o app no Spotify (uma vez)

1. Entre em <https://developer.spotify.com/dashboard> com a conta do Spotify e clique em **Create app**.
2. Nome e descrição: qualquer coisa (ex.: "Painel da casa").
3. **Redirect URI**: `http://127.0.0.1:3100/api/integrations/spotify/callback`. Se você alterou
   `CASITA_PORT`, use a porta escolhida. O endereço precisa coincidir com o configurado no Casita.
4. Em "Which API/SDKs", marque **Web API** e salve.
5. Em **Settings**, copie o **Client ID** e o **Client secret** (em "View client secret").
6. Se outra pessoa for conectar a conta dela, adicione-a em **User Management**, conforme as
   permissões do seu app no Spotify.

## 2. No `.env` do servidor

```bash
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

Recrie o serviço para carregar as variáveis:

```sh
docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d --wait
```

Em desenvolvimento, reinicie `pnpm dev`.

## 3. Conectar a conta

No **PC onde o servidor roda**, abra **Ajustes → Integrações → Spotify → Conectar Spotify**, autorize
e feche a aba quando aparecer "Spotify conectado". Precisa ser no próprio PC, porque o Spotify volta
para `127.0.0.1`.

Depois, ainda em Ajustes:

- **Qual aparelho é a TV?** A TV só aparece na lista depois que o app Spotify for aberto nela pelo
  menos uma vez.
- **Playlist padrão**: o que tocar quando não houver nada para continuar.

## Limites

- **TV desligada:** se o Spotify não estiver aberto na TV, ela some da lista de aparelhos do Spotify
  e o botão **Na TV** avisa isso. Ligar a TV pelo painel exigiria o protocolo de controle remoto da
  Google TV, que ainda não foi feito.
- **Atualização:** o card consulta o Spotify a cada 5 s, porque a música pode começar ou parar em outro aparelho.
  Comandos dados pelo painel aparecem na hora em todas as telas.
