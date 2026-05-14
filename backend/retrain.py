import os
import sys

import joblib
import pandas as pd
from dotenv import load_dotenv
from sklearn.tree import DecisionTreeClassifier

from train import build_light_feature_columns, hour_fraction_series


load_dotenv()


def _truthy_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def resolve_light_dataset_csv(backend_dir: str) -> str:
    raw = os.getenv("LIGHT_DATA_PATH", "").strip()
    if not raw:
        return os.path.join(backend_dir, "data", "light_dataset.csv")
    if os.path.isabs(raw):
        return os.path.normpath(raw)
    return os.path.normpath(os.path.join(backend_dir, raw))


def apply_light_need_labels(light_df: pd.DataFrame, target_col: str):
    if _truthy_env("LIGHT_USE_ORIGINAL_OCCUPANCY_LABELS"):
        return light_df.copy(), "original_occupancy_column"
    max_lux = float(os.getenv("LIGHT_NEED_ON_MAX_LUX", "380"))
    out = light_df.copy()
    out[target_col] = (
        out["Light"].astype(float) < max_lux
    ).astype(int)
    return out, f"need_light_if_lux_below_{max_lux}"


BASE_DIR = os.path.dirname(__file__)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models"
)

FAN_MODEL_PATH = os.path.join(
    MODEL_DIR,
    "fan_model.pkl"
)

BASE_DATA = os.path.join(
    BASE_DIR,
    "data",
    "ashrae.csv"
)

LIGHT_MODEL_PATH = os.path.join(
    MODEL_DIR,
    "light_model.pkl"
)

LIGHT_FEATURE_PATH = os.path.join(
    MODEL_DIR,
    "light_features.pkl"
)

LIGHT_DATA = resolve_light_dataset_csv(BASE_DIR)

USER_DATA = os.path.join(
    BASE_DIR,
    "data",
    "user_log.csv"
)

# Exit: 0 = đã joblib.dump ít nhất một model; 2 = không ghi được model nào (hoặc bỏ qua sớm).

# =====================================
# FAN CONFIG
# =====================================

FEATURES = [
    "Air temperature (C)",
    "Relative humidity (%)"
]

TARGET = "Fan"

FAN_USER_COLUMNS = [
    "temperature",
    "humidity",
    "fan",
]

# =====================================
# LIGHT CONFIG
# =====================================

LIGHT_TARGET = "Occupancy"

LIGHT_USER_COLUMNS = [
    "temperature",
    "humidity",
    "light_level",
    "light",
]


