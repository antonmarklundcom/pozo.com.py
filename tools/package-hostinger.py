from __future__ import annotations

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


PROJECT_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = PROJECT_ROOT.parent
ZIP_PATH = WORKSPACE_ROOT / "pozo-com-py-hostinger-ready-2026-09-28.zip"

DEPLOY_DIRS = ("assets", "config", "contacto", "gracias", "servicios", "zonas", "privacidad")
ROOT_FILES = (".htaccess", "404.html", "contacto.php", "favicon.svg", "index.html", "robots.txt", "sitemap.xml")


def deploy_files() -> list[Path]:
    files = [PROJECT_ROOT / name for name in ROOT_FILES]
    for directory in DEPLOY_DIRS:
        files.extend(path for path in (PROJECT_ROOT / directory).rglob("*") if path.is_file())
    return sorted(files, key=lambda path: path.relative_to(PROJECT_ROOT).as_posix())


files = deploy_files()
missing = [path for path in files if not path.is_file()]
if missing:
    raise SystemExit(f"Missing deploy files: {missing}")

if ZIP_PATH.exists():
    ZIP_PATH.unlink()

with ZipFile(ZIP_PATH, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
    for path in files:
        archive.write(path, path.relative_to(PROJECT_ROOT).as_posix())

with ZipFile(ZIP_PATH, "r") as archive:
    names = archive.namelist()
    corrupt = archive.testzip()
    if corrupt:
        raise SystemExit(f"Corrupt ZIP entry: {corrupt}")
    if "index.html" not in names or "contacto.php" not in names:
        raise SystemExit("ZIP is missing a root entrypoint or contact handler")
    if any("\\" in name for name in names):
        raise SystemExit("ZIP contains Windows-style entry names")

print(ZIP_PATH)
print(f"entries={len(names)} testzip=PASS root=index.html")
