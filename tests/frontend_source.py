from pathlib import Path


def frontend_source(root: Path) -> str:
    """Return the public frontend contract across the HTML shell, CSS, and ES modules."""
    app = root / "app"
    parts = [
        (app / "dashboard.html").read_text(encoding="utf-8"),
        (app / "css" / "dashboard.css").read_text(encoding="utf-8"),
    ]
    js_root = app / "js"
    for path in sorted(js_root.rglob("*.js")):
        parts.append(path.read_text(encoding="utf-8"))
    return "\n".join(parts)
