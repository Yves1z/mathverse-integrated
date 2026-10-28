#!/usr/bin/env bash
# Packaged as install.sh next to release.tar.gz and the existing release script.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
mode=${1:-install}
[[ $mode == install || $mode == --check-only ]] || { echo 'Usage: sudo bash install.sh [--check-only]' >&2; exit 1; }
kit_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
for executable in python3 sha256sum systemctl nginx sudo psql pg_dump curl tar realpath; do
  command -v "$executable" >/dev/null || { echo "Missing command: $executable" >&2; exit 1; }
done
cd "$kit_dir"
sha256sum -c SHA256SUMS
for path in /srv/mathsea/backend/app.jar /srv/mathsea/backend/start.sh /srv/mathsea/backend/.env /var/www/mathsea-current/index.html; do
  [[ -f $path ]] || { echo "Server layout does not match: $path. No application changes made." >&2; exit 1; }
done
for service in mathsea-backend.service postgresql redis-server; do
  systemctl is-active --quiet "$service" || { echo "Required service is not active: $service" >&2; exit 1; }
done
nginx -t
curl --connect-timeout 5 --max-time 15 -fsS http://127.0.0.1:8000/actuator/health >/dev/null
curl --connect-timeout 5 --max-time 15 -fsS --resolve mathverse.com.cn:443:127.0.0.1 https://mathverse.com.cn/api/v1/health >/dev/null
stage=$(mktemp -d /tmp/mathverse-agent-admin-beta.XXXXXX)
trap 'rm -rf -- "$stage"' EXIT
sudo -u postgres psql -d mathsea -Atc "SELECT version || ':' || success FROM flyway_schema_history WHERE version IN ('19','20') ORDER BY installed_rank" | sort > "$stage/migrations"
[[ $(cat "$stage/migrations") == $'19:true\n20:true' ]] || { echo 'Expected successful V19/V20 migrations; stopped before application changes.' >&2; exit 1; }
sudo -u postgres psql -d mathsea -Atc "SELECT count(*) FROM problems WHERE problem_number !~ '^[GETN][CMFS][0-9]{6}$'" | grep -qx '0'
mkdir "$stage/application"
python3 verify-admin-beta-release.py release.tar.gz /srv/mathsea/backend/app.jar "$stage/application"
echo 'Preflight passed. Existing configuration and database migrations are retained.'
if [[ $mode == --check-only ]]; then
  echo 'Check-only finished; application and database were not modified.'
  exit 0
fi
bash "$kit_dir/release-editorial.sh" "$stage/application"
echo 'Administrator beta published. Sign in with an existing administrator account and test the model connection.'
