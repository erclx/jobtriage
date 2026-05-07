"""Search command: hybrid retrieval over the local ad corpus."""

from pathlib import Path
from typing import Annotated

import typer

from jobtriage.embeddings import DEFAULT_MODEL_NAME, SentenceTransformerEmbedder
from jobtriage.retrieval import DEFAULT_TOP_K, hybrid_search
from jobtriage.settings import load_settings
from jobtriage.storage.db import connect


def search_command(
    query: Annotated[str, typer.Argument(help='Free-form query string.')],
    db: Annotated[
        Path | None, typer.Option('--db', help='Override SQLite database path.')
    ] = None,
    top_k: Annotated[
        int, typer.Option('--top-k', help='Number of ads to return.')
    ] = DEFAULT_TOP_K,
    model: Annotated[
        str, typer.Option('--model', help='Sentence-transformers model id.')
    ] = DEFAULT_MODEL_NAME,
) -> None:
    settings = load_settings()
    db_path = db or settings.db_path

    embedder = SentenceTransformerEmbedder(model_name=model)
    conn = connect(db_path)
    try:
        results = hybrid_search(conn, query, embedder, top_k=top_k)
    finally:
        conn.close()

    if not results:
        typer.echo('no matches')
        return

    for rank, ad in enumerate(results, start=1):
        deadline = ad.application_deadline or '—'
        location = ad.municipality or '—'
        employer = ad.employer_name or '—'
        typer.echo(
            f'{rank:>2}. [{ad.score:.4f}] {ad.headline}\n'
            f'    {employer} · {location} · deadline {deadline}\n'
            f'    {ad.webpage_url or ""} (id={ad.ad_id})'
        )
