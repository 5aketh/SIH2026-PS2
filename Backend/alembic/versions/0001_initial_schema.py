"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-03 08:17:27.201843
"""
from alembic import op
import sqlalchemy as sa


revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('analyses',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('engine_version', sa.String(length=16), nullable=False),
    sa.Column('request', sa.JSON(), nullable=False),
    sa.Column('result', sa.JSON(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_analyses'))
    )
    op.create_table('sources',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('citation', sa.Text(), nullable=False),
    sa.Column('url', sa.String(length=500), nullable=True),
    sa.Column('retrieved_on', sa.String(length=20), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_sources'))
    )
    op.create_table('structures',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('gas_mode', sa.String(length=16), nullable=False),
    sa.Column('perforation', sa.String(length=8), nullable=False),
    sa.Column('props', sa.JSON(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_structures'))
    )
    op.create_table('commodities',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('category', sa.String(length=32), nullable=False),
    sa.Column('aliases', sa.JSON(), nullable=False),
    sa.Column('source_id', sa.String(length=64), nullable=True),
    sa.ForeignKeyConstraint(['source_id'], ['sources.id'], name=op.f('fk_commodities_source_id_sources')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_commodities'))
    )
    with op.batch_alter_table('commodities', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_commodities_category'), ['category'], unique=False)
        batch_op.create_index(batch_op.f('ix_commodities_name'), ['name'], unique=False)

    op.create_table('materials',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=160), nullable=False),
    sa.Column('family', sa.String(length=40), nullable=False),
    sa.Column('polymer_class', sa.String(length=16), nullable=False),
    sa.Column('density_g_cm3', sa.Float(), nullable=False),
    sa.Column('ref_thickness_um', sa.Float(), nullable=False),
    sa.Column('otr_ref', sa.Float(), nullable=False),
    sa.Column('wvtr_ref', sa.Float(), nullable=False),
    sa.Column('sealability', sa.String(length=10), nullable=False),
    sa.Column('epr_category', sa.String(length=8), nullable=False),
    sa.Column('metallized', sa.Boolean(), nullable=False),
    sa.Column('non_plastic', sa.Boolean(), nullable=False),
    sa.Column('compostable', sa.Boolean(), nullable=False),
    sa.Column('cost_inr_per_kg_lo', sa.Float(), nullable=False),
    sa.Column('cost_inr_per_kg_hi', sa.Float(), nullable=False),
    sa.Column('carbon_kg_per_kg', sa.Float(), nullable=False),
    sa.Column('provenance', sa.String(length=32), nullable=False),
    sa.Column('source_id', sa.String(length=64), nullable=True),
    sa.Column('props', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['source_id'], ['sources.id'], name=op.f('fk_materials_source_id_sources')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_materials'))
    )
    with op.batch_alter_table('materials', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_materials_family'), ['family'], unique=False)

    op.create_table('commodity_params',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('commodity_id', sa.String(length=64), nullable=False),
    sa.Column('key', sa.String(length=64), nullable=False),
    sa.Column('value', sa.JSON(), nullable=True),
    sa.Column('unit', sa.String(length=40), nullable=True),
    sa.Column('provenance', sa.String(length=32), nullable=True),
    sa.Column('confidence', sa.String(length=16), nullable=True),
    sa.Column('source_id', sa.String(length=64), nullable=True),
    sa.ForeignKeyConstraint(['commodity_id'], ['commodities.id'], name=op.f('fk_commodity_params_commodity_id_commodities'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['source_id'], ['sources.id'], name=op.f('fk_commodity_params_source_id_sources')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_commodity_params'))
    )
    with op.batch_alter_table('commodity_params', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_commodity_params_commodity_id'), ['commodity_id'], unique=False)

    op.create_table('structure_layers',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('structure_id', sa.String(length=64), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('material_id', sa.String(length=64), nullable=False),
    sa.Column('thickness_um', sa.Float(), nullable=False),
    sa.Column('function', sa.String(length=16), nullable=False),
    sa.ForeignKeyConstraint(['material_id'], ['materials.id'], name=op.f('fk_structure_layers_material_id_materials')),
    sa.ForeignKeyConstraint(['structure_id'], ['structures.id'], name=op.f('fk_structure_layers_structure_id_structures'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_structure_layers'))
    )
    with op.batch_alter_table('structure_layers', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_structure_layers_structure_id'), ['structure_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('structure_layers', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_structure_layers_structure_id'))

    op.drop_table('structure_layers')
    with op.batch_alter_table('commodity_params', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_commodity_params_commodity_id'))

    op.drop_table('commodity_params')
    with op.batch_alter_table('materials', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_materials_family'))

    op.drop_table('materials')
    with op.batch_alter_table('commodities', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_commodities_name'))
        batch_op.drop_index(batch_op.f('ix_commodities_category'))

    op.drop_table('commodities')
    op.drop_table('structures')
    op.drop_table('sources')
    op.drop_table('analyses')
