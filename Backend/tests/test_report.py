from app import report
from app.report import _Font, font_safe, render_pdf

HELVETICA = _Font("Helvetica", "Helvetica-Bold", None)


def test_font_safe_substitutes_missing_glyphs(monkeypatch):
    monkeypatch.setattr(report, "_font", lambda: HELVETICA)
    assert font_safe("O₂ ≥ 3 % · ₹0.91 ≈ cost") == "O2 >= 3 % · Rs 0.91 ~ cost"
    assert font_safe("µm °C ²") == "µm °C ²"  # WinAnsi covers these.
    assert font_safe(None) == ""


def test_clean_escapes_markup():
    assert report.clean("a < b & c") == "a &lt; b &amp; c"


def test_render_with_builtin_font_and_sparse_result(monkeypatch):
    monkeypatch.setattr(report, "_font", lambda: HELVETICA)
    pdf = render_pdf("an_test", {"commodity": {"commodityName": "Rice"}}, {"recommendation": {"structure": "PET / PE"}})
    assert pdf.startswith(b"%PDF")


def test_render_empty_result():
    assert render_pdf("an_empty", {}, {}).startswith(b"%PDF")


def test_constraints_are_described_in_words():
    from app.engine.gatekeeper import describe
    assert describe("max_cost_band:low") == "Low cost band at most"
    assert describe("exclude_material:AL_FOIL", {"AL_FOIL": "Aluminium foil"}) == "No Aluminium foil"
    assert describe("max_gauge_um:80") == "At most 80 µm thick"
