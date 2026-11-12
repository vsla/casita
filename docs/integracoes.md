# Integrações do Casita

Todas são opcionais. As credenciais ficam na instalação que as usa.

## Clima

Em **Ajustes → Identidade da casa**, informe cidade, latitude e longitude e ative **Mostrar clima**. O Casita consulta o Open-Meteo quando há internet.

## Calendário iCloud

1. Gere uma senha específica para app em `account.apple.com`.
2. Preencha `ICLOUD_USERNAME` e `ICLOUD_APP_PASSWORD` no `.env` e reinicie o app para carregar as variáveis.
3. Entre como administrador, abra **Ajustes → Integrações**, selecione os calendários e clique em **Sincronizar**.

A importação é somente leitura. O Casita busca mudanças periodicamente e permite sincronização manual. Eventos locais podem ser criados no próprio painel.

## Fotos do iCloud

Crie um álbum compartilhado, ative **Site Público** e copie o link. Em **Ajustes → Integrações**, cole o link, ative o álbum e sincronize. Qualquer pessoa com o link público do álbum pode abrir o álbum no iCloud. Se preferir manter tudo apenas no Casita, envie fotos pela galeria.

## Câmera e Spotify

- [Gateway local da câmera](camera-gateway.md)
- [Configuração do Spotify](spotify.md)

Midea e Alexa ainda não têm integração funcional.
