"""Knowledge base (Blueprint Layer 4 / Team Report §8) plus stored analyses.

Columns that the API filters on are typed; the long tail of physical properties
lives in a JSON `props` column so the property set can grow without migrations.
"""
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    citation: Mapped[str] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(500))
    retrieved_on: Mapped[str | None] = mapped_column(String(20))


class Commodity(Base):
    __tablename__ = "commodities"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    source_id: Mapped[str | None] = mapped_column(ForeignKey("sources.id"))

    params: Mapped[list["CommodityParam"]] = relationship(
        back_populates="commodity", cascade="all, delete-orphan", lazy="selectin"
    )
    source: Mapped[Source | None] = relationship(lazy="joined")


class CommodityParam(Base):
    """One property of a commodity with its own provenance (the {value, provenance, confidence} wrapper)."""

    __tablename__ = "commodity_params"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    commodity_id: Mapped[str] = mapped_column(ForeignKey("commodities.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(64))
    # JSON so one column holds numbers, enums and ranges ([lo, hi]).
    value: Mapped[object] = mapped_column(JSON, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(40))
    provenance: Mapped[str | None] = mapped_column(String(32))
    confidence: Mapped[str | None] = mapped_column(String(16))
    source_id: Mapped[str | None] = mapped_column(ForeignKey("sources.id"))

    commodity: Mapped[Commodity] = relationship(back_populates="params")


class Material(Base):
    """A film ply as a converter supplies it (Primary Polymer + Barrier Performance entities)."""

    __tablename__ = "materials"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    family: Mapped[str] = mapped_column(String(40), index=True)
    polymer_class: Mapped[str] = mapped_column(String(16))
    density_g_cm3: Mapped[float] = mapped_column(Float)
    ref_thickness_um: Mapped[float] = mapped_column(Float)
    otr_ref: Mapped[float] = mapped_column(Float)  # cc/m²·day·atm, 23 °C 0 %RH, at ref thickness
    wvtr_ref: Mapped[float] = mapped_column(Float)  # g/m²·day, 38 °C 90 %RH, at ref thickness
    sealability: Mapped[str] = mapped_column(String(10))
    epr_category: Mapped[str] = mapped_column(String(8))
    metallized: Mapped[bool] = mapped_column(Boolean, default=False)
    non_plastic: Mapped[bool] = mapped_column(Boolean, default=False)
    compostable: Mapped[bool] = mapped_column(Boolean, default=False)
    cost_inr_per_kg_lo: Mapped[float] = mapped_column(Float)
    cost_inr_per_kg_hi: Mapped[float] = mapped_column(Float)
    carbon_kg_per_kg: Mapped[float] = mapped_column(Float)
    provenance: Mapped[str] = mapped_column(String(32))
    source_id: Mapped[str | None] = mapped_column(ForeignKey("sources.id"))
    props: Mapped[dict] = mapped_column(JSON, default=dict)


class Structure(Base):
    """A composite: ordered plies from outside (print) to inside (seal)."""

    __tablename__ = "structures"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    gas_mode: Mapped[str] = mapped_column(String(16))  # barrier | breathable
    perforation: Mapped[str] = mapped_column(String(8))  # none | micro | macro
    props: Mapped[dict] = mapped_column(JSON, default=dict)

    layers: Mapped[list["StructureLayer"]] = relationship(
        back_populates="structure",
        cascade="all, delete-orphan",
        order_by="StructureLayer.position",
        lazy="selectin",
    )


class StructureLayer(Base):
    __tablename__ = "structure_layers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    structure_id: Mapped[str] = mapped_column(ForeignKey("structures.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    material_id: Mapped[str] = mapped_column(ForeignKey("materials.id"))
    thickness_um: Mapped[float] = mapped_column(Float)
    function: Mapped[str] = mapped_column(String(16))

    structure: Mapped[Structure] = relationship(back_populates="layers")


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    engine_version: Mapped[str] = mapped_column(String(16))
    request: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
