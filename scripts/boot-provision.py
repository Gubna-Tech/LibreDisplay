#!/usr/bin/env python3
"""Install LibreDisplay's independent recovery launcher without disrupting other autostart entries."""
from __future__ import annotations
import argparse,os,re,shutil,stat,tempfile
from pathlib import Path

def atomic_install(source:Path,target:Path,mode:int):
    target.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.libredisplay-',dir=str(target.parent))
    try:
        with os.fdopen(fd,'wb') as out,source.open('rb') as inp: shutil.copyfileobj(inp,out)
        os.chmod(tmp,mode);os.replace(tmp,target)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def provision(release:Path,home:Path,require_autostart=False):
    release=release.resolve();home=home.resolve();install=home/'libredisplay'
    root=home/'libredisplay-recovery';root.mkdir(mode=0o700,parents=True,exist_ok=True);os.chmod(root,0o700)
    bridge=release/'scripts/boot-bridge.sh';guardian=release/'scripts/release-rollback.py'
    for file in (bridge,guardian):
        if not file.is_file() or file.is_symlink():raise RuntimeError(f'Missing recovery component: {file}')
    compile(guardian.read_text(),str(guardian),'exec')
    if not bridge.read_text().startswith('#!/bin/sh'):raise RuntimeError('Invalid recovery launcher')
    # Make a previous guardian recoverable independently of the live code update.
    prior=root/'release-rollback.py'
    if prior.exists() and prior.read_bytes()!=guardian.read_bytes():
        atomic_install(prior,root/'release-rollback.previous.py',0o600)
    atomic_install(guardian,prior,0o600)
    atomic_install(bridge,root/'launch.sh',0o700)
    autostart=home/'.config/labwc/autostart'
    if not autostart.is_file():
        if require_autostart:raise RuntimeError('labwc autostart is missing; boot recovery cannot be guaranteed')
        return {'externalGuard':True,'bootBridge':True,'autostart':'absent'}
    previous=autostart.read_text()
    original=f'sleep 5 && sh "{install}/scripts/start.sh" &'
    replacement=f'sleep 5 && sh "{root}/launch.sh" &'
    if replacement in previous:return {'externalGuard':True,'bootBridge':True,'autostart':'already-protected'}
    if original not in previous:
        if require_autostart:raise RuntimeError('Nonstandard labwc autostart: no canonical LibreDisplay startup line')
        return {'externalGuard':True,'bootBridge':True,'autostart':'nonstandard'}
    revised=previous.replace(original,replacement)
    if revised.count(replacement)!=1:raise RuntimeError('Ambiguous LibreDisplay autostart entries')
    backup=root/'labwc-autostart.before-boot-bridge'
    if not backup.exists():backup.write_text(previous)
    fd,tmp=tempfile.mkstemp(prefix='.libredisplay-autostart-',dir=str(autostart.parent))
    try:
        with os.fdopen(fd,'w') as out:out.write(revised)
        os.chmod(tmp,autostart.stat().st_mode&0o777);os.replace(tmp,autostart)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
    return {'externalGuard':True,'bootBridge':True,'autostart':'protected'}

def main():
    p=argparse.ArgumentParser();p.add_argument('--release',type=Path,required=True);p.add_argument('--home',type=Path,default=Path.home());p.add_argument('--require-autostart',action='store_true');a=p.parse_args()
    try:print(provision(a.release,a.home,a.require_autostart))
    except (OSError,RuntimeError,ValueError) as exc:p.exit(1,f'Independent boot recovery setup failed: {exc}\n')
if __name__=='__main__':main()
