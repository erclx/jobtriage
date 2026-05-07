"""Dump the FastAPI OpenAPI schema to python/openapi.json for type-gen consumers."""

import json
from pathlib import Path

from jobtriage.api.app import app_factory


def main() -> None:
    app = app_factory()
    schema = app.openapi()
    target = Path(__file__).resolve().parents[1] / 'openapi.json'
    target.write_text(
        json.dumps(schema, indent=2, sort_keys=True) + '\n', encoding='utf-8'
    )
    print(f'wrote {target}')


if __name__ == '__main__':
    main()
