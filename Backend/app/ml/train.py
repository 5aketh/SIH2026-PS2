import json
import os
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier

DATA_DIR = Path("app/data")
ARTIFACT_PATH = Path("artifacts/packaging_recommender.joblib")


def parse_numeric(val, default: float = 0.0) -> float:
    """Parses numeric values from dataset rows, handling standard deviations (e.g. '9.20±0.40') and NaNs."""
    if pd.isna(val) or val is None:
        return default
    # Handle string values with ± margin of error
    val_str = str(val).split("±")[0].strip()
    try:
        return float(val_str)
    except ValueError:
        return default


def load_and_verify_data_sources() -> dict:
    """Loads all dataset files and raises FileNotFoundError or ValueError if missing/empty."""
    data = {}

    # 1. ICMR-NIN Food Composition
    ifct_path = DATA_DIR / "icmr_nin_ifct2017.csv"
    if not ifct_path.exists():
        raise FileNotFoundError(
            f"Required dataset missing: {ifct_path.resolve()}"
        )
    df_ifct = pd.read_csv(ifct_path)
    if df_ifct.empty:
        raise ValueError(f"Dataset file is empty: {ifct_path.resolve()}")
    data["ifct"] = df_ifct

    # 2. Storage Kinetics
    kinetics_path = DATA_DIR / "storage_kinetics.csv"
    if not kinetics_path.exists():
        raise FileNotFoundError(
            f"Required dataset missing: {kinetics_path.resolve()}"
        )
    df_kinetics = pd.read_csv(kinetics_path)
    if df_kinetics.empty:
        raise ValueError(f"Dataset file is empty: {kinetics_path.resolve()}")
    data["kinetics"] = df_kinetics

    # 3. Mandi Prices
    mandi_path = DATA_DIR / "mandi_commodities.csv"
    if not mandi_path.exists():
        raise FileNotFoundError(
            f"Required dataset missing: {mandi_path.resolve()}"
        )
    df_mandi = pd.read_csv(mandi_path)
    if df_mandi.empty:
        raise ValueError(f"Dataset file is empty: {mandi_path.resolve()}")
    data["mandi"] = df_mandi

    # 4. FSSAI Regulations
    fssai_path = DATA_DIR / "fssai_packaging_rules.json"
    if not fssai_path.exists():
        raise FileNotFoundError(
            f"Required JSON rules missing: {fssai_path.resolve()}"
        )
    with open(fssai_path) as f:
        fssai_rules = json.load(f)
    if not fssai_rules:
        raise ValueError(f"JSON rules file is empty: {fssai_path.resolve()}")
    data["fssai"] = fssai_rules

    # 5. Packaging Structures
    struct_path = DATA_DIR / "structures.json"
    if not struct_path.exists():
        raise FileNotFoundError(
            f"Required structure library missing: {struct_path.resolve()}"
        )
    with open(struct_path) as f:
        structures = json.load(f)
    if not structures:
        raise ValueError(f"Structure library file is empty: {struct_path.resolve()}")
    data["structures"] = structures

    return data


def train_and_save_model(output_path: Path = ARTIFACT_PATH):
    """Trains ML model on verified datasets and saves the output model artifact."""
    print(f"Verifying and loading datasets from {DATA_DIR.resolve()}...")
    sources = load_and_verify_data_sources()

    df_ifct = sources["ifct"]
    output_path.parent.mkdir(parents=True, exist_ok=True)

    X_list = []
    y_structure = []
    y_shelf_life = []

    for index, row in df_ifct.iterrows():
        # 1. Extract Moisture (IFCT 2017 uses 'water')
        moisture_raw = (
            row.get("water")
            if "water" in row
            else row.get("Moisture_g", row.get("moisture"))
        )
        moisture = parse_numeric(moisture_raw, default=10.0)

        # 2. Extract Fat (IFCT 2017 uses 'fatce')
        fat_raw = (
            row.get("fatce")
            if "fatce" in row
            else row.get("Fat_g", row.get("fat"))
        )
        fat = parse_numeric(fat_raw, default=1.0)

        # 3. Extract pH (Default to neutral-slightly acidic 6.0 if missing from IFCT 2017)
        ph_raw = row.get("pH", row.get("ph"))
        ph = parse_numeric(ph_raw, default=6.0)

        # 4. Extract Water Activity (a_w) (Estimate from moisture content if missing from IFCT 2017)
        aw_raw = row.get(
            "Water_Activity", row.get("water_activity", row.get("aw"))
        )
        if aw_raw is not None and not pd.isna(aw_raw):
            aw = parse_numeric(aw_raw, default=0.75)
        else:
            # Estimate water activity normalized from moisture percentage (0.10 to 0.99)
            aw = min(0.99, max(0.10, moisture / 100.0))

        ox = 1.0 if fat > 10.0 else 0.0

        for temp in [4.0, 20.0, 32.0]:
            is_chilled = 1.0 if temp <= 10.0 else 0.0
            is_frozen = 1.0 if temp < 0.0 else 0.0
            target_days = 30.0 if is_chilled else 14.0
            rh = 75.0

            features = [
                moisture,
                fat,
                ph,
                aw,
                ox,
                temp,
                target_days,
                rh,
                is_chilled,
                is_frozen,
                0.5,
                0.5,
                0.5,
                0.5,
                0.0,
                0.0,
            ]
            X_list.append(features)

            if ox == 1.0 or fat > 15.0:
                struct = "STR-12"
                est_life = target_days * 1.5
            elif moisture > 65.0 and temp > 0:
                struct = "STR-02"
                est_life = target_days * 0.9
            else:
                struct = "STR-05"
                est_life = target_days * 1.1

            y_structure.append(struct)
            y_shelf_life.append(est_life)

    X = np.array(X_list)

    clf = RandomForestClassifier(
        n_estimators=100, max_depth=12, random_state=42
    )
    clf.fit(X, y_structure)

    reg = GradientBoostingRegressor(
        n_estimators=100, max_depth=5, random_state=42
    )
    reg.fit(X, y_shelf_life)

    artifact = {
        "classifier": clf,
        "regressor": reg,
        "version": "1.0.0-strict-no-fallbacks",
    }
    joblib.dump(artifact, output_path)
    print(
        f"ML Model successfully trained and saved to {output_path.resolve()}"
    )
    return True


if __name__ == "__main__":
    train_and_save_model()