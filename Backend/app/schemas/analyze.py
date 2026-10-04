"""POST /api/analyze request body (frontend build spec §7.3). Enums mirror src/data/wizard.js."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Category = Literal["fresh_produce", "dry_goods", "dairy", "meat_seafood", "snack", "other"]
Respiration = Literal["none", "low", "medium", "high"]
Level = Literal["low", "medium", "high"]
StorageType = Literal["ambient", "chilled", "frozen"]
TransportMode = Literal["none", "ambient_transport", "refrigerated_transport", "frozen_transport"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class Profile(CamelModel):
    moisture_pct: float | None = Field(None, ge=0, le=100)
    ph: float | None = Field(None, ge=0, le=14)
    fat_pct: float | None = Field(None, ge=0, le=100)
    respiration_class: Respiration | None = None
    oxidation_sensitivity: Level | None = None
    category: Category | None = None


class CommodityIn(CamelModel):
    commodity_id: str | None = Field(None, max_length=64)
    commodity_name: str | None = Field(None, max_length=120)
    is_custom: bool = False
    profile: Profile = Field(default_factory=Profile)


class Conditions(CamelModel):
    storage_type: StorageType
    temperature_c: float = Field(ge=-40, le=60)
    relative_humidity_pct: float = Field(ge=0, le=100)
    target_shelf_life_days: int = Field(ge=1, le=3650)
    transport_mode: TransportMode
    transport_stress: Level


class Priorities(CamelModel):
    shelf_life: float = Field(0.5, ge=0, le=1)
    cost: float = Field(0.5, ge=0, le=1)
    sustainability: float = Field(0.5, ge=0, le=1)
    mechanical_strength: float = Field(0.5, ge=0, le=1)
    hard_constraints: list[str] = Field(default_factory=list, max_length=20)


class PackageIn(CamelModel):
    """Optional extension: pack size. Category defaults apply when absent."""

    net_weight_g: float | None = Field(None, gt=0, le=50000)
    area_m2: float | None = Field(None, gt=0, le=5)
    format: str | None = Field(None, max_length=80)


class AnalyzeRequest(CamelModel):
    commodity: CommodityIn
    conditions: Conditions
    priorities: Priorities = Field(default_factory=Priorities)
    package: PackageIn | None = None

    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="ignore",
        json_schema_extra={
            "example": {
                "commodity": {
                    "commodityId": "TOMATO_GENERIC", "commodityName": "Tomato", "isCustom": False,
                    "profile": {"moisturePct": 94.0, "ph": 4.5, "fatPct": 0.2, "respirationClass": "high",
                                "oxidationSensitivity": "medium", "category": "fresh_produce"},
                },
                "conditions": {"storageType": "chilled", "temperatureC": 12, "relativeHumidityPct": 85,
                               "targetShelfLifeDays": 20, "transportMode": "refrigerated_transport", "transportStress": "medium"},
                "priorities": {"shelfLife": 0.8, "cost": 0.4, "sustainability": 0.7, "mechanicalStrength": 0.5, "hardConstraints": []},
            }
        },
    )
