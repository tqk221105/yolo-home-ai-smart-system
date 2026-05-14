import os
import sys

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.tree import DecisionTreeClassifier


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


def resolve_light_datetime_column(df: pd.DataFrame):
    explicit = os.getenv("LIGHT_DATETIME_COL", "").strip()
    if explicit:
        for part in explicit.split(","):
            c = part.strip()
            if c and c in df.columns:
                return c
    for c in ("date", "timestamp", "Date", "datetime", "time", "Time"):
        if c in df.columns:
            return c
    return None


def hour_fraction_series(series: pd.Series) -> pd.Series:
    """
    Parse linh hoạt: .env LIGHT_DATETIME_FORMAT (strptime) hoặc thử UCI dd/mm/yy HH:MM,
    rồi fallback dayfirst (user_log ISO / hỗn hợp).

    Cột đã là datetime64 (vd user_log): parse một lần, không gán từng nhóm
    (tránh lỗi dtype datetime64[s] vs [us] trên pandas 2.x).
    """
    dayfirst = os.getenv("LIGHT_DATETIME_DAYFIRST", "1").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )
    fmt = os.getenv("LIGHT_DATETIME_FORMAT", "").strip()

    if pd.api.types.is_datetime64_any_dtype(series.dtype):
        dt = pd.to_datetime(series, errors="coerce")
    elif fmt:
        s = series.astype(str).str.strip()
        dt = pd.to_datetime(s, format=fmt, errors="coerce")
    else:
        s = series.astype(str).str.strip()
        strict = pd.to_datetime(
            s,
            format="%d/%m/%y %H:%M",
            errors="coerce",
        )
        flex = pd.to_datetime(s, dayfirst=dayfirst, errors="coerce")
        dt = strict.where(strict.notna(), flex)

    hour = (
        dt.dt.hour.astype(np.float64)
        + dt.dt.minute.astype(np.float64) / 60.0
        + dt.dt.second.astype(np.float64) / 3600.0
        + dt.dt.microsecond.astype(np.float64) / (3600.0 * 1e6)
    )
    return hour


def _light_time_enabled() -> bool:
    return os.getenv("LIGHT_USE_TIME_FEATURE", "1").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def build_light_feature_columns(light_df: pd.DataFrame):
    """
    Trả về (light_df_mutated, light_features_list).
    Thêm cột Hour nếu bật LIGHT_USE_TIME_FEATURE và tìm được cột thời gian.
    """
    use_time = _light_time_enabled()
    time_col = resolve_light_datetime_column(light_df) if use_time else None

    out = light_df.copy()
    feats = ["Light"]

    if time_col:
        out["Hour"] = hour_fraction_series(out[time_col])
        before = len(out)
        out = out.dropna(subset=["Hour"])
        dropped = before - len(out)
        if dropped:
            print(f"Light: dropped {dropped} rows with unparseable '{time_col}'")
        feats.append("Hour")
        print(f"Light: time feature from column '{time_col}' -> Hour")
    elif use_time:
        print(
            "Light: no datetime column found "
            "(set LIGHT_DATETIME_COL or add date/timestamp); "
            "using Light only."
        )

    return out, feats


def apply_light_need_labels(light_df: pd.DataFrame, target_col: str):
    """Occupancy trong CSV train: nhãn gốc hoặc tạo từ lux (.env LIGHT_*)."""
    if _truthy_env("LIGHT_USE_ORIGINAL_OCCUPANCY_LABELS"):
        return light_df.copy(), "original_occupancy_column"
    max_lux = float(os.getenv("LIGHT_NEED_ON_MAX_LUX", "380"))
    out = light_df.copy()
    out[target_col] = (
        out["Light"].astype(float) < max_lux
    ).astype(int)
    return out, f"need_light_if_lux_below_{max_lux}"


# =====================================
# PATH CONFIG
# =====================================

BASE_DIR = os.path.dirname(__file__)

DATA_PATH = os.path.join(
    BASE_DIR,
    "data",
    "ashrae.csv"
)

LIGHT_DATA_PATH = resolve_light_dataset_csv(BASE_DIR)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models"
)

FAN_MODEL_PATH = os.path.join(
    MODEL_DIR,
    "fan_model.pkl"
)

LIGHT_MODEL_PATH = os.path.join(
    MODEL_DIR,
    "light_model.pkl"
)

FEATURE_PATH = os.path.join(
    MODEL_DIR,
    "features.pkl"
)

LIGHT_FEATURE_PATH = os.path.join(
    MODEL_DIR,
    "light_features.pkl"
)


def main():
    os.makedirs(
        MODEL_DIR,
        exist_ok=True
    )

    if not os.path.isfile(DATA_PATH):
        print(f"Missing dataset: {DATA_PATH}", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(LIGHT_DATA_PATH):
        print(f"Missing dataset: {LIGHT_DATA_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Light training CSV -> {LIGHT_DATA_PATH}")

    # =====================================
    # FAN MODEL
    # =====================================

    FEATURES = [
        "Air temperature (C)",
        "Relative humidity (%)"
    ]

    TARGET = "Fan"

    df = pd.read_csv(
        DATA_PATH,
        low_memory=False
    )

    df = df[
        FEATURES + [TARGET]
    ].dropna()

    df[TARGET] = df[
        TARGET
    ].astype(int)

    X = df[FEATURES]
    y = df[TARGET]

    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            stratify=y,
            random_state=42
        )
    except ValueError:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42
        )

    fan_model = DecisionTreeClassifier(
        max_depth=5,
        min_samples_split=30,
        min_samples_leaf=20,
        class_weight="balanced",
        random_state=42
    )

    cv_scores = cross_val_score(
        fan_model,
        X,
        y,
        cv=5,
        scoring="f1"
    )
    print(f"Fan CV F1 (mean ± std): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    fan_model.fit(
        X_train,
        y_train
    )

    joblib.dump(
        fan_model,
        FAN_MODEL_PATH
    )

    joblib.dump(
        FEATURES,
        FEATURE_PATH
    )

    # =====================================
    # LIGHT MODEL
    # =====================================

    light_df = pd.read_csv(
        LIGHT_DATA_PATH
    )

    LIGHT_TARGET = "Occupancy"

    if "Light" not in light_df.columns or LIGHT_TARGET not in light_df.columns:
        print(
            f"Light CSV must have 'Light' and '{LIGHT_TARGET}': "
            f"{LIGHT_DATA_PATH}",
            file=sys.stderr,
        )
        sys.exit(1)

    light_df, LIGHT_FEATURES = build_light_feature_columns(light_df)

    cols_req = LIGHT_FEATURES + [LIGHT_TARGET]
    light_df = light_df[cols_req].dropna()

    light_df, light_label_mode = apply_light_need_labels(
        light_df,
        LIGHT_TARGET,
    )

    light_df[LIGHT_TARGET] = light_df[
        LIGHT_TARGET
    ].astype(int)

    print(
        f"Light ML label mode ({LIGHT_TARGET}): {light_label_mode}"
    )
    print(f"Light feature columns: {LIGHT_FEATURES}")

    X_light = light_df[
        LIGHT_FEATURES
    ]

    y_light = light_df[
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
        LIGHT_FEATURES,
        LIGHT_FEATURE_PATH
    )

    print(
        f"\nFan model saved -> {FAN_MODEL_PATH}"
    )

    print(
        f"Fan features saved -> {FEATURE_PATH}"
    )

    print(
        f"Light model saved -> {LIGHT_MODEL_PATH}"
    )

    print(
        f"Light features saved -> {LIGHT_FEATURE_PATH}"
    )


if __name__ == "__main__":
    main()
