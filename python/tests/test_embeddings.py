"""Tests for the embedder Protocol contract and blob round-trip helpers."""

import numpy as np

from jobtriage.embeddings import (
    Embedder,
    EmbeddingMatrix,
    decode_blob,
    encode_blob,
)


class FakeEmbedder:
    def __init__(self, dimension: int = 4) -> None:
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed_passages(self, texts: list[str]) -> EmbeddingMatrix:
        return np.array(
            [
                [float(len(text)) + index] * self._dimension
                for index, text in enumerate(texts)
            ],
            dtype=np.float32,
        )

    def embed_query(self, text: str) -> EmbeddingMatrix:
        return np.full((1, self._dimension), float(len(text)), dtype=np.float32)


def test_fake_embedder_satisfies_protocol() -> None:
    fake: Embedder = FakeEmbedder(dimension=3)
    passages = fake.embed_passages(['one', 'two'])
    query = fake.embed_query('hello')
    assert passages.shape == (2, 3)
    assert query.shape == (1, 3)


def test_blob_round_trip_preserves_vector() -> None:
    vector = np.array([0.1, -0.2, 0.3, 0.4], dtype=np.float32)
    blob = encode_blob(vector)
    restored = decode_blob(blob, dimension=4)
    np.testing.assert_array_equal(restored, vector)
