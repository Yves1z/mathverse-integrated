"""Verify a release and forbid database migration changes before extracting it."""
import argparse
import hashlib
import io
from pathlib import Path, PurePosixPath
import shutil
import tarfile
import zipfile


def migrations(jar):
    with zipfile.ZipFile(jar) as archive:
        prefix = "BOOT-INF/classes/db/migration/"
        result = {name[len(prefix):]: archive.read(name)
                  for name in archive.namelist()
                  if name.startswith(prefix) and name.endswith(".sql")}
    if not result:
        raise ValueError("No Flyway migrations found in application JAR")
    return result


def verify_and_extract(release, current_jar, destination):
    destination = Path(destination)
    if not destination.is_dir() or destination.is_symlink() or any(destination.iterdir()):
        raise ValueError("Extraction directory must exist and be empty")
    with tarfile.open(release, "r:gz") as archive:
        members = archive.getmembers()
        names = [member.name for member in members]
        if len(names) != len(set(names)) or len(names) > 5000:
            raise ValueError("Duplicate or excessive archive entries")
        if sum(member.size for member in members) > 1024 * 1024 * 1024:
            raise ValueError("Release exceeds the extraction size limit")
        for member in members:
            path = PurePosixPath(member.name)
            if (not member.isfile() or path.is_absolute() or ".." in path.parts
                    or "\\" in member.name or member.name != str(path)
                    or not (member.name in {"app.jar", "SHA256SUMS"}
                            or member.name.startswith("frontend/"))):
                raise ValueError("Unsafe release entry: " + member.name)
        required = {"app.jar", "frontend/index.html", "SHA256SUMS"}
        if not required.issubset(names):
            raise ValueError("Release is missing required application files")
        checksums = {}
        for line in archive.extractfile("SHA256SUMS").read().decode("utf-8").splitlines():
            digest, name = line.split("  ", 1)
            if name in checksums or len(digest) != 64:
                raise ValueError("Invalid checksum manifest")
            checksums[name] = digest
        if set(checksums) != set(names) - {"SHA256SUMS"}:
            raise ValueError("Checksum manifest does not match release contents")
        for name, expected in checksums.items():
            digest = hashlib.sha256()
            with archive.extractfile(name) as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b""):
                    digest.update(chunk)
            if digest.hexdigest() != expected:
                raise ValueError("Checksum mismatch: " + name)
        candidate = migrations(io.BytesIO(archive.extractfile("app.jar").read()))
        current = migrations(current_jar)
        if candidate != current:
            changed = sorted(name for name in set(candidate) | set(current)
                             if candidate.get(name) != current.get(name))
            raise ValueError("Database migrations differ; deployment stopped: " + ", ".join(changed))
        # No files are written until every integrity and migration check passes.
        for member in members:
            target = destination.joinpath(*PurePosixPath(member.name).parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(member) as source, target.open("xb") as output:
                shutil.copyfileobj(source, output)
            target.chmod(0o644)
    return len(checksums), len(candidate)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("release")
    parser.add_argument("current_jar")
    parser.add_argument("destination")
    args = parser.parse_args()
    try:
        count, migration_count = verify_and_extract(args.release, args.current_jar, args.destination)
    except (ValueError, OSError, tarfile.TarError, zipfile.BadZipFile, KeyError) as error:
        parser.exit(1, "Preflight failed: " + str(error) + "\n")
    print(f"Verified {count} files; all {migration_count} migrations match the running application.")
