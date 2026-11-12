# Gateway local da câmera

O Casita usa o go2rtc para receber RTSP e disponibilizar vídeo no painel. O gateway deve conseguir alcançar a câmera na rede local.

1. Ative RTSP ou ONVIF conforme o manual da câmera. Em modelos Yoosee que oferecem essa função, procure **Conexão NVR** no app.
2. Descubra o IP da câmera no roteador e teste o endereço RTSP no VLC. O caminho e o usuário dependem do modelo. Se a senha tiver caracteres reservados na URL, codifique esses caracteres.
3. Preencha o `.env`:

   ```dotenv
   CAMERA_RTSP_URL='rtsp://USUARIO:SENHA@IP-DA-CAMERA:554/CAMINHO'
   CAMERA_GATEWAY_URL=http://camera:1984
   CAMERA_STREAM=camera
   CAMERA_NAME="Câmera da entrada"
   ```

4. Para a instalação Docker completa, rode:

   ```sh
   docker compose --env-file .env -f deploy/docker-compose.prod.yml --profile camera up -d --wait
   ```

   Se a API roda diretamente no PC em desenvolvimento, use `CAMERA_GATEWAY_URL=http://127.0.0.1:1984`, rode `pnpm camera:up` e reinicie a API.

O painel consulta um quadro da câmera antes de marcar a transmissão como conectada. Se estiver indisponível, confira a URL RTSP, a senha e a rede. A porta de administração do gateway não precisa ser publicada. Por padrão, o vídeo passa pelo Casita e exige login.

## Gateway próprio

Defina `CAMERA_GATEWAY_KIND=generic` e a URL em `CAMERA_GATEWAY_URL`. O gateway deve responder a `GET /health` com este formato:

```json
{ "ok": true, "camera": { "online": true, "name": "Câmera" }, "hls": "/stream/index.m3u8", "snapshot": "/snapshot.jpg" }
```

Mantenha `CAMERA_PUBLIC_URL` vazia para usar o proxy autenticado do Casita. Só defina uma URL direta se você gerencia o acesso ao gateway.
