#!/usr/bin/env python3
"""
Rich caravan-listing spec extractor — capture as MUCH as possible per van for the physics.
Shared by every caravan scraper (caravanking plain-fetch + Browserless dealer sweep + CCS).

Returns a dict of mapped fields (weights, dimensions, water, gas, axle, sleeps) PLUS a raw
`features` catch-all so nothing useful is dropped, even fields we don't have a column for yet.
Handles unit variety: ATM "3500 KG" or "ATM 3500"; length 16' / 16’ (feet) / 7.0m / 7000mm;
water "2 x 95L" -> 190.
"""
import gzip
import hashlib
import html as _html
import json
import os
import re

FT = 304.8  # ft -> mm


def hold_raw(raw_html: str, store_dir: str, manifest_path: str, ident: dict) -> str:
    """Hold the COMPLETE raw HTML (gzipped) so any field can be re-parsed later without
    re-fetching the source. Returns the content hash. Files are content-addressed
    (<hash>.html.gz) so identical pages dedupe and a re-run never re-writes.

    `ident` is the universal identity to record in the manifest (e.g. {"slug":..,"year":..});
    keep it free of source URLs/ids — the manifest stays anonymised, while the .gz blob is the
    private, gitignored full capture used only to derive stats.
    """
    os.makedirs(store_dir, exist_ok=True)
    blob = (raw_html or "").encode("utf-8", "replace")
    digest = hashlib.sha256(blob).hexdigest()[:16]
    path = os.path.join(store_dir, f"{digest}.html.gz")
    if not os.path.exists(path):
        with gzip.open(path, "wb") as f:
            f.write(blob)
    with open(manifest_path, "a") as f:
        f.write(json.dumps({**ident, "hash": digest, "bytes": len(blob)}) + "\n")
    return digest


def _num(label, h, lo=250, hi=6000):
    for m in re.finditer(label + r"\s*:?\s*([0-9][0-9,]{1,4})(?:\s*kg)?\b", h, re.I):
        n = int(m.group(1).replace(",", ""))
        if lo <= n <= hi:
            return n
    return None


def _length_mm(labels, h):
    """First plausible length after any of the labels, in mm. Accepts ft (' or ’), m, mm."""
    lab = "(?:" + "|".join(labels) + ")"
    for m in re.finditer(lab + r"[^0-9]{0,18}([0-9]{1,2}(?:[.,][0-9]{1,2})?)\s*(mm|m\b|ft|feet|['’ʼ])", h, re.I):
        v = float(m.group(1).replace(",", "."))
        u = m.group(2).lower()
        mm = v if u == "mm" else (round(v * 1000) if u == "m" else round(v * FT))
        if 2000 <= mm <= 13000:
            return mm
    return None


def _water_l(labels, h):
    """Total litres after a water label. Handles 'N x ML' and 'ML'."""
    lab = "(?:" + "|".join(labels) + ")"
    m = re.search(lab + r"[^0-9]{0,25}?([0-9])\s*[x×]\s*([0-9]{2,3})\s*l\b", h, re.I)
    if m:
        return int(m.group(1)) * int(m.group(2))
    m = re.search(lab + r"[^0-9]{0,25}?([0-9]{2,3})\s*(?:l\b|litre|ltr)", h, re.I)
    return int(m.group(1)) if m else None


def _axle(h):
    t = h.lower()
    if re.search(r"tripl|tri[- ]?axle|3[- ]?axle", t):
        return "TRIPLE_AXLE"
    if re.search(r"tandem|dual[- ]?axle|twin[- ]?axle|2[- ]?axle", t):
        return "DUAL_AXLE_CLOSE_COUPLED"
    if re.search(r"single[- ]?axle|1[- ]?axle", t):
        return "SINGLE_AXLE"
    return None


