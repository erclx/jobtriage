"""Evaluate-embeddings command: compare three embedding models on the golden set."""

import gc
import json
from dataclasses import asdict
from pathlib import Path
from typing import Annotated

import typer

from jobtriage.embeddings import (
    DEFAULT_MODEL_NAME,
    ENGLISH_BASELINE_MODEL_NAME,
    MULTILINGUAL_E5_LARGE_MODEL_NAME,
    SentenceTransformerEmbedder,
)
from jobtriage.evals.golden import load_golden_set
from jobtriage.evals.harness import (
    EmbeddingAblationRow,
    evaluate_embedding_ablation,
    render_embedding_ablation_table,
)
from jobtriage.settings import load_settings
from jobtriage.storage.db import connect

DEFAULT_GOLDEN_PATH = Path(__file__).resolve().parents[3] / 'evals' / 'golden.yaml'

ABLATION_MODEL_NAMES = (
    DEFAULT_MODEL_NAME,
    MULTILINGUAL_E5_LARGE_MODEL_NAME,
    ENGLISH_BASELINE_MODEL_NAME,
)


def evaluate_embeddings_command(
    db: Annotated[
        Path | None, typer.Option('--db', help='Override SQLite database path.')
    ] = None,
    golden: Annotated[
        Path,
        typer.Option('--golden', help='Path to the golden-set YAML.'),
    ] = DEFAULT_GOLDEN_PATH,
    json_out: Annotated[
        Path | None,
        typer.Option('--json-out', help='Optional JSON dump path.'),
    ] = None,
) -> None:
    settings = load_settings()
    db_path = db or settings.db_path

    golden_set = load_golden_set(golden)

    conn = connect(db_path)
    rows: list[EmbeddingAblationRow] = []
    try:
        for model_name in ABLATION_MODEL_NAMES:
            typer.echo(f'loading {model_name}...', err=True)
            embedder = SentenceTransformerEmbedder(model_name=model_name)
            embedder.embed_query('warm-up')
            rows.append(
                evaluate_embedding_ablation(conn, embedder, model_name, golden_set)
            )
            del embedder
            gc.collect()
    finally:
        conn.close()

    typer.echo(render_embedding_ablation_table(rows))

    if json_out is not None:
        json_out.parent.mkdir(parents=True, exist_ok=True)
        json_out.write_text(
            json.dumps(
                [
                    {
                        'model_name': row.model_name,
                        'dimension': row.dimension,
                        'dense': asdict(row.dense_metrics),
                        'hybrid': asdict(row.hybrid_metrics),
                    }
                    for row in rows
                ],
                indent=2,
            ),
            encoding='utf-8',
        )
        typer.echo(f'\nwrote {json_out}')
