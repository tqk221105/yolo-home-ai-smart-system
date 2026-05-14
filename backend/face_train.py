from ai.face_ai import train_face_model


def main():
    result = train_face_model()
    print(
        "Face model saved -> "
        f"{result['model_path']} "
        f"({sum(result['sample_counts'].values())} samples)"
    )


if __name__ == "__main__":
    main()
