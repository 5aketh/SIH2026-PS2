"""Food properties + conditions → deterioration risks (Team Report §5.2).

Every risk carries the inputs that triggered it, so the explanation can trace
input → risk → requirement.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .context import Scenario

SENS = {"low": 0.25, "medium": 0.55, "high": 0.85}


@dataclass
class Risk:
    code: str
    title: str
    severity: float  # 0-1
    drivers: list[str] = field(default_factory=list)

    @property
    def level(self) -> str:
        return "high" if self.severity >= 0.7 else "medium" if self.severity >= 0.4 else "low"

    def to_dict(self) -> dict:
        return {"code": self.code, "title": self.title, "level": self.level,
                "severity": round(self.severity, 2), "drivers": self.drivers}


def light_sensitive(s: Scenario) -> bool:
    flag = s.v("lightSensitive")
    if flag is not None:
        return bool(flag)
    return (s.v("fatPct") or 0) >= 10 and s.v("oxidationSensitivity") == "high"


def assess(s: Scenario) -> list[Risk]:
    risks: list[Risk] = []
    t, rh = s.temperature_c, s.rh
    moisture = s.v("moisturePct") or 0
    fat = s.v("fatPct") or 0
    ph = s.v("ph")
    resp = s.v("respirationClass") or "none"
    oxid = s.v("oxidationSensitivity") or "medium"
    aw = s.aw

    if s.is_produce and resp != "none":
        sev = {"low": 0.35, "medium": 0.65, "high": 0.9}[resp]
        risks.append(Risk("RESPIRATION", "Respiration and headspace anoxia", sev,
                          [f"{resp} respiration class", f"{t:g} °C storage"]))
        chill = s.v("chillThresholdC")
        if chill is not None and t < chill:
            risks.append(Risk("CHILLING_INJURY", "Chilling injury", 0.6,
                              [f"{t:g} °C is below the {chill:g} °C chilling threshold"]))
        if rh >= 0.85 or (s.storage_type == "chilled" and s.transport_mode == "ambient_transport"):
            risks.append(Risk("CONDENSATION", "Condensation and fogging", 0.5,
                              [f"{rh * 100:.0f} % RH", "temperature swings during cold chain"]))
        if aw is not None and aw - rh > 0.1:
            risks.append(Risk("DEHYDRATION", "Dehydration and weight loss", min(0.8, (aw - rh) * 2),
                              [f"aw {aw:.2f} vs {rh * 100:.0f} % RH outside"]))
    elif s.moisture_sensitive and aw is not None:
        awc = s.v("awCritical")
        if aw < rh - 0.05:
            gap = (rh - aw) / max(0.05, (awc or aw + 0.2) - aw)
            risks.append(Risk("MOISTURE_GAIN", "Moisture ingress", min(1.0, 0.3 + 0.15 * gap),
                              [f"aw {aw:.2f} vs {rh * 100:.0f} % RH outside", f"quality limit at aw {awc:.2f}" if awc else "low initial moisture"]))
        elif aw > rh + 0.05 and moisture > 15:
            risks.append(Risk("MOISTURE_LOSS", "Moisture loss (drying, freezer burn)", 0.4,
                              [f"aw {aw:.2f} vs {rh * 100:.0f} % RH outside"]))

    if not s.is_produce and (fat >= 1 or oxid == "high"):
        sev = SENS[oxid] * (1.0 if fat >= 5 else 0.7)
        risks.append(Risk("OXIDATION", "Lipid oxidation (rancidity)", sev,
                          [f"{fat:g} % fat", f"{oxid} oxidation sensitivity"]))
    if light_sensitive(s):
        risks.append(Risk("LIGHT", "Photo-oxidation", 0.7, [f"{fat:g} % fat", "light-sensitive product"]))

    if not s.is_produce and aw is not None and aw >= 0.90 and not s.is_frozen:
        risks.append(Risk("MICROBIAL", "Microbial spoilage", 0.9 if t > 8 else 0.7,
                          [f"aw {aw:.2f}", f"pH {ph:g}" if ph is not None else "pH unknown", f"{t:g} °C"]))

    stress = s.transport_stress
    risks.append(Risk("HANDLING", "Handling and transit damage", {"low": 0.2, "medium": 0.5, "high": 0.85}[stress],
                      [f"{stress} transport stress", s.transport_mode.replace("_", " ")]))

    if not s.is_produce and (fat > 15 or moisture > 50):
        risks.append(Risk("SEAL_CONTAMINATION", "Seal contamination", 0.6,
                          [f"{fat:g} % fat" if fat > 15 else f"{moisture:g} % moisture", "oil or liquid on seal jaws"]))
    if not s.is_produce and ph is not None and ph < 4.5 and moisture > 50:
        risks.append(Risk("ACID", "Acid attack on seals and foil", 0.5, [f"pH {ph:g}"]))
    if s.is_frozen:
        risks.append(Risk("FREEZE", "Brittleness at frozen temperatures", 0.5, [f"{t:g} °C"]))

    return sorted(risks, key=lambda r: -r.severity)
