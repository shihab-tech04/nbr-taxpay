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
    def test_real_config_only_identity_and_ports_change(self):
        original = Path("supabase/config.toml").read_text()
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "config.toml"
            path.write_text(original)
            ports = isolate.prepare(path, "123456", "2")
            expected = tomllib.loads(original)
            expected["project_id"] = "taxpay-ci-123456-2"
            for section, key, name in [("api", "port", "API"), ("db", "port", "DB"),
                ("db", "shadow_port", "SHADOW"), ("studio", "port", "STUDIO"),
                ("local_smtp", "port", "SMTP"), ("db.pooler", "port", "POOLER"),
                ("edge_runtime", "inspector_port", "INSPECTOR"), ("analytics", "port", "ANALYTICS")]:
                target = expected
                for part in section.split("."):
                    target = target[part]
                target[key] = ports[name]
            self.assertEqual(tomllib.loads(path.read_text()), expected)
            self.assertEqual(len(set(ports.values())), 8)
            self.assertTrue(set(ports.values()).isdisjoint({4173,4174,8083,54320,54321,54322,54323,54324,54325,54326,54327,54329,55433}))
            with socket.socket() as sock:
                sock.bind(("0.0.0.0",ports["DB"]))

    def test_does_not_reuse_an_occupied_port(self):
        original = Path("supabase/config.toml").read_text()
        with tempfile.TemporaryDirectory() as root, socket.socket() as listener:
            listener.bind(("0.0.0.0", 0))
            occupied = listener.getsockname()[1]
            path = Path(root) / "config.toml"
            path.write_text(original)
            ports = isolate.prepare(path, "123456", "3")
            self.assertNotIn(occupied, ports.values())
            self.assertEqual(listener.getsockname()[1], occupied)

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
