"""Offline tests: no HF requests, GPU, credentials or user photos."""

import importlib
import os
import base64
from concurrent.futures import CancelledError as FutureCancelled
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

import app as service
from model_client import MODEL_WAIT_SECONDS, HuggingFaceModel, LocalGradioModel, ModelError, ModelTimeout, describe_failure, download_image, validate_image_url
from results import ResultStore


PAYLOAD = {
    "userPhotoUrl": "https://i.pinimg.com/person.jpg",
    "garmentImageUrl": "https://i.pinimg.com/garment.jpg",
}
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJYQAAAAASUVORK5CYII=")
RESULT = "data:image/png;base64," + base64.b64encode(PNG).decode()


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "TRYON_MODE": "mock", "TRYON_IMAGE_HOSTS": "i.pinimg.com",
            "HF_SPACE_ID": "yisol/IDM-VTON",
        })
        self.environment.start()
        importlib.reload(service)
        self.scratch = TemporaryDirectory()
        service.exports = ResultStore(Path(self.scratch.name))
        self.client = TestClient(service.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.environment.stop()
        self.scratch.cleanup()

    def test_health(self):
        self.assertEqual(self.client.get("/health").json(), {"ok": True})

    def test_mock_contract_without_network(self):
        with patch("model_client.download_image", side_effect=AssertionError("Network forbidden")):
            response = self.client.post("/tryon", json=PAYLOAD)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["resultImageUrl"], PAYLOAD["garmentImageUrl"])
        self.assertGreaterEqual(response.json()["latencyMs"], 0)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_reject_invalid_or_missing_input(self):
        for body in ({}, {**PAYLOAD, "userPhotoUrl": "http://127.0.0.1/private"},
                     {**PAYLOAD, "unexpected": True}):
            with self.subTest(body=body):
                response = self.client.post("/tryon", json=body)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(set(response.json()), {"error"})

    def test_malformed_json(self):
        self.assertEqual(self.client.post("/tryon", content="{").status_code, 400)

    def test_oversized_body(self):
        self.assertEqual(self.client.post("/tryon", content=b"x" * 17000).status_code, 413)

    def test_busy(self):
        service.lock.acquire()
        try:
            self.assertEqual(self.client.post("/tryon", json=PAYLOAD).status_code, 503)
        finally:
            service.lock.release()

    def test_upload_mock_accepts_files_without_urls(self):
        image = PNG
        response = self.client.post("/tryon/upload", files={
            "person": ("person.png", image, "image/png"),
            "garment": ("garment.png", image, "image/png"),
        })
        self.assertEqual(response.status_code, 200)
        result_url = response.json()["resultImageUrl"]
        self.assertIn("/results/", result_url)
        self.assertEqual(self.client.get(result_url).content, PNG)
        self.assertIn("attachment", self.client.get(result_url + "?download=true").headers["content-disposition"])

    def test_upload_rejects_missing_or_invalid_images(self):
        response = self.client.post("/tryon/upload", files={
            "person": ("person.png", b"not an image", "image/png"),
            "garment": ("garment.png", b"not an image", "image/png"),
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())
        self.assertEqual(self.client.post("/tryon/upload", files={
            "person": ("person.png", b"not an image", "image/png"),
        }).status_code, 400)

    def test_upload_per_file_size_limit(self):
        response = self.client.post("/tryon/upload", files={
            "person": ("person.png", b"x" * (8 * 1024 * 1024 + 1), "image/png"),
            "garment": ("garment.png", b"\x89PNG\r\n\x1a\nfixture", "image/png"),
        })
        self.assertEqual(response.status_code, 400)

    def test_upload_calls_remote_adapter(self):
        from unittest.mock import Mock

        image = b"\x89PNG\r\n\x1a\nfixture"
        with patch.object(service, "MODE", "huggingface"):
            model = Mock()
            model.generate_images.return_value = RESULT
            service.app.state.model = model
            response = self.client.post("/tryon/upload", files={
                "person": ("person.png", image, "image/png"),
                "garment": ("garment.png", image, "image/png"),
            })
            self.assertEqual(response.status_code, 200)
            model.generate_images.assert_called_once_with((image, "image/png"), (image, "image/png"))

    def test_remote_result_and_errors_release_lock(self):
        with patch.object(service, "MODE", "huggingface"):
            from unittest.mock import Mock

            model = Mock()
            service.app.state.model = model
            for failure, status in ((ModelTimeout("private"), 504), (ValueError("secret"), 502)):
                model.generate.side_effect = failure
                response = self.client.post("/tryon", json=PAYLOAD)
                self.assertEqual(response.status_code, status)
                self.assertNotIn(str(failure), response.text)
                self.assertFalse(service.lock.locked())
            model.generate.side_effect = None
            model.generate.return_value = RESULT
            response = self.client.post("/tryon", json=PAYLOAD)
            self.assertEqual(response.status_code, 200)
            model.generate.assert_called_with(PAYLOAD["userPhotoUrl"], PAYLOAD["garmentImageUrl"])

    def test_upload_page_and_assets(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        page = self.client.get("/tryon/upload")
        self.assertEqual(page.status_code, 200)
        self.assertIn("Télécharger", page.text)
        self.assertIn("default-src 'self'", page.headers["content-security-policy"])
        self.assertEqual(self.client.get("/tryon/assets/upload.js").status_code, 200)
        self.assertEqual(self.client.get("/tryon/assets/app.py").status_code, 404)

    def test_local_missing_engine_is_explicit(self):
        with patch.object(service, "MODE", "local"), patch.dict(os.environ, {"TRYON_LOCAL_URL": ""}):
            service.app.state.model = None
            response = self.client.post("/tryon/upload", files={
                "person": ("person.png", PNG, "image/png"),
                "garment": ("garment.png", PNG, "image/png"),
            })
            self.assertEqual(response.status_code, 502)
            self.assertIn("Aucun moteur local configuré", response.json()["error"])
            self.assertEqual(response.headers["x-tryon-mode"], "local")

    def test_result_links_expire_and_block_paths(self):
        self.assertEqual(self.client.get("/results/not-an-id.png").status_code, 404)
        result_id = service.exports.save(RESULT)
        path = Path(self.scratch.name) / result_id
        os.utime(path, (0, 0))
        self.assertEqual(self.client.get(f"/results/{result_id}").status_code, 404)
        self.assertFalse(path.exists())

    def test_status_distinguishes_simulation(self):
        response = self.client.get("/tryon/status")
        self.assertEqual(response.json()["mode"], "mock")
        self.assertIn("simulation", response.json()["message"])


class HuggingFaceClientTests(unittest.TestCase):
    def test_constructor_matches_installed_gradio_signature(self):
        # autospec checks the real installed signature without contacting Hugging Face.
        with patch("gradio_client.Client.__init__", autospec=True, return_value=None) as constructor:
            model = HuggingFaceModel("yisol/IDM-VTON", "dummy-test-token", {"i.pinimg.com"})
        self.assertEqual(constructor.call_args.kwargs["token"], "dummy-test-token")
        self.assertFalse(constructor.call_args.kwargs["download_files"])
        timeout = constructor.call_args.kwargs["httpx_kwargs"]["timeout"]
        self.assertEqual(timeout.connect, 10.0)
        self.assertEqual(timeout.write, 20.0)
        self.assertEqual(timeout.pool, 10.0)
        self.assertGreater(timeout.read, MODEL_WAIT_SECONDS)
        self.assertEqual(model.space_host, "yisol-idm-vton.hf.space")

    def test_local_engine_does_not_send_hugging_face_token(self):
        with patch("gradio_client.Client.__init__", autospec=True, return_value=None) as constructor:
            LocalGradioModel("http://127.0.0.1:7860", {"i.pinimg.com"})
        self.assertIs(constructor.call_args.kwargs["token"], False)
        self.assertIs(constructor.call_args.kwargs["analytics_enabled"], False)
        self.assertGreater(constructor.call_args.kwargs["httpx_kwargs"]["timeout"].read, MODEL_WAIT_SECONDS)

    def test_local_engine_rejects_external_endpoint(self):
        with self.assertRaises(ModelError):
            LocalGradioModel("http://attacker.example", set())

    def test_provider_error_is_actionable_and_redacted(self):
        error = describe_failure(ValueError("401 Unauthorized secret-token"))
        self.assertIn("refuse l'accès", str(error))
        self.assertNotIn("secret-token", str(error))

    def test_read_timeout_stays_specific_when_wrapped_by_provider(self):
        for failure in (
            httpx.ReadTimeout("private-url secret-token"),
            RuntimeError("httpx.ReadTimeout: The read operation timed out secret-token"),
        ):
            with self.subTest(failure=type(failure).__name__):
                error = describe_failure(failure)
                self.assertIsInstance(error, ModelTimeout)
                self.assertIn("délai", str(error))
                self.assertNotIn("secret-token", str(error))

    def test_broken_gradio_stream_has_a_specific_safe_message(self):
        error = describe_failure(FutureCancelled("private-url secret-token"))
        self.assertIn("connexion au moteur", str(error).lower())
        self.assertNotIn("secret-token", str(error))

    def test_job_deadline_is_preserved_and_cancellation_is_best_effort(self):
        from unittest.mock import Mock

        with patch("gradio_client.Client.__init__", autospec=True, return_value=None):
            model = HuggingFaceModel("yisol/IDM-VTON", None, set())
        model.client = Mock()
        model.client.submit.return_value.result.side_effect = TimeoutError("secret-token")
        model.client.submit.return_value.cancel.side_effect = RuntimeError("secret-cancel-error")
        with self.assertRaises(ModelTimeout) as context:
            model.generate_images((PNG, "image/png"), (PNG, "image/png"))
        self.assertNotIn("secret", str(context.exception))
        model.client.submit.return_value.result.assert_called_once_with(timeout=MODEL_WAIT_SECONDS)
        model.client.submit.return_value.cancel.assert_called_once_with()

    def test_remote_output_and_cleanup(self):
        from unittest.mock import Mock

        with patch("gradio_client.Client.__init__", autospec=True, return_value=None):
            model = HuggingFaceModel("yisol/IDM-VTON", None, set())
        model.client = Mock()
        model.client.submit.return_value.result.return_value = ({"url": "https://yisol-idm-vton.hf.space/file=result.png"}, {})
        with patch("model_client.download_image", return_value=(PNG, "image/png")):
            self.assertEqual(model.generate_images((PNG, "image/png"), (PNG, "image/png")), RESULT)
        arguments = model.client.submit.call_args.args
        self.assertEqual(model.client.submit.call_args.kwargs["api_name"], "/tryon")
        self.assertFalse(Path(arguments[0]["background"]["path"]).exists())


class ResultStoreTests(unittest.TestCase):
    def test_only_keep_twenty_private_exports(self):
        with TemporaryDirectory() as directory:
            store = ResultStore(Path(directory))
            for _ in range(24):
                store.save(RESULT)
            self.assertEqual(len(list(Path(directory).iterdir())), 20)
            self.assertIsNone(store.find("../../app.py"))
            self.assertTrue(all((path.stat().st_mode & 0o777) == 0o600 for path in Path(directory).iterdir()))

    def test_rejects_non_images(self):
        with TemporaryDirectory() as directory:
            store = ResultStore(Path(directory))
            for data in ("https://example.com/a.png", "data:image/png;base64,%%%", "data:image/png;base64,aGVsbG8="):
                with self.assertRaises(ValueError):
                    store.save(data)


class ImageSafetyTests(unittest.TestCase):
    def test_exact_https_hosts(self):
        for url in ("http://i.pinimg.com/a", "https://127.0.0.1/a", "file:///etc/passwd",
                    "https://i.pinimg.com.attacker.example/a", "https://user:pass@i.pinimg.com/a",
                    "https://i.pinimg.com:8000/a", "https://i.pinimg.com/a#fragment"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_image_url(url, {"i.pinimg.com"})

    def test_download_rejects_redirect_nonimage_and_oversize(self):
        for status, headers, content in (
            (302, {"location": "http://127.0.0.1/private"}, b""),
            (200, {"content-type": "text/html"}, b"html"),
            (200, {"content-type": "image/png"}, b"x" * (8 * 1024 * 1024 + 1)),
        ):
            with self.subTest(status=status, headers=headers):
                response = httpx.Response(status, headers=headers, content=content,
                                          request=httpx.Request("GET", PAYLOAD["userPhotoUrl"]))
                with patch("model_client.httpx.Client") as client:
                    client.return_value.__enter__.return_value.stream.return_value.__enter__.return_value = response
                    with self.assertRaises((httpx.HTTPStatusError, ModelError)):
                        download_image(PAYLOAD["userPhotoUrl"], {"i.pinimg.com"})


if __name__ == "__main__":
    unittest.main()
