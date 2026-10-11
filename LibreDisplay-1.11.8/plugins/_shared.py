import base64
import datetime
import hashlib
import html
import json
import re
import time
from urllib.parse import urlencode, quote

_TOKEN_CACHE = {}
_TOKEN_CACHE_MAX = 128

def clamp_int(value, lo, hi, default):
    try: value = int(float(value))
    except Exception: value = default
    return max(lo, min(hi, value))

def clamp_float(value, lo, hi, default=0.0):
    try: value = float(value)
    except Exception: value = default
    return max(lo, min(hi, value))

def request_json(ctx, url, *, method='GET', headers=None, body=None, ok=(200,), max_bytes=2*1024*1024):
    status, rh, raw, final = ctx.request(url, method=method, headers=headers or {'User-Agent':'LibreDisplay integration'}, body=body, max_bytes=max_bytes)
    if status not in ok:
        # Provider error bodies are intentionally not reflected into exceptions:
        # some APIs echo request credentials or account details in error payloads.
        raise RuntimeError(f'HTTP {status}')
    if not raw:
        return {}, rh, final
    return json.loads(raw.decode('utf-8','replace')), rh, final

def oauth_refresh(ctx, cache_key, token_url, form, *, basic=None, extra_headers=None):
    now=time.time()
    for key, cached in list(_TOKEN_CACHE.items()):
        if cached.get('expires', 0) <= now:
            _TOKEN_CACHE.pop(key, None)
    row=_TOKEN_CACHE.get(cache_key)
    if row and row.get('expires',0)>now+60:
        return row['token']
    headers={'Content-Type':'application/x-www-form-urlencoded','User-Agent':'LibreDisplay integration'}
    if extra_headers: headers.update(extra_headers)
    if basic:
        raw=(str(basic[0])+':'+str(basic[1])).encode()
        headers['Authorization']='Basic '+base64.b64encode(raw).decode()
    payload=urlencode({k:v for k,v in form.items() if v not in (None,'')}).encode()
    data,_,_=request_json(ctx, token_url, method='POST', headers=headers, body=payload, ok=(200,))
    token=str(data.get('access_token') or '')
    if not token: raise RuntimeError('OAuth refresh response did not include an access token')
    try: ttl=int(data.get('expires_in') or 3600)
    except Exception: ttl=3600
    if len(_TOKEN_CACHE) >= _TOKEN_CACHE_MAX:
        oldest=min(_TOKEN_CACHE, key=lambda key: _TOKEN_CACHE[key].get('expires', 0))
        _TOKEN_CACHE.pop(oldest, None)
    _TOKEN_CACHE[cache_key]={'token':token,'expires':now+max(120,ttl)}
    return token

def bearer(settings, ctx, *, token_url=None, form=None, cache_prefix='oauth', basic=None):
    direct=str(settings.get('accessToken') or '').strip()
    if direct: return direct
    refresh=str(settings.get('refreshToken') or '').strip()
    if not refresh or not token_url: raise ValueError('Access token or refresh-token credentials are required')
    f=dict(form or {}); f.setdefault('grant_type','refresh_token'); f.setdefault('refresh_token',refresh)
    key=hashlib.sha256(('\0'.join((str(cache_prefix), str(token_url), str(settings.get('clientId') or ''), refresh))).encode('utf-8','replace')).hexdigest()
    return oauth_refresh(ctx,key,token_url,f,basic=basic)

def plain_text(value, limit=600):
    s=html.unescape(re.sub(r'<[^>]+>',' ',str(value or '')))
    return re.sub(r'\s+',' ',s).strip()[:limit]

def dt_text(value):
    s=str(value or '').strip()
    if not s: return ''
    return s.replace('T',' ').replace('Z',' UTC')[:19]

def qs(base, params):
    return base + ('&' if '?' in base else '?') + urlencode({k:v for k,v in params.items() if v not in (None,'')}, doseq=True)
