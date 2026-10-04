import os
import joblib
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor


def train_and_save_model(output_path: str = "backend/artifacts/packaging_recommender.joblib"):
    """
    Trains a multi-output ML pipeline for structure selection and shelf life regression.
    """
    print("Starting ML model training pipeline...")

    # Ensure output directory exists
    artifact_file = Path(output_path)
    artifact_file.parent.mkdir(parents=True, exist_ok=True)

    # Available structures in seed knowledge base
    structure_ids = [
        "STR-01", "STR-02", "STR-03", "STR-04", "STR-05", "STR-06",
        "STR-07", "STR-08", "STR-09", "STR-10", "STR-11", "STR-12",
        "STR-13", "STR-14", "STR-15", "STR-16", "STR-17", "STR-18",
        "STR-19", "STR-20", "STR-21", "STR-22", "STR-23", "STR-24"
    ]

    np.random.seed(42)
    n_samples = 1500

    # Feature generation:
    # [moisture, fat, ph, water_act, oxidation, temp, target_days, rh, is_chilled, is_frozen, w_shelf, w_cost, w_sust, w_mech, recyclable, compostable]
    moisture = np.random.uniform(5.0, 95.0, n_samples)
    fat = np.random.uniform(0.0, 50.0, n_samples)
    ph = np.random.uniform(3.0, 8.0, n_samples)
    water_act = np.random.uniform(0.2, 0.99, n_samples)
    oxidation = np.random.choice([0.0, 1.0], size=n_samples)
    temp = np.random.uniform(-18.0, 35.0, n_samples)
    target_days = np.random.uniform(3.0, 180.0, n_samples)
    rh = np.random.uniform(30.0, 90.0, n_samples)
    is_chilled = np.where((temp >= 0) & (temp <= 10), 1.0, 0.0)
    is_frozen = np.where(temp < 0, 1.0, 0.0)
    w_shelf = np.random.uniform(0.1, 1.0, n_samples)
    w_cost = np.random.uniform(0.1, 1.0, n_samples)
    w_sust = np.random.uniform(0.1, 1.0, n_samples)
    w_mech = np.random.uniform(0.1, 1.0, n_samples)
    recyclable = np.random.choice([0.0, 1.0], size=n_samples, p=[0.7, 0.3])
    compostable = np.random.choice([0.0, 1.0], size=n_samples, p=[0.85, 0.15])

    X = np.column_stack([
        moisture, fat, ph, water_act, oxidation, temp, target_days, rh,
        is_chilled, is_frozen, w_shelf, w_cost, w_sust, w_mech, recyclable, compostable
    ])

    # Rule-based synthetic target labelling to give realistic ML patterns
    y_structure = []
    y_shelf_life = []

    for i in range(n_samples):
        # Wet/respiring vs dry/high barrier assignment logic
        if X[i, 15] == 1.0:  # Compostable required
            struct = "STR-23" if X[i, 0] > 50 else "STR-24"
        elif X[i, 14] == 1.0:  # Recyclable required
            struct = "STR-18" if X[i, 4] == 1.0 else "STR-17"
        elif X[i, 4] == 1.0 or X[i, 3] > 0.7:  # High oxidation / high water act
            struct = "STR-12" if X[i, 10] > 0.6 else "STR-08"
        elif X[i, 0] > 70 and X[i, 5] > 0:  # Respiring produce
            struct = "STR-02" if X[i, 7] > 75 else "STR-01"
        else:
            struct = structure_ids[i % len(structure_ids)]

        y_structure.append(struct)

        # Shelf life regression target (days)
        estimated_life = X[i, 6] * (1.1 if struct in ["STR-08", "STR-12"] else 0.95)
        y_shelf_life.append(max(1.0, float(estimated_life)))

    # Train Classifier for structure selection
    clf = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42)
    clf.fit(X, y_structure)

    # Train Regressor for shelf life prediction
    reg = GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42)
    reg.fit(X, y_shelf_life)

    # Save artifacts
    model_data = {
        "classifier": clf,
        "regressor": reg,
        "structure_ids": structure_ids,
        "version": "1.0.0"
    }

    joblib.dump(model_data, artifact_file)
    print(f"ML model successfully saved to {artifact_file.resolve()}")


if __name__ == "__main__":
    train_and_save_model()