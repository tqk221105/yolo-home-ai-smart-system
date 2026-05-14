"""
Mock AI module: Face and voice recognition (90% accuracy simulation).
Will be replaced by actual ML models from AI team member.
"""

import random


def _simulate_result(confidence_if_correct: float = None) -> dict:
    success = random.random() < 0.9  # 90% correct
    confidence = confidence_if_correct if success else round(random.uniform(0.3, 0.6), 2)
    return success, round(confidence if confidence else random.uniform(0.85, 0.99), 2)


def recognize_face(image_data: str = None) -> dict:
    """
    Mock face recognition. In real implementation, image_data is base64 string.
    Returns 90% success, 10% failure.
    """
    success, confidence = _simulate_result()

    return {
        "success": success,
        "confidence": confidence,
        "identity": "authorized_user" if success else "unknown",
        "action": "UNLOCK" if success else "DENY",
        "message": "Nhận diện khuôn mặt thành công" if success else "Không nhận ra khuôn mặt"
    }


def recognize_voice(audio_data: str = None) -> dict:
    """
    Mock voice recognition. In real implementation, audio_data is base64 string.
    Returns 90% success, 10% failure.
    """
    success, confidence = _simulate_result()

    commands = ["mở cửa", "đóng cửa", "bật đèn", "tắt đèn", "bật quạt", "tắt quạt"]
    detected_command = random.choice(commands) if success else None

    return {
        "success": success,
        "confidence": confidence,
        "command": detected_command,
        "action": "EXECUTE" if success else "DENY",
        "message": f"Lệnh nhận diện: '{detected_command}'" if success else "Không nhận ra giọng nói"
    }