def extract(raw_html: str) -> dict:
    h = _html.unescape(raw_html or "")
    h = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", h, flags=re.S | re.I)
    # spec list items (li / spec rows) — the feature catch-all, before tag-stripping
    items = re.findall(r"<li[^>]*>(.*?)</li>", h, re.S | re.I)
    SPEC_KW = re.compile(
        r"water|gas|solar|battery|batteries|awning|chassis|axle|bed|bunk|oven|"
        r"grill|fridge|microwave|shower|toilet|air ?con|a/c|tv|inverter|hot water|"
        r"suspension|brake|stove|island|ensuite|berth|kg|litre|watt|amp|volt|tank|"
        r"led|annexe|jack|tow|coupling|disc|drum|leaf|coil|independent",
        re.I)
    feats = []
    for it in items:
        t = re.sub(r"<[^>]+>", " ", it)
        t = re.sub(r"\s+", " ", t).strip()
        # keep only spec-relevant items (drop nav/menu/footer noise)
        if 4 <= len(t) <= 80 and SPEC_KW.search(t) and not re.search(
            r"http|copyright|©|cookie|privacy|finance|sitemap|menu|sign ?in|log ?in", t, re.I):
            feats.append(t)
    text = re.sub(r"<[^>]+>", " ", h)
    text = re.sub(r"\s+", " ", text)

    # Two independent weight sources on a CCS-style page:
    #  - RedBook: the manufacturer DATABASE spec (base/compliance figure), structured labels.
    #  - dealer:  free-text "* ATM:" the dealer typed for THIS van (base + fitted options).
    # They legitimately differ (the gap = fitted options). Capture both; prefer RedBook as the
    # authoritative base (a single capture is high-confidence — it's the manufacturer figure).
    redbook = {
        "atmKg": _num(r"Aggregate Trailer Mass", text),
        "gtmKg": _num(r"Gross Trailer Mass", text),
        "tareKg": _num(r"Tare Mass", text),
        "ballKg": _num(r"Towball(?:\s*Download)?\s*Mass", text, lo=40, hi=600),
    }
    dealer = {
        "atmKg": _num("ATM", text),
        "gtmKg": _num("GTM", text),
        "tareKg": _num("TARE", text),
        "ballKg": _num(r"BALL(?:\s*WEIGHT|\s*MASS)?", text, lo=40, hi=600),
    }

    return {
        # primary = authoritative RedBook where present, else the dealer's as-configured figure
        "atmKg": redbook["atmKg"] if redbook["atmKg"] is not None else dealer["atmKg"],
        "gtmKg": redbook["gtmKg"] if redbook["gtmKg"] is not None else dealer["gtmKg"],
        "tareKg": redbook["tareKg"] if redbook["tareKg"] is not None else dealer["tareKg"],
        "ballKg": redbook["ballKg"] if redbook["ballKg"] is not None else dealer["ballKg"],
        # keep both sets so the land step can grade confidence by source (DB vs dealer-typed)
        "redbook": redbook,
        "dealer": dealer,
        "weightSource": "redbook" if any(v is not None for v in redbook.values()) else (
            "dealer" if any(v is not None for v in dealer.values()) else None),
        "bodyLengthMm": _length_mm(["body length"], text),
        "overallLengthMm": _length_mm(["overall", "total caravan length", "travel length", "external length"], text),
        "freshWaterL": _water_l(["fresh water", "water tank", "fresh-water"], text),
        "greyWaterL": _water_l(["grey water", "grey-water", "gray water"], text),
        "gasBottleConfig": (lambda m: m.group(0).strip() if m else None)(
            re.search(r"[0-9]\s*[x×]\s*[0-9]{1,2}\s*kg", text, re.I)),
        "axleConfiguration": _axle(text),
        "sleeps": (lambda m: int(m.group(1)) if m else None)(
            re.search(r"sleeps?\s*:?\s*([0-9])\b", text, re.I)),
        "features": list(dict.fromkeys(feats))[:60],
    }


if __name__ == "__main__":  # quick self-test on a snippet
    s = "TARE: 1784 KG ATM: 2159 KG GTM: 1911 KG Ball Weight: 210 KG Body Length: 16’ Single Axle Fresh water tank 2 x 95L Sleeps 4 Gas bottles 2 x 9kg"
    import json
    print(json.dumps(extract(s), indent=1))
