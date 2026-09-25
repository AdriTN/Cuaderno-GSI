# -*- coding: utf-8 -*-
"""
Genera data/content.json a partir del repositorio de temario de Preparación GSI.

Uso:
    git clone --depth 1 -b gsi-only-final https://github.com/AngeldelaCalleFernandez/Preparacion-GSI.git ../Preparacion-GSI
    python3 scripts/prepare_content.py ../Preparacion-GSI

Qué hace: extrae los 57 temas (con los diagramas SVG incrustados), las preguntas validadas,
los supuestos, los cuadernos prácticos, tarjetas automáticas a partir de definiciones y
"claves de test", y el "enfoque para supuesto" de cada tema. Todo queda en un JSON compacto.
"""
import json, re, base64, os, sys

R = sys.argv[1] if len(sys.argv) > 1 else "../Preparacion-GSI"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "content.json")
J = lambda p: json.load(open(os.path.join(R, p), encoding="utf-8"))

syl = J("data/syllabus.json")
blocks, topics = [], []
for b in syl["blocks"]:
    blocks.append({"id": b["id"], "n": b["number"], "title": b["title"]})
    for t in b["topics"]:
        topics.append({"id": t["id"], "b": b["id"], "n": t["number"], "title": t["title"]})

svg_cache = {}
def inline_svg(m):
    src = m.group(1)
    p = os.path.join(R, src)
    if not os.path.exists(p):
        return 'src=""'
    if src not in svg_cache:
        svg_cache[src] = "data:image/svg+xml;base64," + base64.b64encode(open(p, "rb").read()).decode()
    return 'src="' + svg_cache[src] + '"'

def clean_topic(html):
    html = re.sub(r'src="(assets/[^"]+)"', inline_svg, html)
    html = re.sub(r'href="#temario/[^/]+/([^"]+)"', r'href="#" data-jump="\1"', html)
    html = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', html)
    html = re.sub(r'<script.*?</script>', '', html, flags=re.S)
    html = re.sub(r'\son\w+="[^"]*"', '', html)
    return html

content = {}
for t in topics:
    content[t["id"]] = clean_topic(open(os.path.join(R, "content/generated", t["id"] + ".html"), encoding="utf-8").read())

def provenance(q):
    """Procedencia legible y corta: documento de origen y localización."""
    src = q.get("source") or {}
    title = src.get("title") or ""
    m = re.search(r"PRÁCTICA ACTIVA (\d+)", title)
    doc = f"Práctica activa {int(m.group(1))}" if m else ("Apuntes V2.1" if "APUNTES" in title.upper() else title[:60])
    loc = (src.get("question_locator") or src.get("locator") or "").split(";")[0].strip()
    sub = q.get("subtopic") or ""
    return ", ".join(x for x in [doc, loc, sub if sub and sub not in loc else ""] if x)[:140]

qs = []
def add(src, origin):
    for q in J(src)["questions"]:
        if q.get("validation_status") != "validated" or len(q["options"]) != 4:
            continue
        opts = [o["text"] for o in q["options"]]
        ids = [o["id"] for o in q["options"]]
        c = ids.index(q["correct_option"])
        item = {"i": q["id"], "t": q["topic_id"], "o": origin, "s": q["statement"], "a": opts, "c": c}
        if origin == "O":
            ex = q["exam"]
            item["e"] = str(ex["year"]); item["n"] = ex["paper_order"]; item["r"] = 1 if ex["is_reserve"] else 0
            item["f"] = f"Clave oficial del INAP (convocatoria {ex['year']}, plantilla {'definitiva' if ex.get('key_status')=='definitive' else ex.get('key_status','')}): opción {q['correct_option']}. El INAP no publica explicación; repasa el tema."
        else:
            item["f"] = (q.get("feedback") or {}).get("correct", "")
            item["p"] = provenance(q)
        qs.append(item)
add("data/questions-official.json", "O")
add("data/questions-manual.json", "M")
add("data/questions-ai.json", "I")

pr = J("data/gsi-practice.json")
cases = []
for c in pr["cases"]:
    cases.append({"id": c["id"], "sim": c["simulation"], "opt": c["option"], "title": c["title"],
                  "st": c["statement"], "q": [x["prompt"] for x in c["questions"]],
                  "check": c.get("checklist", []), "rub": c.get("rubric"), "sol": c.get("solutionHtml", "")})

