#!/usr/bin/env python3
"""Throwaway probe: can BrightData Web Unlocker pull carsales DETAIL pages (where the RedBook
specs live), the same way it pulled CCS caravan detail pages? Tests fresh URLs with one retry."""
import json, re, time, urllib.request

KEY = open(".env.local").read().split("BRIGHTDATA_API_KEY=")[1].split("\n")[0].strip()


def unlock(u):
    body = json.dumps({"zone": "test", "url": u, "format": "raw", "country": "au"}).encode()
    r = urllib.request.Request("https://api.brightdata.com/request", data=body,
                               headers={"Content-Type": "application/json",
                                        "Authorization": f"Bearer {KEY}"}, method="POST")
    try:
        with urllib.request.urlopen(r, timeout=90) as resp:
            return resp.read().decode("utf-8", "replace")
    except Exception as e:
        return f"ERR {e}"


# gather fresh detail URLs from popular make/model results pages
urls = []
for mm in ["toyota/landcruiser", "ford/ranger", "isuzu-ute/d-max", "mitsubishi/triton",
           "toyota/hilux", "nissan/patrol"]:
    h = unlock(f"https://www.carsales.com.au/cars/{mm}/")
    found = list(dict.fromkeys(re.findall(r"/cars/details/[a-z0-9-]+/SSE-AD-\d+", h, re.I)))
    urls += ["https://www.carsales.com.au" + u + "/" for u in found[:3]]
    print(f"  {mm}: results {len(h)}b -> {len(found)} detail links", flush=True)
urls = list(dict.fromkeys(urls))[:12]
print(f"\nscan-testing {len(urls)} detail pages (1 retry each):", flush=True)

ok = specs = 0
for i, u in enumerate(urls):
    h = unlock(u)
    if len(h) < 5000:
        time.sleep(3)
        h = unlock(u)
    good = len(h) >= 5000 and "captcha-delivery" not in h.lower()
    sp = bool(re.search(r"(Kerb Weight|Gross Vehicle Mass|Gross Combination|Tow Ball)", h, re.I)) if good else False
    ok += good
    specs += sp
    print(f"  {i+1:2} {len(h):>8}b  {'OK' if good else 'BLOCK'}  specs={sp}  {u.split('/details/')[1][:36]}", flush=True)
    time.sleep(2)
print(f"\nRESULT: {ok}/{len(urls)} pages came through · {specs}/{len(urls)} had RedBook specs", flush=True)
