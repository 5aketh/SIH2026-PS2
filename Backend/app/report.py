"""Pipeline stage 9 (export): renders a stored analysis as a PDF (frontend build spec §6.7 / §7.3).

Works from the stored request and result only, so a report always matches what the
user saw on screen, even after the knowledge base or engine changes.
"""
import io
import unicodedata
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from xml.sax.saxutils import escape

import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .engine.gatekeeper import describe

# Regular/bold pairs, best glyph coverage first. ReportLab's bundled Vera is always present.
_VERA = Path(reportlab.__file__).resolve().parent / "fonts"
FONT_CANDIDATES = [
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/TTF/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"),
    ("C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf"),
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    (str(_VERA / "Vera.ttf"), str(_VERA / "VeraBd.ttf")),
]

# Stand-ins for glyphs the chosen font lacks (NFKC already maps sub/superscript digits).
FALLBACK = {"₹": "Rs ", "≈": "~", "≥": ">=", "≤": "<=", "–": "-", "—": "-", "→": "->", "×": "x", "±": "+/-",
            "µ": "u", "·": ".", "°": " deg", "✓": "OK", "’": "'", "‘": "'", "“": '"', "”": '"', "…": "..."}

INK = colors.HexColor("#1f2a24")
MUTED = colors.HexColor("#5b675f")
RULE = colors.HexColor("#d5dbd6")
ACCENT = colors.HexColor("#2f6b4f")
TINT = colors.HexColor("#eef3ef")
STATUS_COLORS = {"PASS": colors.HexColor("#2f6b4f"), "REVIEW": colors.HexColor("#9a6700"), "FAIL": colors.HexColor("#b42318")}
LEVEL_COLORS = {"high": STATUS_COLORS["FAIL"], "medium": STATUS_COLORS["REVIEW"], "low": STATUS_COLORS["PASS"]}

PROFILE_LABELS = {
    "moisturePct": ("Moisture", "%"), "fatPct": ("Fat", "%"), "ph": ("pH", ""),
    "respirationClass": ("Respiration class", ""), "oxidationSensitivity": ("Oxidation sensitivity", ""),
}
CONDITION_LABELS = {
    "storageType": ("Storage", ""), "temperatureC": ("Temperature", "°C"), "relativeHumidityPct": ("Relative humidity", "%"),
    "targetShelfLifeDays": ("Target shelf life", "days"), "transportMode": ("Transport", ""), "transportStress": ("Transport stress", ""),
}
PRIORITY_LABELS = {"shelfLife": "Shelf life", "cost": "Cost", "sustainability": "Sustainability", "mechanicalStrength": "Mechanical strength"}

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm
CONTENT_W = PAGE_W - 2 * MARGIN


class _Font:
    def __init__(self, regular: str, bold: str, cmap: set[int] | None):
        self.regular, self.bold, self._cmap = regular, bold, cmap

    def covers(self, ch: str) -> bool:
        if self._cmap is None:  # Built-in Type 1 font: WinAnsi only.
            try:
                ch.encode("cp1252")
                return True
            except UnicodeEncodeError:
                return False
        return ord(ch) in self._cmap


@lru_cache
def _font() -> _Font:
    for regular, bold in FONT_CANDIDATES:
        if Path(regular).exists() and Path(bold).exists():
            try:
                pdfmetrics.registerFont(TTFont("PW-Regular", regular))
                pdfmetrics.registerFont(TTFont("PW-Bold", bold))
            except Exception:  # noqa: BLE001  (unreadable or unsupported font file: try the next one)
                continue
            face = pdfmetrics.getFont("PW-Regular").face
            return _Font("PW-Regular", "PW-Bold", set(face.charToGlyph))
    return _Font("Helvetica", "Helvetica-Bold", None)


def font_safe(value) -> str:
    """Text the chosen font can draw: missing glyphs become their NFKC form or a plain stand-in."""
    font = _font()
    out = []
    for ch in "" if value is None else str(value):
        if ch.isascii() or font.covers(ch):
            out.append(ch)
            continue
        alt = unicodedata.normalize("NFKC", ch)
        if alt != ch and all(c.isascii() or font.covers(c) for c in alt):
            out.append(alt)
        else:
            out.append(FALLBACK.get(ch, "?"))
    return "".join(out)


def clean(value) -> str:
    """font_safe text, XML-escaped for Paragraph markup."""
    return escape(font_safe(value))