def clean_practice(html):
    m = re.search(r"<main[^>]*>(.*)</main>", html, flags=re.S)
    body = m.group(1) if m else html
    body = re.sub(r'<p><a href="\.\./\.\./index\.html[^"]*">[^<]*</a></p>', '', body)
    body = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', body)
    body = re.sub(r'<script.*?</script>', '', body, flags=re.S)
    body = re.sub(r'\son\w+="[^"]*"', '', body)
    return body
PN = {"P01":"Redes","P02":"Bases de datos","P03":"Gestión de proyectos","P04":"Operación de sistemas","P05":"Seguridad","P06":"Algoritmos y TAD","P07":"Programación y paradigmas","P08":"Contact center","P09":"Calidad del software","P10":"Datos, big data y NoSQL","P11":"Supuestos integradores de desarrollo","P12":"Supuestos integradores de infraestructura, redes, seguridad y operación","P13":"Simulacros completos mixtos","P14":"Test del Bloque I","P15":".NET y Jakarta EE","P16":"Licencias, protección jurídica y DRM","P17":"Computadores, cloud y sistemas operativos","P18":"HTML, XML, contenidos, búsqueda y SEO","P19":"NGN, IMS, movilidad, UEM y videoconferencia"}
packs = {}
for l in pr["library"]:
    lp = l.get("localPath")
    if not lp:
        continue
    pid, kind = l["id"].split("-", 1)
    name = re.sub(r"^GSI A2 — PRÁCTICA ACTIVA \d+ — ", "", l["title"])
    name = re.sub(r" — (CUADERNO.*|SOLUCIONARIO.*)$", "", name)
    packs.setdefault(pid, {"id": pid, "name": PN.get(pid, name)})
    packs[pid][kind] = clean_practice(open(os.path.join(R, lp), encoding="utf-8").read())

import html as HH
def txt(x): return HH.unescape(re.sub(r'<[^>]+>', '', x)).strip()
cards = []
for t in topics:
    h = open(os.path.join(R, "content/generated", t["id"] + ".html"), encoding="utf-8").read()
    study = h.split('<h2 id="repaso"')[0]
    head = ""; n = 0
    for m in re.finditer(r'<h[23][^>]*>(.*?)</h[23]>|<li>(.*?)</li>', study, re.S):
        if m.group(1) is not None:
            head = re.sub(r'^\d+(\.\d+)*\.?\s*', '', txt(m.group(1))); continue
        mm = re.match(r'\s*<strong>(.*?)</strong>\s*(.*)$', m.group(2), re.S)
        if not mm: continue
        f = txt(mm.group(1)); b = txt(mm.group(2))
        if f.endswith(':'): f = f[:-1].strip()
        elif b[:1] in ':—-–.': b = b[1:].strip()
        else: continue
        if 2 <= len(f) <= 140 and 8 <= len(b) <= 450:
            n += 1; cards.append({"i": f"C-{t['id']}-{n}", "t": t["id"], "c": head[:80], "f": f, "b": b})
    m = re.search(r'<h3 id="repaso-02">Claves de test</h3>(.*?)<h[23]', h, re.S)
    if m:
        for sent in re.split(r'(?<=[.;])\s+', txt(m.group(1))):
            sent = sent.strip().rstrip(';.')
            num = re.search(r'\b\d+(?:[.,]\d+)?(?:\s?(?:%|días|meses|años|horas|minutos|segundos|bits|bytes|MB|GB|KB|ms))?', sent)
            if len(sent) > 25 and num and num.start() > 3:
                n += 1; cards.append({"i": f"C-{t['id']}-{n}", "t": t["id"], "c": "Claves de test", "f": sent[:num.start()] + "[ … ]" + sent[num.end():], "b": sent, "z": 1})
    sm = re.search(r'<h3 id="repaso-03">Enfoque para supuesto práctico</h3>\s*<p>(.*?)</p>', h, re.S)
    t["sup"] = txt(sm.group(1))[:900] if sm else ""
