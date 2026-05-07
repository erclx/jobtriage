"""Evaluate command: run the hybrid retrieval ablation over a golden set."""

import json
from dataclasses import asdict
from pathlib import Path
from typing import Annotated

import typer

from jobtriage.embeddings import DEFAULT_MODEL_NAME, SentenceTransformerEmbedder
from jobtriage.evals.golden import load_golden_set
from jobtriage.evals.harness import (
    build_runners,
    evaluate_configuration,
    render_markdown_table,
)
from jobtriage.settings import load_settings
from jobtriage.storage.db import connect

DEFAULT_GOLDEN_PATH = Path(__file__).resolve().parents[3] / 'evals' / 'golden.yaml'


def evaluate_command(
    db: Annotated[
        Path | None, typer.Option('--db', help='Override SQLite database path.')
    ] = None,
    golden: Annotated[
        Path,
        typer.Option('--golden', help='Path to the golden-set YAML.'),
    ] = DEFAULT_GOLDEN_PATH,
    model: Annotated[
        str, typer.Option('--model', help='Sentence-transformers model id.')
    ] = DEFAULT_MODEL_NAME,
    json_out: Annotated[
        Path | None,
        typer.Option('--json-out', help='Optional JSON dump path.'),
    ] = None,
) -> None:
    settings = load_settings()
    db_path = db or settings.db_path

    golden_set = load_golden_set(golden)
    embedder = SentenceTransformerEmbedder(model_name=model)
    embedder.embed_query('warm-up')

    conn = connect(db_path)
    try:
        runners = build_runners(conn, embedder)
        metrics = [
            evaluate_configuration(name, runner, golden_set) for name, runner in runners
        ]
    finally:
        conn.close()

    typer.echo(render_markdown_table(metrics))

    if json_out is not None:
        json_out.parent.mkdir(parents=True, exist_ok=True)
        json_out.write_text(
            json.dumps([asdict(row) for row in metrics], indent=2),
            encoding='utf-8',
        )
        typer.echo(f'\nwrote {json_out}')
