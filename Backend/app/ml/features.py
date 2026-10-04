import numpy as np


def extract_features(scenario) -> np.ndarray:
    """
    Extracts numerical features from a Scenario object for ML model input.
    Handles catalog foods and arbitrary custom foods seamlessly.
    """
    food = scenario.commodity
    cond = scenario.conditions
    prio = scenario.priorities

    # Safe feature extraction with robust defaults for missing/custom food properties
    moisture = getattr(food, "moisture_pct", None)
    if moisture is None:
        moisture = 50.0

    fat = getattr(food, "fat_pct", None)
    if fat is None:
        fat = 10.0

    ph = getattr(food, "ph", None)
    if ph is None:
        ph = 6.0

    water_act = getattr(food, "water_activity", None)
    if water_act is None:
        water_act = 0.75

    oxidation = 1.0 if getattr(food, "oxidation_sensitive", False) else 0.0

    # Extract environmental conditions
    temp = float(getattr(cond, "temperature_c", 20.0))
    target_days = float(getattr(cond, "target_shelf_life_days", 14.0))
    rh = float(getattr(cond, "relative_humidity_pct", 65.0))
    storage_type = str(getattr(cond, "storage_type", "ambient")).lower()

    is_chilled = 1.0 if storage_type == "chilled" else 0.0
    is_frozen = 1.0 if storage_type == "frozen" else 0.0

    # Extract user priority weights (0.0 - 1.0)
    weights = getattr(prio, "weights", None)
    w_shelf = float(getattr(weights, "shelf_life", 0.5)) if weights else 0.5
    w_cost = float(getattr(weights, "cost", 0.5)) if weights else 0.5
    w_sust = float(getattr(weights, "sustainability", 0.5)) if weights else 0.5
    w_mech = float(getattr(weights, "mechanical_strength", 0.5)) if weights else 0.5

    # Extract hard constraints
    constraints = getattr(prio, "hard_constraints", None)
    must_recycle = 1.0 if constraints and getattr(constraints, "must_be_recyclable", False) else 0.0
    must_compost = 1.0 if constraints and getattr(constraints, "must_be_compostable", False) else 0.0

    features = [
        float(moisture),
        float(fat),
        float(ph),
        float(water_act),
        float(oxidation),
        temp,
        target_days,
        rh,
        is_chilled,
        is_frozen,
        w_shelf,
        w_cost,
        w_sust,
        w_mech,
        must_recycle,
        must_compost,
    ]

    return np.array(features, dtype=np.float32).reshape(1, -1)