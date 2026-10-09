#!/bin/sh
set -eu
umask 077

BASE_MOUNT="/mnt/libredisplay"
CRED_DIR="/etc/libredisplay"

printf '\nLibreDisplay - NAS Picture Folder Setup\n'
printf '=========================================\n\n'
printf 'This helper creates a READ-ONLY SMB/CIFS or NFS mount for pictures.\n'
printf 'The mount is also marked noexec/nosuid/nodev because the dashboard only\n'
printf 'needs to read image files.\n\n'
printf 'Share type [1=SMB/CIFS, 2=NFS]: '
IFS= read -r kind
case "$kind" in
  1|smb|SMB|cifs|CIFS) KIND="smb" ;;
  2|nfs|NFS) KIND="nfs" ;;
  *) printf 'Unknown share type.\n' >&2; exit 1 ;;
esac

printf 'Short name for this share (letters, numbers, dash/underscore): '
IFS= read -r name
name=$(printf '%s' "$name" | tr -cd 'A-Za-z0-9_-')
[ -n "$name" ] || { printf 'A name is required.\n' >&2; exit 1; }
MOUNT_POINT="$BASE_MOUNT/$name"
sudo mkdir -p "$MOUNT_POINT"

reject_whitespace() {
  case "$1" in
    *[[:space:]]*) printf 'The share address cannot contain spaces or control whitespace.\n' >&2; exit 1 ;;
  esac
}

if [ "$KIND" = "smb" ]; then
  command -v mount.cifs >/dev/null 2>&1 || { sudo apt update; sudo DEBIAN_FRONTEND=noninteractive apt install -y cifs-utils; }
  printf 'SMB share (example //192.168.1.50/Photos): '
  IFS= read -r source
  reject_whitespace "$source"
  case "$source" in //*) ;; *) printf 'SMB share must begin with //\n' >&2; exit 1 ;; esac
  printf 'Username (leave blank for guest): '
  IFS= read -r username
  uid=$(id -u); gid=$(id -g)
  sudo mkdir -p "$CRED_DIR"
  base_opts="ro,nosuid,nodev,noexec,iocharset=utf8,vers=3.0,uid=$uid,gid=$gid,_netdev,nofail,x-systemd.automount,x-systemd.idle-timeout=60"
  if [ -n "$username" ]; then
    cred="$CRED_DIR/nas-$name.credentials"
    printf 'Password: '
    stty -echo 2>/dev/null || true
    IFS= read -r password
    stty echo 2>/dev/null || true
    printf '\n'
    tmp=$(mktemp)
    trap 'rm -f "$tmp"' EXIT HUP INT TERM
    printf 'username=%s\npassword=%s\n' "$username" "$password" > "$tmp"
    sudo install -m 600 -o root -g root "$tmp" "$cred"
    rm -f "$tmp"; trap - EXIT HUP INT TERM
    opts="credentials=$cred,$base_opts"
  else
    opts="guest,$base_opts"
  fi
  fstype="cifs"
else
  command -v mount.nfs >/dev/null 2>&1 || { sudo apt update; sudo DEBIAN_FRONTEND=noninteractive apt install -y nfs-common; }
  printf 'NFS export (example 192.168.1.50:/volume1/Photos): '
  IFS= read -r source
  reject_whitespace "$source"
  case "$source" in *:*) ;; *) printf 'NFS export should look like server:/path\n' >&2; exit 1 ;; esac
  opts="ro,nosuid,nodev,noexec,_netdev,nofail,x-systemd.automount,x-systemd.idle-timeout=60"
  fstype="nfs"
fi

entry="$source $MOUNT_POINT $fstype $opts 0 0"
marker="# LibreDisplay NAS: $name"
if sudo grep -Fq "$marker" /etc/fstab 2>/dev/null; then
  printf 'An fstab entry for %s already exists; it was left unchanged.\n' "$name"
else
  printf '%s\n%s\n' "$marker" "$entry" | sudo tee -a /etc/fstab >/dev/null
fi

sudo systemctl daemon-reload 2>/dev/null || true
if sudo mount "$MOUNT_POINT" 2>/dev/null; then
  printf '\nMounted successfully (read-only): %s\n' "$MOUNT_POINT"
else
  printf '\nThe persistent mount was saved but could not be mounted immediately.\n' >&2
  printf 'Check NAS address, credentials, permissions, and network connectivity.\n' >&2
  printf 'Retry with: sudo mount %s\n' "$MOUNT_POINT" >&2
  exit 1
fi

printf '\nIn the dashboard open:\n'
printf 'Settings > Background > Source: Local / NAS folders\n'
printf 'Then Browse folders and select: %s\n' "$MOUNT_POINT"
