import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("verifier", Path(__file__).parents[1] / "verify-admin-beta-release.py")
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def jar(sql=b"CREATE TABLE example(id int);"):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("BOOT-INF/classes/db/migration/V1__example.sql", sql)
    return buffer.getvalue()


class ReleaseVerificationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.current = self.root / "current.jar"
        self.current.write_bytes(jar())
        self.output = self.root / "output"
        self.output.mkdir()

    def release(self, files=None, tamper=False, duplicate=False, link=False):
        files = files or {"app.jar": jar(), "frontend/index.html": b"<html></html>"}
        checksums = "".join(hashlib.sha256(data).hexdigest() + "  " + name + "\n" for name, data in files.items()).encode()
        if tamper:
            files = {**files, "frontend/index.html": b"modified"}
        target = self.root / "release.tar.gz"
        with tarfile.open(target, "w:gz") as archive:
            for name, data in [*files.items(), ("SHA256SUMS", checksums)]:
                info = tarfile.TarInfo(name)
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
            if duplicate:
                info = tarfile.TarInfo("frontend/index.html")
                archive.addfile(info, io.BytesIO())
            if link:
                info = tarfile.TarInfo("frontend/link")
                info.type = tarfile.SYMTYPE
                info.linkname = "/etc/passwd"
                archive.addfile(info)
        return target

    def reject(self, release):
        with self.assertRaises(ValueError):
            verifier.verify_and_extract(release, self.current, self.output)
        self.assertEqual(list(self.output.iterdir()), [])

    def test_verified_release_extracts(self):
        self.assertEqual(verifier.verify_and_extract(self.release(), self.current, self.output), (2, 1))
        self.assertEqual((self.output / "app.jar").read_bytes(), jar())

    def test_migration_change_stops_before_writes(self):
        self.reject(self.release({"app.jar": jar(b"ALTER TABLE example ADD COLUMN x int;"), "frontend/index.html": b"ok"}))

    def test_checksum_mismatch_stops_before_writes(self):
        self.reject(self.release(tamper=True))

    def test_path_traversal_stops_before_writes(self):
        self.reject(self.release({"app.jar": jar(), "frontend/index.html": b"ok", "frontend/../../escape": b"bad"}))

    def test_duplicate_entry_is_rejected(self):
        self.reject(self.release(duplicate=True))

    def test_symlink_is_rejected(self):
        self.reject(self.release(link=True))

    def test_missing_index_is_rejected(self):
        self.reject(self.release({"app.jar": jar()}))

    def test_existing_destination_is_retained(self):
        (self.output / "retain").write_text("keep")
        with self.assertRaises(ValueError):
            verifier.verify_and_extract(self.release(), self.current, self.output)
        self.assertEqual((self.output / "retain").read_text(), "keep")


if __name__ == "__main__":
    unittest.main()
