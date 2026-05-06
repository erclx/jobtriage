"""Paragraph-then-length chunker for ad description text."""

import re

DEFAULT_CHUNK_CHARS = 800

_PARAGRAPH_SPLIT = re.compile(r'\n\s*\n')


def chunk_description(text: str, max_chars: int = DEFAULT_CHUNK_CHARS) -> list[str]:
    if max_chars < 1:
        raise ValueError('max_chars must be >= 1')

    cleaned = text.strip()
    if not cleaned:
        return []

    paragraphs = [p.strip() for p in _PARAGRAPH_SPLIT.split(cleaned) if p.strip()]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for paragraph in paragraphs:
        candidate_len = current_len + len(paragraph) + (2 if current else 0)
        if current and candidate_len > max_chars:
            chunks.append('\n\n'.join(current))
            current = [paragraph]
            current_len = len(paragraph)
        else:
            current.append(paragraph)
            current_len = candidate_len
    if current:
        chunks.append('\n\n'.join(current))

    return _split_oversized(chunks, max_chars)


def _split_oversized(chunks: list[str], max_chars: int) -> list[str]:
    out: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            out.append(chunk)
            continue
        for start in range(0, len(chunk), max_chars):
            out.append(chunk[start : start + max_chars])
    return out
