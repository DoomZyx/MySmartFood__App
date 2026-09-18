#!/bin/sh
# A lancer sur le VPS en root (sudo). Passe le vhost API de 10m a 64m.
set -e
SRC="/etc/nginx/sites-available/app.api.mysmartfood.fr"
if ! grep -q "client_max_body_size 10m;" "$SRC"; then
  echo "client_max_body_size 10m introuvable dans $SRC"
  exit 1
fi
sed -i "s/client_max_body_size 10m;/client_max_body_size 64m;/" "$SRC"
if [ -f /etc/nginx/snippets/mysmartfood-spa.conf ]; then
  if ! grep -q "client_max_body_size" /etc/nginx/snippets/mysmartfood-spa.conf; then
    sed -i "/^index index.html;/a client_max_body_size 64m;" /etc/nginx/snippets/mysmartfood-spa.conf
  fi
fi
nginx -t
systemctl reload nginx
echo "nginx: client_max_body_size 64m OK"
