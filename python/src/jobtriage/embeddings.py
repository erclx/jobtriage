"""Multilingual embedding wrapper with e5 prefix conventions."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, cast

import numpy as np
from numpy.typing import NDArray

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

DEFAULT_MODEL_NAME = 'intfloat/multilingual-e5-base'
MULTILINGUAL_E5_LARGE_MODEL_NAME = 'intfloat/multilingual-e5-large'
ENGLISH_BASELINE_MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'

PASSAGE_PREFIX = 'passage: '
QUERY_PREFIX = 'query: '

EmbeddingMatrix = NDArray[np.float32]


class Embedder(Protocol):
    @property
    def dimension(self) -> int: ...

    def embed_passages(self, texts: list[str]) -> EmbeddingMatrix: ...

    def embed_query(self, text: str) -> EmbeddingMatrix: ...


class SentenceTransformerEmbedder:
    def __init__(self, model_name: str = DEFAULT_MODEL_NAME) -> None:
        self._model_name = model_name
        self._model: SentenceTransformer | None = None

    @property
    def dimension(self) -> int:
        model = self._load()
        getter = getattr(model, 'get_embedding_dimension', None) or (
            model.get_sentence_embedding_dimension
        )
        return cast(int, getter())

    def embed_passages(self, texts: list[str]) -> EmbeddingMatrix:
        if not texts:
            return np.empty((0, self.dimension), dtype=np.float32)
        prefixed = [PASSAGE_PREFIX + text for text in texts]
        return self._encode(prefixed)

    def embed_query(self, text: str) -> EmbeddingMatrix:
        return self._encode([QUERY_PREFIX + text])

    def _encode(self, texts: list[str]) -> EmbeddingMatrix:
        result = self._load().encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        return cast(EmbeddingMatrix, np.asarray(result, dtype=np.float32))

    def _load(self) -> SentenceTransformer:
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self._model_name)
        return self._model


def encode_blob(vector: EmbeddingMatrix) -> bytes:
    return np.ascontiguousarray(vector, dtype=np.float32).tobytes()


def decode_blob(blob: bytes, dimension: int) -> EmbeddingMatrix:
    array = np.frombuffer(blob, dtype=np.float32)
    if array.size != dimension:
        raise ValueError(
            f'embedding blob size {array.size} does not match dimension {dimension}'
        )
    return array