OFFICIAL_WRITTEN = {"2022": "EJ2_GSI-L.md", "2024": "Supuesto_practico_GSI__L_vimprenta_IHRYG1MXBD_154AB89SD658.md", "2025": "Cuestionario-GSI-L 2ej.md"}
CRITERIA = {"2022": "GSI+LI+2023.md", "2024": "GSI+LI+2024.md", "2025": "GSI LI 2025.md"}
MD = os.path.join(R, "documents/markdown/gsi-official")
def read_md(year, name): return open(os.path.join(MD, year, name), "rb").read().decode("utf-8", "replace").replace("\x0c", "\n")
def tidy(t):
    """Normaliza texto extraído de PDF: un salto solo es párrafo si la línea anterior cierra frase."""
    t = "\n".join(re.sub(r"[ \t]+", " ", l).strip() for l in t.split("\n"))
    t = re.sub(r"(?<=[.:;?!»)])\s*\n+\s*", "\u2029", t)
    t = re.sub(r"\s*\n+\s*", " ", t)
    return t.replace("\u2029", "\n\n").strip()
official_cases = []
for year, fname in OFFICIAL_WRITTEN.items():
    text = read_md(year, fname)
    parts = re.split(r"Supuesto práctico (\d)", text)
    criteria = tidy(read_md(year, CRITERIA[year]))
    criteria = criteria[criteria.find("De acuerdo"):] if "De acuerdo" in criteria else criteria
    criteria = re.sub(r" (\d{1,2})\. (?=[A-ZÁÉÍÓÚ])", r"\n\n\1. ", criteria)
    for k in range(1, len(parts), 2):
        num, body = parts[k], parts[k + 1]
        m = re.search(r"\n\s*1\.\s", body)
        statement, rest = body[:m.start()], body[m.start():]
        qs_ = [tidy(x) for x in re.split(r"\n\s*\d\.\s+", "\n" + rest.strip())[1:]]
        official_cases.append({"id": f"INAP-{year}-{num}", "year": year, "n": int(num), "title": f"Supuesto oficial {year}, opción {num}",
                               "st": tidy(statement), "q": qs_[:5], "criteria": criteria[:7000]})
exams_meta = J("data/gsi-official-exams.json")["exams"]
KIND = {"questionnaire": "Cuestionario del primer ejercicio", "answer_key": "Plantilla de respuestas", "written": "Supuestos del segundo ejercicio", "criteria": "Criterios de corrección"}
library = [{"year": e["year"], "status": e.get("key_status", ""), "page": e.get("page_url", ""),
            "docs": [{"label": KIND.get(d["kind"], d["kind"]), "url": d["url"]} for d in e.get("documents", [])]} for e in exams_meta]
# Plantilla provisional 2025 (INAP, mayo 2026), extraída del PDF convertido.
# En las 8 primeras filas del PDF la letra aparece antes del número; a partir de la 9 va detrás.
key_md = read_md("2025", "Plantilla respuestas GSI-L.md")
main_md, reserve_md = key_md.split("Preguntas de reserva")
same_line = {int(n): l for n, l in re.findall(r"(?m)^(\d{1,3})\.[ \t]+([a-d])[ \t]*$", main_md)}
head = re.findall(r"(?m)^([a-d])\s*$", main_md.split("Ingreso Libre")[1])[:9]
KEY_2025 = "".join(head) + "".join(same_line[n] for n in range(10, 101))
RESERVE_2025 = "".join(re.findall(r"(?m)^([a-d])\s*$", reserve_md))[:5]
assert len(KEY_2025) == 100 and len(RESERVE_2025) == 5, (len(KEY_2025), RESERVE_2025)
upd = J("data/updates.json")["updates"]
updates = [{"topics": u["topic_ids"], "title": u["title"], "summary": u["summary"], "date": u["effective_date"]} for u in upd]

data = {"blocks": blocks, "topics": topics, "content": content, "questions": qs, "cases": cases, "officialCases": official_cases, "library": library, "key2025": {"main": KEY_2025, "reserve": RESERVE_2025, "status": "provisional"}, "cards": cards,
        "packs": sorted(packs.values(), key=lambda p: p["id"]), "updates": updates,
        "source": {"program": "Anexo IX, BOE-A-2025-26262 (convocatoria 22-12-2025)", "repo_date": "2026-09-23"}}
s = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
open(OUT, "w", encoding="utf-8").write(s)
from collections import Counter
print("official cases", len(official_cases), [len(c["q"]) for c in official_cases]); print("cards", len(cards), sum(1 for c in cards if c.get("z")), "sup", sum(1 for t in topics if t["sup"]));print("bytes", len(s.encode()), "questions", len(qs), Counter(q["o"] for q in qs), "cases", len(cases), "packs", len(packs), "svgs", len(svg_cache))
