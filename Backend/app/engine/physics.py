"""Closed-form mass-transfer maths (Blueprint: 'Biophysical and Mass-Transfer Mathematical Foundations').

Units: temperatures in °C at the boundary, Kelvin inside; OTR in cc(mL)/m²·day·atm;
water-vapour permeance k in g/m²·day·kPa; film areas in m²; product mass in g.

Simplifications are deliberate and named in the analysis `assumptions`:
- steady state instead of the transient headspace ODEs,
- respiration independent of O₂ above the anaerobic compensation point (conservative),
- a linearised sorption isotherm between (aw0, M0) and (awc, Mcrit) in place of a fitted GAB curve
  (Labuza moisture-gain model).
"""
from __future__ import annotations

import math

from .types import LayerSpec, MaterialSpec, StructureSpec

R = 8.314  # J/mol·K
O2_AIR = 0.209
MW_WATER = 18.015
O2_DENSITY_MG_PER_ML = 1.429

# Gas diffusivities in air at 20 °C (cm²/s); scale with T^1.75.
D_AIR_CM2_S = {"o2": 0.20, "co2": 0.16, "h2o": 0.25}
DEFAULT_PERMSELECTIVITY = 4.0  # CO₂/O₂ for polyolefin films (Blueprint: continuous films bounded ~3-6)

# Reference activation energies (kJ/mol) used only to quote targets at standard test conditions.
EA_REF_O2 = 35.0
EA_REF_H2O = 40.0
OTR_TEST_C = 23.0
WVTR_TEST_C, WVTR_TEST_RH = 38.0, 0.90


def kelvin(t_c: float) -> float:
    return t_c + 273.15


def p_sat_kpa(t_c: float) -> float:
    """Saturated water-vapour pressure: Antoine above 0 °C, Magnus over ice below."""
    if t_c >= 0:
        mmhg = 10 ** (8.07131 - 1730.63 / (233.426 + t_c))
        return mmhg * 0.133322
    return 0.61115 * math.exp(22.452 * t_c / (272.55 + t_c))


WVTR_TEST_DP_KPA = p_sat_kpa(WVTR_TEST_C) * WVTR_TEST_RH


def arrhenius(ea_kj: float, t_c: float, t_ref_c: float) -> float:
    """P(T)/P(T_ref) = exp(-Ea/R · (1/T − 1/T_ref))."""
    if not ea_kj:
        return 1.0
    return math.exp(-ea_kj * 1000 / R * (1 / kelvin(t_c) - 1 / kelvin(t_ref_c)))


def _thickness_scale(m: MaterialSpec, thickness_um: float) -> float:
    # Homogeneous films: transmission ∝ 1/L. Coatings, metallisation and EVOH cores don't scale with gauge.
    if m.fixed_barrier or thickness_um <= 0:
        return 1.0
    return m.ref_thickness_um / thickness_um


def humidity_factor(m: MaterialSpec, rh: float) -> float:
    """Plasticisation of hydrophilic barriers (EVOH, PA): O₂ permeability rises exponentially above ~50 %RH."""
    if not m.prop("humiditySensitive"):
        return 1.0
    rh_eff = rh * 0.75 if m.prop("protectedCore") else rh
    return math.exp(4.0 * max(0.0, rh_eff - 0.5))


def layer_otr(layer: LayerSpec, t_c: float, rh: float) -> float:
    m = layer.material
    return (
        m.otr_ref * _thickness_scale(m, layer.thickness_um)
        * arrhenius(m.prop("eaO2", 35), t_c, OTR_TEST_C)
        * humidity_factor(m, rh)
    )


def layer_water_permeance(layer: LayerSpec, t_c: float) -> float:
    m = layer.material
    k_ref = m.wvtr_ref * _thickness_scale(m, layer.thickness_um) / WVTR_TEST_DP_KPA
    return k_ref * arrhenius(m.prop("eaH2O", 40), t_c, WVTR_TEST_C)


def series(values: list[float]) -> float:
    """Series-resistance laminate model: 1/TR_total = Σ 1/TR_i."""
    return 1.0 / sum(1.0 / max(v, 1e-9) for v in values)


def structure_otr(s: StructureSpec, t_c: float, rh: float) -> float:
    return series([layer_otr(l, t_c, rh) for l in s.layers])


def structure_water_permeance(s: StructureSpec, t_c: float) -> float:
    return series([layer_water_permeance(l, t_c) for l in s.layers])


def structure_otr_test(s: StructureSpec) -> float:
    """Composite OTR at 23 °C, 0 %RH (ASTM D3985 conditions)."""
    return structure_otr(s, OTR_TEST_C, 0.0)


def structure_wvtr_test(s: StructureSpec) -> float:
    """Composite WVTR at 38 °C, 90 %RH (ASTM F1249 conditions)."""
    return structure_water_permeance(s, WVTR_TEST_C) * WVTR_TEST_DP_KPA


def otr_at_test(otr_at_t: float, t_c: float) -> float:
    """Quote a storage-temperature OTR at 23 °C using a reference activation energy."""
    return otr_at_t * arrhenius(EA_REF_O2, OTR_TEST_C, t_c)


def wvtr_at_test(k_at_t: float, t_c: float) -> float:
    """Quote a storage-temperature permeance as WVTR at 38 °C/90 %RH using a reference activation energy."""
    return k_at_t * arrhenius(EA_REF_H2O, WVTR_TEST_C, t_c) * WVTR_TEST_DP_KPA


# ---------- Fresh produce: respiration, EMAP and micro-perforation ----------

