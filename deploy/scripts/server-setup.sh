#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu 22.04/24.04 server for EKA BUILD.
#   curl -fsSL https://raw.githubusercontent.com/<org>/ekabuild/main/deploy/scripts/server-setup.sh | sudo bash
set -euo pipefail

echo "▶ system update"
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git ufw fail2ban unattended-upgrades

echo "▶ docker engine + compose plugin"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "▶ firewall: SSH, HTTP, HTTPS only"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "▶ swap (2G) for builds on small machines"
if ! swapon --show | grep -q swap; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "▶ automatic security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "✓ server ready. Next: git clone the repo to /opt/ekabuild, create .env, run deploy/scripts/init-letsencrypt.sh"
