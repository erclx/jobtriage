"""Index command: backfill embeddings for chunks that lack them."""

import sqlite3
from pathlib import Path
from typing import Annotated

import typer

from jobtriage.embeddings import (
    DEFAULT_MODEL_NAME,
    Embedder,
    SentenceTransformerEmbedder,
    encode_blob,
)
from jobtriage.settings import load_settings
from jobtriage.storage.db import connect

DEFAULT_BATCH_SIZE = 32


def index_command(
    db: Annotated[
        Path | None, typer.Option('--db', help='Override SQLite database path.')
    ] = None,
    model: Annotated[
        str, typer.Option('--model', help='Sentence-transformers model id.')
    ] = DEFAULT_MODEL_NAME,
    batch_size: Annotated[
        int, typer.Option('--batch-size', help='Encoder batch size.')
    ] = DEFAULT_BATCH_SIZE,
) -> None:
    settings = load_settings()
    db_path = db or settings.db_path

    embedder = SentenceTransformerEmbedder(model_name=model)
    conn = connect(db_path)
    try:
        encoded = embed_pending_chunks(conn, embedder, batch_size=batch_size)
    finally:
        conn.close()

    typer.echo(f'index complete: encoded={encoded} db={db_path}')


def embed_pending_chunks(
    conn: sqlite3.Connection,
    embedder: Embedder,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> int:
    if batch_size < 1:
        raise ValueError('batch_size must be >= 1')

    pending = conn.execute(
        """
        SELECT ad_id, chunk_index, chunk_text
        FROM ad_chunks
        WHERE embedding IS NULL
        ORDER BY ad_id, chunk_index
        """
    ).fetchall()
    if not pending:
        return 0

    encoded = 0
    for start in range(0, len(pending), batch_size):
        batch = pending[start : start + batch_size]
        vectors = embedder.embed_passages([row['chunk_text'] for row in batch])
        conn.executemany(
            'UPDATE ad_chunks SET embedding = ? WHERE ad_id = ? AND chunk_index = ?',
            [
                (encode_blob(vectors[idx]), row['ad_id'], row['chunk_index'])
                for idx, row in enumerate(batch)
            ],
        )
        encoded += len(batch)
    conn.commit()
    return encoded