def respiration_rate(r20: float, q10: float, t_c: float) -> float:
    """O₂ uptake (mL/kg·h) via a Q10 temperature law from the 20 °C reference rate."""
    return r20 * q10 ** ((t_c - 20.0) / 10.0)


def o2_demand_ml_day(r20: float, q10: float, t_c: float, mass_g: float) -> float:
    return respiration_rate(r20, q10, t_c) * mass_g / 1000.0 * 24.0


def hole_conductance(d_um: float, film_um: float, t_c: float, gas: str = "o2") -> float:
    """mL/day per unit volume-fraction difference through one perforation.

    Fick's first law through a pore with end correction (Paul & Clarke 2002): L_eff = L + d/2.
    """
    d = d_um * 1e-6
    l_eff = film_um * 1e-6 + d / 2
    diff = D_AIR_CM2_S[gas] * 1e-4 * 86400 * (kelvin(t_c) / 293.15) ** 1.75  # m²/day
    return math.pi * d * d / 4 * diff / l_eff * 1e6


def equilibrium_o2(demand: float, g_total: float) -> float:
    """Steady-state headspace O₂ fraction: supply G·(0.209 − y) equals respiratory demand."""
    if g_total <= 0:
        return 0.0
    return max(0.0, O2_AIR - demand / g_total)


def equilibrium_co2(demand: float, rq: float, g_film_o2: float, beta: float, n_holes: int, g_hole_co2: float) -> float:
    g_co2 = g_film_o2 * beta + n_holes * g_hole_co2
    return rq * demand / g_co2 if g_co2 > 0 else 1.0


def holes_needed(demand: float, y_target: float, g_film: float, g_hole: float) -> float:
    if y_target >= O2_AIR:
        return float("inf")
    return max(0.0, (demand / (O2_AIR - y_target) - g_film) / g_hole)


def hole_water_loss_g_day(d_um: float, film_um: float, t_c: float, aw_in: float, rh_out: float) -> float:
    """Water lost through one perforation (g/day): diffusion on the vapour-concentration gradient."""
    d = d_um * 1e-6
    l_eff = film_um * 1e-6 + d / 2
    diff = D_AIR_CM2_S["h2o"] * 1e-4 * 86400 * (kelvin(t_c) / 293.15) ** 1.75
    dc = p_sat_kpa(t_c) * 1000 * max(0.0, aw_in - rh_out) / (R * kelvin(t_c)) * MW_WATER  # g/m³
    return math.pi * d * d / 4 * diff / l_eff * dc


# ---------- Moisture: gain (dry foods) and loss (wet foods) ----------

def _dry_basis(m_pct: float) -> float:
    return m_pct / (100.0 - m_pct)


def moisture_gain_days(mass_g, m0_pct, mc_pct, aw0, awc, rh, k, area, t_c) -> float:
    """Labuza linear-isotherm moisture gain: t = W_d·b / (k·A·p*) · ln((RH−aw0)/(RH−awc))."""
    if rh <= awc or awc <= aw0 or mc_pct <= m0_pct:
        return math.inf
    w_dry = mass_g * (1 - m0_pct / 100.0)
    b = (_dry_basis(mc_pct) - _dry_basis(m0_pct)) / (awc - aw0)
    return w_dry * b / (k * area * p_sat_kpa(t_c)) * math.log((rh - aw0) / (rh - awc))


def required_k_gain(mass_g, m0_pct, mc_pct, aw0, awc, rh, area, t_c, days) -> float:
    if rh <= awc or awc <= aw0 or mc_pct <= m0_pct:
        return math.inf
    w_dry = mass_g * (1 - m0_pct / 100.0)
    b = (_dry_basis(mc_pct) - _dry_basis(m0_pct)) / (awc - aw0)
    return w_dry * b * math.log((rh - aw0) / (rh - awc)) / (area * p_sat_kpa(t_c) * days)


def moisture_loss_days(mass_g, loss_frac, aw0, rh, k, area, t_c, extra_g_day: float = 0.0) -> float:
    rate = k * area * p_sat_kpa(t_c) * max(0.0, aw0 - rh) + extra_g_day
    return math.inf if rate <= 0 else loss_frac * mass_g / rate


def required_k_loss(mass_g, loss_frac, aw0, rh, area, t_c, days) -> float:
    drive = max(0.0, aw0 - rh)
    return math.inf if drive <= 0 else loss_frac * mass_g / (area * p_sat_kpa(t_c) * drive * days)


# ---------- Oxygen budget (oxidation-sensitive foods) ----------

def o2_budget_ml(budget_mg_per_kg: float, mass_g: float) -> float:
    return budget_mg_per_kg * mass_g / 1000.0 / O2_DENSITY_MG_PER_ML


def oxygen_budget_days(budget_ml: float, otr_t: float, area: float) -> float:
    """Days until permeated O₂ (OTR·A·ΔpO₂) uses up the tolerable O₂ gain; package flushed to ~0 % O₂."""
    flux = otr_t * area * O2_AIR
    return math.inf if flux <= 0 else budget_ml / flux


def required_otr(budget_ml: float, area: float, days: float) -> float:
    return budget_ml / (area * O2_AIR * days)


# ---------- Microbial growth (Ratkowsky square-root model) ----------

def microbial_days(ref_days: float, ref_t_c: float, t_c: float, t_min_c: float = -5.0) -> float:
    """√μ = b(T − Tmin) ⇒ shelf life ∝ 1/(T − Tmin)²; no growth at or below Tmin."""
    if t_c <= t_min_c + 0.5:
        return math.inf
    return ref_days * ((ref_t_c - t_min_c) / (t_c - t_min_c)) ** 2
