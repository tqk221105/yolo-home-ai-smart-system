import base64
import os
import tempfile
import unittest
from unittest.mock import patch

from app import app
from ai import face_ai


PNG_1X1_BLACK = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)
def as_data_url(raw: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")


class FaceAITestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = os.path.join(self.tmp.name, "faces")
        self.model_path = os.path.join(self.tmp.name, "face_model.pkl")
        self.log_path = os.path.join(self.tmp.name, "face_log.csv")
        self.env = patch.dict(os.environ, {
            "FACE_DATA_DIR": self.data_dir,
            "FACE_MODEL_PATH": self.model_path,
            "FACE_CONFIDENCE_THRESHOLD": "0.85",
            "FACE_REQUIRE_DETECTED_FACE": "0",
            "ADAFRUIT_DOOR_FEED": "door-servo",
            "ADAFRUIT_DOOR_OPEN_VALUE": "OPEN",
            "FACE_ADMIN_PIN": "2468",
        })
        self.env.start()
        self.log_patch = patch("ai.face_logger.LOG_FILE", self.log_path)
        self.log_patch.start()
        face_ai._model_cache = None
        face_ai._model_signature = None
        self.client = app.test_client()

    def tearDown(self):
        self.log_patch.stop()
        self.env.stop()
        self.tmp.cleanup()

    def test_recognition_requires_image(self):
        res = self.client.post("/api/ai/face-recognition", json={})
        self.assertEqual(res.status_code, 400)
        body = res.get_json()
        self.assertFalse(body["success"])
        self.assertFalse(body["recognized"])

    def test_recognition_rejects_bad_base64(self):
        res = self.client.post("/api/ai/face-recognition", json={"image": "not-base64!"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("base64", res.get_json()["message"])

    def test_recognition_rejects_unsupported_image_format(self):
        res = self.client.post(
            "/api/ai/face-recognition",
            json={"image": base64.b64encode(b"hello").decode("ascii")},
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.get_json()["success"])

    def test_recognition_reports_missing_model(self):
        res = self.client.post(
            "/api/ai/face-recognition",
            json={"image": as_data_url(PNG_1X1_BLACK)},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Face model not found", res.get_json()["message"])

    def test_register_trains_and_recognized_face_opens_door(self):
        for _ in range(3):
            register_res = self.client.post("/api/ai/face-register", json={
                "label": "owner",
                "image": as_data_url(PNG_1X1_BLACK),
            })
            self.assertEqual(register_res.status_code, 200)
        self.assertTrue(os.path.isfile(self.model_path))

        with patch("ai.face_ai.send_feed_data", return_value={"value": "OPEN"}) as send:
            res = self.client.post(
                "/api/ai/face-recognition",
                json={"image": as_data_url(PNG_1X1_BLACK)},
            )

        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["recognized"])
        self.assertEqual(body["label"], "owner")
        self.assertEqual(body["door_action"], "UNLOCK")
        send.assert_called_once_with("door-servo", "OPEN")

    def test_single_sample_does_not_open_door(self):
        self.client.post("/api/ai/face-register", json={
            "label": "owner",
            "image": as_data_url(PNG_1X1_BLACK),
        })

        with patch("ai.face_ai.send_feed_data") as send:
            res = self.client.post(
                "/api/ai/face-recognition",
                json={"image": as_data_url(PNG_1X1_BLACK)},
            )

        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertFalse(body["recognized"])
        self.assertEqual(body["door_action"], "DENY")
        send.assert_not_called()

    def test_low_confidence_does_not_open_door(self):
        for _ in range(3):
            self.client.post("/api/ai/face-register", json={
                "label": "owner",
                "image": as_data_url(PNG_1X1_BLACK),
            })
        os.environ["FACE_CONFIDENCE_THRESHOLD"] = "1.01"

        with patch("ai.face_ai.send_feed_data") as send:
            res = self.client.post(
                "/api/ai/face-recognition",
                json={"image": as_data_url(PNG_1X1_BLACK)},
            )

        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertFalse(body["recognized"])
        self.assertEqual(body["door_action"], "DENY")
        send.assert_not_called()

    def test_delete_face_requires_admin_pin(self):
        self.client.post("/api/ai/face-register", json={
            "label": "owner",
            "image": as_data_url(PNG_1X1_BLACK),
        })

        res = self.client.delete(
            "/api/ai/face-labels/owner",
            json={"admin_pin": "wrong"},
        )

        self.assertEqual(res.status_code, 403)
        self.assertTrue(os.path.isdir(os.path.join(self.data_dir, "owner")))

    def test_delete_face_removes_label_and_model_when_last_face(self):
        for _ in range(3):
            self.client.post("/api/ai/face-register", json={
                "label": "owner",
                "image": as_data_url(PNG_1X1_BLACK),
            })
        self.assertTrue(os.path.isfile(self.model_path))

        res = self.client.delete(
            "/api/ai/face-labels/owner",
            json={"admin_pin": "2468"},
        )

        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["success"])
        self.assertEqual(body["deleted_samples"], 3)
        self.assertFalse(os.path.isdir(os.path.join(self.data_dir, "owner")))
        self.assertFalse(os.path.isfile(self.model_path))

    def test_delete_face_retrains_remaining_labels(self):
        for label in ("owner", "guest"):
            for _ in range(3):
                self.client.post("/api/ai/face-register", json={
                    "label": label,
                    "image": as_data_url(PNG_1X1_BLACK),
                })

        res = self.client.delete(
            "/api/ai/face-labels/guest",
            json={"admin_pin": "2468"},
        )

        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["retrained"])
        self.assertEqual(body["remaining_labels"], ["owner"])
        labels = self.client.get("/api/ai/face-labels").get_json()["faces"]
        self.assertEqual([face["label"] for face in labels], ["owner"])


if __name__ == "__main__":
    unittest.main()
