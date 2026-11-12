#!/usr/bin/env bash
# Abre o painel em tela cheia no monitor touch (Debian/XFCE).
# Coloque em ~/.config/autostart/kiosk.desktop com Exec=/home/casa/home-hub/deploy/kiosk.sh
set -euo pipefail
URL="${HOME_HUB_URL:-http://localhost:3100}"

# Não deixar a tela apagar sozinha durante o dia (o desligamento noturno fica para a Entrega 4)
xset s off || true
xset -dpms || true

# Espera a API subir após o boot
until curl -fsS "$URL/api/health" >/dev/null 2>&1; do sleep 2; done

exec chromium \
  --kiosk "$URL" \
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
  --overscroll-history-navigation=0 --disable-pinch \
  --check-for-update-interval=31536000
