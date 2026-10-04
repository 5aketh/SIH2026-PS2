"""Package Builder and What-If request bodies (Features Report §2-3)."""
from typing import Literal

from pydantic import Field, model_validator

from .analyze import AnalyzeRequest, CamelModel


class LayerIn(CamelModel):
    material_id: str = Field(max_length=64)
    thickness_um: float = Field(gt=0, le=300)
    function: Literal["print", "structural", "barrier", "seal"] | None = None


class StructureIn(CamelModel):
    """Either a library structure id or a custom layer stack (outside → inside)."""

    structure_id: str | None = Field(None, max_length=64)
    name: str | None = Field(None, max_length=120)
    layers: list[LayerIn] | None = Field(None, min_length=1, max_length=7)
    perforation: Literal["none", "micro", "macro"] | None = None

    @model_validator(mode="after")
    def _one_of(self):
        if not self.structure_id and not self.layers:
            raise ValueError("Give either structureId or layers")
        return self


class EvaluateRequest(CamelModel):
    scenario: AnalyzeRequest
    structure: StructureIn


class WhatIfSide(CamelModel):
    scenario: AnalyzeRequest | None = None
    structure: StructureIn | None = None


class WhatIfRequest(CamelModel):
    baseline: WhatIfSide
    variant: WhatIfSide

    @model_validator(mode="after")
    def _baseline_scenario(self):
        if self.baseline.scenario is None:
            raise ValueError("baseline.scenario is required")
        return self