def _styles() -> dict[str, ParagraphStyle]:
    f = _font()
    base = ParagraphStyle("base", fontName=f.regular, fontSize=9, leading=12.5, textColor=INK, alignment=TA_LEFT)
    return {
        "base": base,
        "small": ParagraphStyle("small", parent=base, fontSize=8, leading=10.5),
        "muted": ParagraphStyle("muted", parent=base, fontSize=8, leading=10.5, textColor=MUTED),
        "cell": ParagraphStyle("cell", parent=base, fontSize=8, leading=10.5),
        "cellBold": ParagraphStyle("cellBold", parent=base, fontName=f.bold, fontSize=8, leading=10.5),
        "head": ParagraphStyle("head", parent=base, fontName=f.bold, fontSize=8, leading=10.5, textColor=MUTED),
        "eyebrow": ParagraphStyle("eyebrow", parent=base, fontName=f.bold, fontSize=8, textColor=ACCENT),
        "title": ParagraphStyle("title", parent=base, fontName=f.bold, fontSize=20, leading=24, spaceAfter=2),
        "h2": ParagraphStyle("h2", parent=base, fontName=f.bold, fontSize=12, leading=15, spaceBefore=12, spaceAfter=5,
                             textColor=ACCENT),
        "big": ParagraphStyle("big", parent=base, fontName=f.bold, fontSize=13, leading=17),
        "bullet": ParagraphStyle("bullet", parent=base, leftIndent=10, bulletIndent=0, spaceAfter=2),
    }


def _num(v, unit: str = "") -> str:
    if v is None or v == "":
        return "Not provided"
    if isinstance(v, bool):
        return "Yes" if v else "No"
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    if isinstance(v, (list, tuple)) and len(v) == 2:
        v = f"{_num(v[0])}–{_num(v[1])}"
    elif isinstance(v, str):
        v = v.replace("_", " ")
    return f"{v} {unit}".strip() if unit else str(v)


def _sig(v) -> str:
    """Engineering figure to 3 significant digits: 5608.562 -> 5,610; 0.0423 -> 0.0423."""
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return _num(v)
    if v == 0:
        return "0"
    rounded = float(f"{v:.3g}")
    return f"{rounded:,.0f}" if abs(rounded) >= 100 else _num(rounded)


def _days(d) -> str:
    if d is None:
        return "–"
    return "10+ years" if d >= 3650 else _num(d, "days")