def main():
    models_saved = False

    if not os.path.isfile(USER_DATA):
        print("No user data yet -> skip retrain")
        sys.exit(2)

    df_user = pd.read_csv(USER_DATA)

    if df_user.empty:
        print("User log is empty -> skip retrain")
        sys.exit(2)

    missing_fan_cols = [
        c for c in FAN_USER_COLUMNS if c not in df_user.columns
    ]
    missing_light_cols = [
        c for c in LIGHT_USER_COLUMNS if c not in df_user.columns
    ]

    os.makedirs(MODEL_DIR, exist_ok=True)

    print(f"Light base CSV -> {LIGHT_DATA}")

    # =====================================
    # FAN RETRAIN
    # =====================================

    if not missing_fan_cols:

        if not os.path.isfile(BASE_DATA):
            print(
                f"Skip fan retrain (missing base dataset): {BASE_DATA}"
            )
        else:

            df_base = pd.read_csv(
                BASE_DATA,
                low_memory=False
            )

            df_base = df_base[
                FEATURES + [TARGET]
            ].dropna()

            df_base[TARGET] = (
                df_base[TARGET]
                .astype(int)
            )

            df_user_fan = df_user.rename(
                columns={
                    "temperature":
                    "Air temperature (C)",

                    "humidity":
                    "Relative humidity (%)",

                    "fan":
                    "Fan"
                }
            )

            df_user_fan = df_user_fan[
                FEATURES + [TARGET]
            ].dropna()

            df_user_fan[TARGET] = (
                df_user_fan[TARGET]
                .astype(int)
            )

            # Chuẩn hóa nhãn fan 0/1 (log có thể có tốc độ 50/120 từ kit — coi >0 là bật).
            df_user_fan[TARGET] = (
                df_user_fan[TARGET]
                .astype(float)
                .gt(0)
                .astype(int)
            )

            if df_user_fan.empty:
                print("No usable fan rows in user log -> skip fan retrain")
            else:
                df_user_fan_boost = pd.concat(
                    [df_user_fan] * 5,
                    ignore_index=True
                )

                df_fan = pd.concat(
                    [df_base, df_user_fan_boost],
                    ignore_index=True
                )

                print(
                    "Fan total samples:",
                    len(df_fan)
                )

                print(
                    "Fan user samples:",
                    len(df_user_fan)
                )

                X = df_fan[FEATURES]
                y = df_fan[TARGET]

                fan_model = DecisionTreeClassifier(
                    max_depth=5,
                    min_samples_split=30,
                    min_samples_leaf=20,
                    class_weight="balanced",
                    random_state=42
                )

                fan_model.fit(X, y)

                joblib.dump(
                    fan_model,
                    FAN_MODEL_PATH
                )

                models_saved = True

                print(
                    "Fan model retrained!"
                )
    else:
        print(
            f"Skip fan retrain (missing columns): {missing_fan_cols}"
        )

    # =====================================
    # LIGHT RETRAIN
    # =====================================

    if not missing_light_cols:

        if not os.path.isfile(LIGHT_DATA):
            print(
                f"Skip light retrain (missing dataset): {LIGHT_DATA}"
            )
        else:

            df_light_raw = pd.read_csv(
                LIGHT_DATA
            )

            if (
                "Light" not in df_light_raw.columns
                or LIGHT_TARGET not in df_light_raw.columns
            ):
                print(
                    f"Skip light retrain — CSV needs 'Light' and "
                    f"'{LIGHT_TARGET}': {LIGHT_DATA}"
                )
            else:

                df_light_base, light_feats = build_light_feature_columns(
                    df_light_raw
                )

                cols_req = light_feats + [LIGHT_TARGET]
                df_light_base = df_light_base[
                    cols_req
                ].dropna()

                df_light_base, light_lab = apply_light_need_labels(
                    df_light_base,
                    LIGHT_TARGET,
                )
                df_light_base[LIGHT_TARGET] = (
                    df_light_base[LIGHT_TARGET]
                    .astype(int)
                )
                print(
                    f"Light base label mode ({LIGHT_TARGET}): {light_lab}"
                )
                print(f"Light feature columns: {light_feats}")

                df_user_light = df_user.rename(
                    columns={
                        "temperature":
                        "Temperature",

                        "humidity":
                        "Humidity",

                        "light_level":
                        "Light",

                        "light":
                        "Occupancy"
                    }
                )

                if "Hour" in light_feats:
                    if "timestamp" in df_user_light.columns:
                        df_user_light["Hour"] = hour_fraction_series(
                            df_user_light["timestamp"]
                        )
                    else:
                        df_user_light["Hour"] = 12.0
                        print(
                            "user_log has no 'timestamp' — "
                            "using Hour=12 for user light rows"
                        )

                df_user_light = df_user_light[
                    light_feats +
                    [LIGHT_TARGET]
                ].dropna()

                df_user_light[LIGHT_TARGET] = (
                    df_user_light[LIGHT_TARGET]
                    .astype(float)
                    .gt(0)
                    .astype(int)
                )

                if df_user_light.empty:
                    print(
                        "No usable light rows in user log "
                        "-> skip light retrain"
                    )
                else:
                    df_user_light_boost = pd.concat(
                        [df_user_light] * 5,
                        ignore_index=True
                    )

                    df_light = pd.concat(
                        [
                            df_light_base,
                            df_user_light_boost
                        ],
                        ignore_index=True
                    )

                    print(
                        "Light total samples:",
                        len(df_light)
                    )

                    print(
                        "Light user samples:",
                        len(df_user_light)
                    )

                    X_light = df_light[
                        light_feats
                    ]

                    y_light = df_light[
                        LIGHT_TARGET
                    ]

                    light_model = DecisionTreeClassifier(
                        max_depth=5,
                        min_samples_split=20,
                        min_samples_leaf=10,
                        class_weight="balanced",
                        random_state=42
                    )

                    light_model.fit(
                        X_light,
                        y_light
                    )

                    joblib.dump(
                        light_model,
                        LIGHT_MODEL_PATH
                    )

                    joblib.dump(
                        light_feats,
                        LIGHT_FEATURE_PATH
                    )

                    models_saved = True

                    print(
                        "Light model retrained!"
                    )
    else:
        print(
            f"Skip light retrain (missing columns): {missing_light_cols}"
        )

    if models_saved:
        sys.exit(0)

    print(
        "No models were written (exit 2); counter will not reset."
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
