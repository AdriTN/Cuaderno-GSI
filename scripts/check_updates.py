#!/usr/bin/env python3
"""
Vigila las fuentes oficiales de la oposición y registra novedades en data/live.json.

Fuentes (configurables en data/sources.json):
  - BOE: sumario diario de la API de datos abiertos (https://www.boe.es/datosabiertos/),
    filtrando por los cuerpos y palabras configurados.
  - Páginas del INAP de cada convocatoria: detecta documentos nuevos (cuestionarios,
    plantillas, notas, listas…) comparando los enlaces con los ya conocidos.

Salidas:
  - data/live.json  → lo que la app muestra: novedades, documentos y fecha de comprobación.
  - novedades.md    → resumen para el aviso por correo (solo si hay novedades).
  - GITHUB_OUTPUT   → has_news=true|false para el workflow.

Uso:  python3 scripts/check_updates.py [--dry-run]
Variables de entorno opcionales (útiles para pruebas): BOE_BASE, TODAY (AAAA-MM-DD).
"""
import hashlib
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SOURCES = os.path.join(ROOT, "data", "sources.json")
LIVE = os.path.join(ROOT, "data", "live.json")
REPORT = os.path.join(ROOT, "novedades.md")
BOE_BASE = os.environ.get("BOE_BASE", "https://www.boe.es")
UA = "CuadernoGSI/1.0 (+https://github.com; vigilante de novedades de oposiciones)"
MAX_NEWS = 200


def norm(s: str) -> str:
    """Minúsculas y sin acentos, para comparar textos."""
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()


def fetch(url: str, accept: str = "text/html") -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code != 404:
            print(f"  aviso: {url} respondió {e.code}", file=sys.stderr)
    except Exception as e:  # red caída, DNS, tiempo agotado…
        print(f"  aviso: no se pudo leer {url}: {e}", file=sys.stderr)
    return None


# ---------------------------------------------------------------- BOE
def boe_items(obj):
    """Recorre el sumario (JSON) y devuelve cada disposición con identificador y título."""
    if isinstance(obj, dict):
        if "identificador" in obj and "titulo" in obj:
            yield obj
        for v in obj.values():
            yield from boe_items(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from boe_items(v)


def link_of(item: dict) -> str:
    for k in ("url_html", "url_pdf", "url_xml"):
        v = item.get(k)
        if isinstance(v, dict):
            v = v.get("texto") or v.get("#text") or v.get("valor")
        if isinstance(v, str) and v:
            return v if v.startswith("http") else urljoin(BOE_BASE, v)
    return f"{BOE_BASE}/diario_boe/txt.php?id={item.get('identificador')}"


def check_boe(cfg: dict, last_day: date, today: date, known: set) -> list:
    keywords = [norm(k) for k in cfg.get("keywords", [])]
    context = [norm(k) for k in cfg.get("must_also_include_any", [])]
    start = max(last_day + timedelta(days=1), today - timedelta(days=cfg.get("max_days_back", 10)))
    news = []
    d = start
    while d <= today:
        raw = fetch(f"{BOE_BASE}/datosabiertos/api/boe/sumario/{d:%Y%m%d}", "application/json")
        if raw:
            try:
                data = json.loads(raw)
            except ValueError:
                data = {}
            for it in boe_items(data):
                title = it.get("titulo") or ""
                t = norm(title)
                ident = it.get("identificador")
                key = f"boe:{ident}"
                if key in known or not any(k in t for k in keywords):
                    continue
                if context and not any(c in t for c in context):
                    continue
                known.add(key)
                news.append({"id": key, "date": d.isoformat(), "source": "BOE", "title": title.strip(), "url": link_of(it)})
        d += timedelta(days=1)
    return news


# ---------------------------------------------------------------- páginas del INAP
class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self._href, self._text = [], None, []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href:
            self.links.append((self._href, re.sub(r"\s+", " ", "".join(self._text)).strip()))
            self._href = None


def check_pages(pages: list, filters: list, known: set, today: date, first_run: bool) -> tuple[list, list]:
    news, docs = [], []
    for p in pages:
        raw = fetch(p["url"])
        if not raw:
            continue
        parser = LinkParser()
        parser.feed(raw.decode("utf-8", "replace"))
        page_docs = []
        for href, text in parser.links:
            url = urljoin(p["url"], href)
            if urlparse(url).scheme not in ("http", "https") or not any(f in url.lower() for f in filters):
                continue
            label = text or os.path.basename(urlparse(url).path) or url
            page_docs.append({"label": label[:160], "url": url})
            key = "doc:" + hashlib.sha1(url.encode()).hexdigest()[:16]
            if key in known:
                continue
            known.add(key)
            if not first_run:  # en la primera ejecución solo se toma nota de lo que ya existe
                news.append({"id": key, "date": today.isoformat(), "source": p["name"], "title": f"Nuevo documento: {label[:140]}", "url": url})
        # sin duplicados y en el orden de la página
        seen, uniq = set(), []
        for d in page_docs:
            if d["url"] not in seen:
                seen.add(d["url"]); uniq.append(d)
        docs.append({"year": p.get("year"), "name": p["name"], "page": p["url"], "docs": uniq[:60]})
    return news, docs


# ---------------------------------------------------------------- principal
def main() -> int:
    dry = "--dry-run" in sys.argv
    today = date.fromisoformat(os.environ["TODAY"]) if os.environ.get("TODAY") else datetime.now(timezone.utc).date()
    cfg = json.load(open(SOURCES, encoding="utf-8"))
    live = json.load(open(LIVE, encoding="utf-8")) if os.path.exists(LIVE) else {}
    known = set(live.get("known", []))
    first_run = not known
    last_day = date.fromisoformat(live["last_boe_day"]) if live.get("last_boe_day") else today - timedelta(days=1)

    print(f"Comprobando novedades a {today} ({'primera ejecución' if first_run else f'{len(known)} elementos conocidos'})")
    boe_news = check_boe(cfg.get("boe", {}), last_day, today, known)
    page_news, library = check_pages(cfg.get("pages", []), cfg.get("page_link_filter", [".pdf"]), known, today, first_run)
    new = boe_news + page_news
    print(f"  BOE: {len(boe_news)} novedades · páginas: {len(page_news)} novedades")

    out = {
        "checked": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "last_boe_day": today.isoformat(),
        "news": (new + live.get("news", []))[:MAX_NEWS],
        "library": library or live.get("library", []),
        "known": sorted(known),
    }
    if not dry:
        json.dump(out, open(LIVE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    if new:
        lines = [f"# Novedades de la oposición ({today:%d/%m/%Y})", ""]
        for n in new:
            lines.append(f"- **{n['source']}** ({n['date']}): [{n['title']}]({n['url']})")
        lines += ["", "La app se ha actualizado con estas novedades. Si la tienes instalada, se actualizará sola al abrirla."]
        if not dry:
            open(REPORT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
        print("\n".join(lines))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"has_news={'true' if new else 'false'}\n")
            f.write(f"count={len(new)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
