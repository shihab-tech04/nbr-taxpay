import importlib.util
import socket
import tempfile
import tomllib
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("isolate", Path(__file__).with_name("isolate-local-supabase.py"))
isolate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(isolate)

class IsolationTests(unittest.TestCase):
    def test_real_config_only_two_fields_change(self):
        original = Path("supabase/config.toml").read_text()
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "config.toml"
            path.write_text(original)
            port = isolate.prepare(path, "123456", "2")
            expected = tomllib.loads(original)
            expected["project_id"] = "taxpay-ci-123456-2"
            expected["local_smtp"]["port"] = port
            self.assertEqual(tomllib.loads(path.read_text()), expected)
            self.assertNotIn(port, {54324,54321,54322,55433})
            self.assertGreaterEqual(port,1024)
            with socket.socket() as sock:
                sock.bind(("0.0.0.0",port))

    def test_bad_identity_is_rejected_without_mutation(self):
        original = Path("supabase/config.toml").read_text()
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "config.toml"
            path.write_text(original)
            with self.assertRaises(ValueError):
                isolate.prepare(path,"../unsafe","2")
            self.assertEqual(path.read_text(),original)
            modified=original.replace('NBR-TaxPay-responsive-check-20261012','unrelated')
            path.write_text(modified)
            with self.assertRaises(ValueError):
                isolate.prepare(path,"123","2")
            self.assertEqual(path.read_text(),modified)

if __name__ == "__main__":
    unittest.main()
