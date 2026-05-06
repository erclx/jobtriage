"""Tests for the description chunker."""

from jobtriage.storage.chunking import chunk_description


def test_empty_text_returns_no_chunks() -> None:
    assert chunk_description('') == []
    assert chunk_description('   \n  ') == []


def test_single_short_paragraph_yields_one_chunk() -> None:
    chunks = chunk_description('A short ad body.')
    assert chunks == ['A short ad body.']


def test_paragraphs_under_cap_merge_into_single_chunk() -> None:
    text = 'Para one.\n\nPara two.\n\nPara three.'
    chunks = chunk_description(text, max_chars=200)
    assert chunks == ['Para one.\n\nPara two.\n\nPara three.']


def test_paragraphs_over_cap_split_on_paragraph_boundary() -> None:
    paragraph = 'x' * 60
    text = '\n\n'.join([paragraph] * 4)
    chunks = chunk_description(text, max_chars=130)
    assert len(chunks) == 2
    assert all(len(chunk) <= 130 for chunk in chunks)


def test_oversized_single_paragraph_is_force_split() -> None:
    text = 'x' * 300
    chunks = chunk_description(text, max_chars=100)
    assert len(chunks) == 3
    assert all(len(chunk) <= 100 for chunk in chunks)
