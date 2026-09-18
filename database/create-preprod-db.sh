#!/usr/bin/env bash
# Crée la base et les rôles PostgreSQL isolés pour la préprod MySmartFood.
# À exécuter en superuser postgres. Ne DROP rien, ne touche pas les données
# de la base prod `mysmartfood` ni des bases Mafrashop.
#
# Ordre :
#   1. ce script
#   2. APP_ENV=preprod node database/bootstrapRoles.js
#   3. APP_ENV=preprod pnpm db:migrate
#
# Mots de passe (obligatoires, jamais en dur dans le dépôt) :
#   PREPROD_OWNER_PASSWORD   LOGIN de mysmartfood_preprod_owner (>= 16)
#   PREPROD_APP_PASSWORD     LOGIN de mysmartfood_preprod_app (>= 16)
#                            (sinon APP_DB_RUNTIME_PASSWORD)
#
# Exemple :
#   sudo -u postgres PREPROD_OWNER_PASSWORD='...' PREPROD_APP_PASSWORD='...' \
#     bash backend/database/create-preprod-db.sh
#
# Connexion psql : pair local par défaut (base `postgres`).
# Surcharge possible : PGHOST PGPORT PGUSER. Laisser PGDATABASE=postgres.

set -euo pipefail

PREPROD_DB="mysmartfood_preprod"
PREPROD_OWNER_ROLE="mysmartfood_preprod_owner"
PREPROD_APP_ROLE="mysmartfood_preprod_app"
PROD_DB="mysmartfood"

if [[ -z "${PREPROD_OWNER_PASSWORD:-}" ]]; then
  echo "PREPROD_OWNER_PASSWORD requis (16 caractères minimum)." >&2
  exit 1
fi

APP_PASSWORD="${PREPROD_APP_PASSWORD:-${APP_DB_RUNTIME_PASSWORD:-}}"
if [[ -z "${APP_PASSWORD}" ]]; then
  echo "PREPROD_APP_PASSWORD ou APP_DB_RUNTIME_PASSWORD requis (16 caractères minimum)." >&2
  exit 1
fi

if [[ ${#PREPROD_OWNER_PASSWORD} -lt 16 ]]; then
  echo "PREPROD_OWNER_PASSWORD trop court (16 caractères minimum)." >&2
  exit 1
fi
if [[ ${#APP_PASSWORD} -lt 16 ]]; then
  echo "Mot de passe du rôle applicatif trop court (16 caractères minimum)." >&2
  exit 1
fi

TARGET_DB="${PGDATABASE:-postgres}"
if [[ "${TARGET_DB}" == "${PROD_DB}" ]] || [[ "${TARGET_DB}" == "${PREPROD_DB}" ]]; then
  echo "Refus : CREATE DATABASE s'exécute depuis la base postgres, pas ${TARGET_DB}." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -tAc "SELECT current_setting('is_superuser')" | grep -qx on \
  || { echo "Refus : un superuser PostgreSQL est requis." >&2; exit 1; }

psql -v ON_ERROR_STOP=1 \
  -v owner_password="${PREPROD_OWNER_PASSWORD}" \
  -v app_password="${APP_PASSWORD}" \
  <<'SQL'
SELECT current_user AS connected_as, current_database() AS connected_db;

SELECT CASE
  WHEN EXISTS (SELECT FROM pg_roles WHERE rolname = 'mysmartfood_preprod_owner')
  THEN format(
    'ALTER ROLE mysmartfood_preprod_owner WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L',
    :'owner_password'
  )
  ELSE format(
    'CREATE ROLE mysmartfood_preprod_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L',
    :'owner_password'
  )
END
\gexec

SELECT CASE
  WHEN EXISTS (SELECT FROM pg_roles WHERE rolname = 'mysmartfood_preprod_app')
  THEN format(
    'ALTER ROLE mysmartfood_preprod_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L',
    :'app_password'
  )
  ELSE format(
    'CREATE ROLE mysmartfood_preprod_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L',
    :'app_password'
  )
END
\gexec
SQL

if psql -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM pg_database WHERE datname = '${PREPROD_DB}'" | grep -qx 1; then
  echo "Base ${PREPROD_DB} déjà présente : CREATE DATABASE ignoré (pas de DROP)."
else
  psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${PREPROD_DB} OWNER ${PREPROD_OWNER_ROLE}"
fi

# Droits uniquement sur la base préprod.
psql -v ON_ERROR_STOP=1 -d "${PREPROD_DB}" <<SQL
REVOKE ALL ON DATABASE ${PREPROD_DB} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${PREPROD_DB} TO ${PREPROD_OWNER_ROLE};
GRANT CONNECT ON DATABASE ${PREPROD_DB} TO ${PREPROD_APP_ROLE};
GRANT CREATE, TEMP ON DATABASE ${PREPROD_DB} TO ${PREPROD_OWNER_ROLE};
ALTER DATABASE ${PREPROD_DB} OWNER TO ${PREPROD_OWNER_ROLE};
SQL

# Retirer tout accès des rôles préprod aux autres bases (prod, Mafrashop, postgres, …).
# Aucun DROP. Aucun GRANT sur ces bases.
psql -v ON_ERROR_STOP=1 <<'SQL'
SELECT format(
  'REVOKE ALL ON DATABASE %I FROM mysmartfood_preprod_owner, mysmartfood_preprod_app',
  datname
)
FROM pg_database
WHERE datallowconn
  AND NOT datistemplate
  AND datname <> 'mysmartfood_preprod'
\gexec
SQL

echo "Préprod prête : database ${PREPROD_DB}, rôles ${PREPROD_OWNER_ROLE} / ${PREPROD_APP_ROLE}."
echo "Ensuite, depuis backend/ :"
echo "  APP_ENV=preprod node database/bootstrapRoles.js"
echo "  APP_ENV=preprod pnpm db:migrate"