class Report:
    def __init__(self, analysis_id: str, request: dict, result: dict, created_at: datetime | None,
                 material_names: dict[str, str] | None = None):
        self.material_names = material_names or {}
        self.id = analysis_id
        self.req = request or {}
        self.res = result or {}
        self.created = created_at
        self.s = _styles()
        self.story: list = []

    # Building blocks

    def p(self, text, style: str = "base", raw: bool = False) -> Paragraph:
        return Paragraph(text if raw else clean(text), self.s[style])

    def h2(self, text: str) -> None:
        self.story.append(self.p(text, "h2"))

    def bullets(self, items) -> None:
        for item in items or []:
            self.story.append(Paragraph(clean(item), self.s["bullet"], bulletText="•"))

    def table(self, header: list[str] | None, rows: list[list], widths: list[float], zebra: bool = True) -> Table:
        data = []
        if header:
            data.append([self.p(h, "head") for h in header])
        for row in rows:
            data.append([self.cell(c) for c in row])
        t = Table(data, colWidths=[w * CONTENT_W for w in widths], repeatRows=1 if header else 0, hAlign="LEFT")
        style = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
        ]
        if header:
            style.append(("LINEBELOW", (0, 0), (-1, 0), 0.8, MUTED))
        if zebra:
            start = 1 if header else 0
            for i in range(start, len(data)):
                if (i - start) % 2 == 1:
                    style.append(("BACKGROUND", (0, i), (-1, i), TINT))
        t.setStyle(TableStyle(style))
        return t

    def cell(self, value):
        if isinstance(value, Paragraph):
            return value
        return self.p(value if isinstance(value, str) else _num(value), "cell")

    def kv(self, pairs: list[tuple[str, object]], widths=(0.32, 0.68)) -> Table:
        return self.table(None, [[self.p(k, "cellBold"), v] for k, v in pairs], list(widths), zebra=False)

    def status(self, value: str | None) -> Paragraph:
        value = (value or "").upper()
        color = STATUS_COLORS.get(value, MUTED).hexval()[2:]
        return self.p(f'<font color="#{color}"><b>{clean(value or "–")}</b></font>', "cell", raw=True)

    def level(self, value: str | None) -> Paragraph:
        color = LEVEL_COLORS.get((value or "").lower(), MUTED).hexval()[2:]
        return self.p(f'<font color="#{color}"><b>{clean((value or "–").capitalize())}</b></font>', "cell", raw=True)

    # Sections

    def header(self) -> None:
        inputs = self.res.get("inputsUsed") or {}
        commodity = self.req.get("commodity") or {}
        name = inputs.get("commodity") or commodity.get("commodityName") or "Custom commodity"
        when = (self.created or datetime.now()).strftime("%d %B %Y, %H:%M UTC" if self.created else "%d %B %Y")
        conf = (self.res.get("confidence") or {}).get("level") or (self.res.get("recommendation") or {}).get("confidence")
        meta = f"Analysis {self.id} · Generated {when} · Engine {self.res.get('engineVersion', '–')}"
        if conf:
            meta += f" · Confidence: {conf}"
        self.story += [self.p("PACKWISE PACKAGING REPORT", "eyebrow"), self.p(name, "title"), self.p(meta, "muted"), Spacer(1, 8)]

    def recommendation(self) -> None:
        rec = self.res.get("recommendation") or {}
        shelf = self.res.get("shelfLife") or {}
        cost = self.res.get("costAndImpact") or {}
        self.h2("Recommendation")
        block = [self.p(rec.get("structure") or "No structure met the constraints", "big")]
        if rec.get("profile"):
            block.append(self.p(rec["profile"] + (f" · score {rec['score']}" if rec.get("score") is not None else ""), "muted"))
        block.append(Spacer(1, 6))
        target = shelf.get("targetDays")
        shelf_text = f"{_days(shelf.get('estimateDays'))} (range {_num(shelf.get('lowDays'))}–{_days(shelf.get('highDays'))})"
        if target:
            shelf_text += f" vs {target}-day target"
        pairs = [("Estimated shelf life", shelf_text)]
        if shelf.get("failureMode"):
            pairs.append(("Limiting mechanism", shelf["failureMode"]))
        if cost:
            pairs += [
                ("Cost per pack", f"₹{_num(cost.get('inrPerPack'))} ({_num(cost.get('costBand'))} band)"),
                ("Material per pack", f"{_num(cost.get('gramsPerPack'), 'g')} · {_num(cost.get('gCo2ePerPack'), 'g CO₂e')}"),
                ("End of life", f"{'Mono-material' if cost.get('monoMaterial') else 'Multi-material'}, "
                                f"{'recyclable' if cost.get('recyclable') else 'not readily recyclable'} "
                                f"(index {_num(cost.get('recyclabilityIndex'))}); EPR category {_num(cost.get('eprCategory'))}"),
            ]
        block.append(self.kv(pairs))
        self.story.append(KeepTogether(block))

        warnings = self.res.get("warnings") or []
        if warnings:
            box = Table([[self.p("<b>Note:</b> " + clean(w), "cell", raw=True)] for w in warnings], colWidths=[CONTENT_W])
            box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff6e0")),
                ("LINEBEFORE", (0, 0), (0, -1), 2.5, STATUS_COLORS["REVIEW"]),
                ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            self.story += [Spacer(1, 6), box]

    def requirements(self) -> None:
        rows = self.res.get("requirements") or []
        if not rows:
            return
        self.h2("Packaging requirements")
        self.story.append(self.table(
            ["Requirement", "Value", "Status", "Provenance"],
            [[self.p(r.get("label"), "cellBold"), r.get("value"), self.status(r.get("status")), r.get("provenance")] for r in rows],
            [0.22, 0.48, 0.12, 0.18],
        ))

    def why(self) -> None:
        if self.res.get("why"):
            self.h2("Why this recommendation")
            self.bullets(self.res["why"])

    def specification(self) -> None:
        spec = self.res.get("specifications") or {}
        if not spec:
            return
        self.h2("Specification")
        layers = spec.get("layers") or []
        if layers:
            self.story.append(self.table(
                ["#", "Layer (outside → inside)", "Thickness", "Role"],
                [[str(i + 1), l.get("name") or l.get("materialId"), _num(l.get("thicknessUm"), "µm"), l.get("role") or l.get("function")]
                 for i, l in enumerate(layers)],
                [0.06, 0.38, 0.14, 0.42],
            ))
            self.story.append(Spacer(1, 6))
        pairs = [("Total gauge", _num(spec.get("totalGaugeUm"), "µm"))]
        for key, label in (("otr", "Oxygen transmission (OTR)"), ("wvtr", "Water vapour transmission (WVTR)")):
            b = spec.get(key)
            if b:
                text = f"{_sig(b.get('candidate'))} {b.get('unit', '')}"
                if b.get("targetMax") is not None:
                    text += f" (max {_sig(b['targetMax'])})"
                if b.get("atStorage") is not None:
                    text += f"; {_sig(b['atStorage'])} at storage conditions"
                pairs.append((label, f"{text} · tested at {b.get('testConditions', '–')}"))
        if spec.get("mechanicalIndex") is not None:
            pairs.append(("Mechanical index", f"{spec['mechanicalIndex']} / 100"))
        if spec.get("gelboPinholes") is not None:
            pairs.append(("Gelbo flex pinholes", _num(spec["gelboPinholes"])))
        perf = spec.get("perforation")
        if perf and perf.get("required"):
            pairs.append(("Perforation", f"{_num(perf.get('holesPerPack'))} × {_num(perf.get('diameterUm'), 'µm')} "
                                         f"({perf.get('type', '')}; {perf.get('standard', '')})"))
        flush = spec.get("mapFlush")
        if flush:
            gases = ", ".join(f"{g.upper().replace('2', '₂')} {flush[g]}" for g in ("o2", "co2", "n2") if flush.get(g))
            pairs.append(("MAP flush", flush.get("label", "") + (f" ({gases})" if gases else "")))
        seal = spec.get("sealStrength")
        if seal:
            pairs.append(("Seal strength", seal.get("target")))
        comp = spec.get("compliance") or {}
        if comp:
            pairs += [
                ("Food-contact standards", ", ".join(comp.get("foodContactStandards") or []) or "–"),
                ("Migration simulant", comp.get("migrationSimulant")),
                ("Overall migration limit", comp.get("overallMigrationLimit")),
            ]
        self.story.append(self.kv(pairs))

    def fresh_produce(self) -> None:
        fp = self.res.get("freshProduce")
        if not (self.res.get("freshProduceMode") and fp):
            return
        self.h2("Fresh produce: gas exchange")
        rate = fp.get("respirationRate") or {}
        pairs = [
            ("Gas exchange", fp.get("gasExchangeRequirement")),
            ("MAP suitable", _num(bool(fp.get("mapSuitable")))),
        ]
        if rate:
            pairs.append(("Respiration rate", f"{_num(rate.get('mlO2PerKgH'))} mL O₂/kg·h at {_num(rate.get('temperatureC'), '°C')} "
                                              f"({rate.get('provenance', '–')})"))
        eq = fp.get("equilibrium")
        if eq:
            pairs.append(("Equilibrium atmosphere", f"O₂ {_num(eq.get('o2Pct'), '%')}, CO₂ {_num(eq.get('co2Pct'), '%')}; "
                                                    f"worst case O₂ {_num(eq.get('o2PctWorstCase'), '%')} at "
                                                    f"{_num(eq.get('worstCaseTempC'), '°C')}"))
        tpl = fp.get("configTemplate") or {}
        pairs.append(("Target O₂", tpl.get("o2Target") or "Not available for this scenario"))
        pairs.append(("Target CO₂", tpl.get("co2Target") or "Not available for this scenario"))
        self.story.append(self.kv(pairs))
        if tpl.get("note"):
            self.story += [Spacer(1, 3), self.p(tpl["note"], "muted")]

    def risks(self) -> None:
        risks = self.res.get("risks") or []
        if not risks:
            return
        self.h2("Spoilage and damage risks")
        self.story.append(self.table(
            ["Risk", "Level", "Drivers"],
            [[self.p(r.get("title"), "cellBold"), self.level(r.get("level")), "; ".join(r.get("drivers") or [])] for r in risks],
            [0.36, 0.12, 0.52],
        ))

    def alternatives(self) -> None:
        self.h2("Alternatives")
        alts = self.res.get("alternatives") or []
        if not alts:
            self.story.append(self.p("No alternative candidates met the constraints.", "muted"))
            return
        rec = self.res.get("recommendation") or {}
        options = [{"structure": rec.get("structure"), "profile": "Recommended", "shelfLife": self.res.get("shelfLife") or {},
                    "costAndImpact": self.res.get("costAndImpact") or {}}] + alts
        rows = []
        for o in options:
            shelf, cost = o.get("shelfLife") or {}, o.get("costAndImpact") or {}
            rows.append([
                self.p(o.get("structure"), "cellBold"), o.get("profile") or "–", _days(shelf.get("estimateDays")),
                f"₹{_num(cost.get('inrPerPack'))}", _num(cost.get("gCo2ePerPack")), _num(cost.get("recyclabilityIndex")),
            ])
        self.story.append(self.table(["Structure", "Profile", "Shelf life", "Cost/pack", "g CO₂e", "Recyclability"],
                                     rows, [0.35, 0.19, 0.12, 0.11, 0.1, 0.13]))
        self.story.append(Spacer(1, 4))
        for a in alts:
            if a.get("tradeoffSummary"):
                self.story.append(Paragraph(f"<b>{clean(a.get('structure'))}:</b> {clean(a['tradeoffSummary'])}",
                                            self.s["bullet"], bulletText="•"))

    def inputs(self) -> None:
        inputs = self.res.get("inputsUsed") or {}
        if not inputs:
            return
        self.h2("Inputs used")
        rows = []
        for key, (label, unit) in PROFILE_LABELS.items():
            w = (inputs.get("profile") or {}).get(key) or {}
            if w.get("value") is not None:
                rows.append([label, _num(w["value"], unit), w.get("provenance") or "–", w.get("confidence") or "–"])
        if inputs.get("category"):
            rows.insert(0, ["Category", _num(inputs["category"]), "–", "–"])
        cond = inputs.get("conditions") or {}
        for key, (label, unit) in CONDITION_LABELS.items():
            if cond.get(key) is not None:
                rows.append([label, _num(cond[key], unit), "user input", "–"])
        pack = inputs.get("pack") or {}
        if pack:
            rows.append(["Pack", f"{pack.get('format') or 'Pack'}: {_num(pack.get('netWeightG'), 'g')}, "
                                 f"{_num(pack.get('areaM2'), 'm²')} film", pack.get("provenance") or "–", "–"])
        self.story.append(self.table(["Input", "Value", "Provenance", "Confidence"], rows, [0.26, 0.38, 0.2, 0.16]))
        prio = inputs.get("priorities") or {}
        if prio:
            text = ", ".join(f"{PRIORITY_LABELS.get(k, k)} {round(v * 100)}%" for k, v in prio.items() if isinstance(v, (int, float)))
            hard = [describe(c, self.material_names) for c in inputs.get("hardConstraints") or []]
            self.story += [Spacer(1, 4), self.p(f"<b>Priorities:</b> {clean(text)}" +
                                                (f" · <b>Hard constraints:</b> {clean(', '.join(hard))}" if hard else ""),
                                                "small", raw=True)]

    def rejected(self) -> None:
        rejected = self.res.get("rejected") or []
        if not rejected:
            return
        self.h2(f"Candidates ruled out ({len(rejected)})")
        self.story.append(self.table(
            ["Structure", "Stage", "Reason"],
            [[r.get("structure"), _num((r.get("stage") or "").replace("-", " ").capitalize()), " ".join(r.get("reasons") or [])]
             for r in rejected],
            [0.33, 0.16, 0.51],
        ))

    def assumptions(self) -> None:
        conf = self.res.get("confidence") or {}
        items = (conf.get("reasons") or []) + (self.res.get("assumptions") or [])
        if items:
            self.h2("Confidence and assumptions")
            self.bullets(items)

    def build(self) -> bytes:
        self.header()
        self.recommendation()
        self.requirements()
        self.why()
        self.specification()
        self.fresh_produce()
        self.risks()
        self.alternatives()
        self.inputs()
        self.assumptions()
        self.rejected()

        buf = io.BytesIO()
        font = _font()
        footer = font_safe(f"PackWise · Analysis {self.id} · Prototype decision support: validate with laboratory testing before use.")

        def on_page(canvas, doc):
            canvas.saveState()
            canvas.setStrokeColor(RULE)
            canvas.line(MARGIN, 12 * mm, PAGE_W - MARGIN, 12 * mm)
            canvas.setFillColor(MUTED)
            canvas.setFont(font.regular, 7)
            canvas.drawString(MARGIN, 8 * mm, footer)
            canvas.drawRightString(PAGE_W - MARGIN, 8 * mm, f"Page {doc.page}")
            canvas.restoreState()

        doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=16 * mm, bottomMargin=18 * mm,
                                title=f"PackWise report {self.id}", author="PackWise", subject="Packaging recommendation")
        doc.build(self.story, onFirstPage=on_page, onLaterPages=on_page)
        return buf.getvalue()


def render_pdf(analysis_id: str, request: dict, result: dict, created_at: datetime | None = None,
               material_names: dict[str, str] | None = None) -> bytes:
    return Report(analysis_id, request, result, created_at, material_names).build()
