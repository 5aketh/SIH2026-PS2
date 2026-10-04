import numpy as np

def extract_features(scenario) -> np.ndarray:
    """
    Extracts numerical features from a Scenario object.
    Raises ValueError if any required parameter is missing or None.
    """
    food = getattr(scenario, "commodity", None)
    cond = getattr(scenario, "conditions", None)
    prio = getattr(scenario, "priorities", None)

    if food is None:
        raise ValueError("Scenario payload is missing 'commodity' configuration.")
    if cond is None:
        raise ValueError("Scenario payload is missing 'conditions' configuration.")
    if prio is None:
        raise ValueError("Scenario payload is missing 'priorities' configuration.")

    # 1. Validate Food Chemical & Physical Attributes
    moisture = getattr(food, "moisture_pct", None)
    if moisture is None:
        raise ValueError(f"Commodity '{getattr(food, 'name', 'Unknown')}' is missing required field 'moisture_pct'.")

    fat = getattr(food, "fat_pct", None)
    if fat is None:
        raise ValueError(f"Commodity '{getattr(food, 'name', 'Unknown')}' is missing required field 'fat_pct'.")

    ph = getattr(food, "ph", None)
    if ph is None:
        raise ValueError(f"Commodity '{getattr(food, 'name', 'Unknown')}' is missing required field 'ph'.")

    water_act = getattr(food, "water_activity", None)
    if water_act is None:
        raise ValueError(f"Commodity '{getattr(food, 'name', 'Unknown')}' is missing required field 'water_activity'.")

    oxidation_val = getattr(food, "oxidation_sensitive", None)
    if oxidation_val is None:
        raise ValueError(f"Commodity '{getattr(food, 'name', 'Unknown')}' is missing required field 'oxidation_sensitive'.")
    oxidation = 1.0 if bool(oxidation_val) else 0.0

    # 2. Validate Storage & Environmental Conditions
    temp = getattr(cond, "temperature_c", None)
    if temp is None:
        raise ValueError("Conditions are missing required field 'temperature_c'.")

    target_days = getattr(cond, "target_shelf_life_days", None)
    if target_days is None:
        raise ValueError("Conditions are missing required field 'target_shelf_life_days'.")

    rh = getattr(cond, "relative_humidity_pct", None)
    if rh is None:
        raise ValueError("Conditions are missing required field 'relative_humidity_pct'.")

    storage_type = getattr(cond, "storage_type", None)
    if storage_type is None:
        raise ValueError("Conditions are missing required field 'storage_type'.")

    storage_type_str = str(storage_type).lower()
    is_chilled = 1.0 if storage_type_str == "chilled" else 0.0
    is_frozen = 1.0 if storage_type_str == "frozen" else 0.0

    # 3. Validate User Priorities & Weights
    weights = getattr(prio, "weights", None)
    if weights is None:
        raise ValueError("Priorities configuration is missing 'weights' object.")

    w_shelf = getattr(weights, "shelf_life", None)
    if w_shelf is None:
        raise ValueError("Priority weights are missing 'shelf_life'.")

    w_cost = getattr(weights, "cost", None)
    if w_cost is None:
        raise ValueError("Priority weights are missing 'cost'.")

    w_sust = getattr(weights, "sustainability", None)
    if w_sust is None:
        raise ValueError("Priority weights are missing 'sustainability'.")

    w_mech = getattr(weights, "mechanical_strength", None)
    if w_mech is None:
        raise ValueError("Priority weights are missing 'mechanical_strength'.")

    # 4. Validate Hard Constraints
    constraints = getattr(prio, "hard_constraints", None)
    if constraints is None:
        raise ValueError("Priorities configuration is missing 'hard_constraints' object.")

    must_recycle_val = getattr(constraints, "must_be_recyclable", None)
    if must_recycle_val is None:
        raise ValueError("Hard constraints missing field 'must_be_recyclable'.")

    must_compost_val = getattr(constraints, "must_be_compostable", None)
    if must_compost_val is None:
        raise ValueError("Hard constraints missing field 'must_be_compostable'.")

    must_recycle = 1.0 if bool(must_recycle_val) else 0.0
    must_compost = 1.0 if bool(must_compost_val) else 0.0

    features = [
        float(moisture),
        float(fat),
        float(ph),
        float(water_act),
        float(oxidation),
        float(temp),
        float(target_days),
        float(rh),
        is_chilled,
        is_frozen,
        float(w_shelf),
        float(w_cost),
        float(w_sust),
        float(w_mech),
        must_recycle,
        must_compost,
    ]

    return np.array(features, dtype=np.float32).reshape(1, -1)