import hashlib
import sqlite3
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime

from jobtriage.jobtech.models import Ad
from jobtriage.storage.chunking import chunk_description


@dataclass(frozen=True, slots=True)
class IngestResult:
    inserted: int
    updated: int
    deactivated: int


def ingest_ads(
    conn: sqlite3.Connection,
    ads: Iterable[Ad],
    filter_signature: str,
    now: datetime | None = None,
) -> IngestResult:
    timestamp = (now or datetime.now()).isoformat(timespec='seconds')
    seen_ids: set[str] = set()
    inserted = 0
    updated = 0

    for ad in ads:
        seen_ids.add(ad.id)
        description = ad.description_text
        description_hash = _hash(description)
        existing = conn.execute(
            'SELECT description_hash FROM ads WHERE id = ?', (ad.id,)
        ).fetchone()

        row = _ad_to_row(ad, description, description_hash, timestamp, filter_signature)

        if existing is None:
            conn.execute(_INSERT_AD, row)
            _write_chunks(conn, ad.id, description)
            inserted += 1
        else:
            conn.execute(_UPDATE_AD, row)
            if existing['description_hash'] != description_hash:
                conn.execute('DELETE FROM ad_chunks WHERE ad_id = ?', (ad.id,))
                _write_chunks(conn, ad.id, description)
            updated += 1

    deactivated = _deactivate_missing(conn, filter_signature, seen_ids, timestamp)
    conn.commit()
    return IngestResult(inserted=inserted, updated=updated, deactivated=deactivated)


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def _ad_to_row(
    ad: Ad,
    description: str,
    description_hash: str,
    timestamp: str,
    filter_signature: str,
) -> dict[str, object]:
    return {
        'id': ad.id,
        'headline': ad.headline,
        'employer_name': ad.employer.name if ad.employer else None,
        'municipality': ad.workplace_address.municipality
        if ad.workplace_address
        else None,
        'region': ad.workplace_address.region if ad.workplace_address else None,
        'occupation_label': ad.occupation.label if ad.occupation else None,
        'occupation_concept_id': ad.occupation.concept_id if ad.occupation else None,
        'application_deadline': ad.application_deadline.isoformat()
        if ad.application_deadline
        else None,
        'publication_date': ad.publication_date.isoformat()
        if ad.publication_date
        else None,
        'webpage_url': ad.webpage_url,
        'description_text': description,
        'description_hash': description_hash,
        'first_seen': timestamp,
        'last_seen': timestamp,
        'last_filter_signature': filter_signature,
        'is_active': 1,
    }


_INSERT_AD = """
INSERT INTO ads (
    id, headline, employer_name, municipality, region,
    occupation_label, occupation_concept_id, application_deadline,
    publication_date, webpage_url, description_text, description_hash,
    first_seen, last_seen, last_filter_signature, is_active
) VALUES (
    :id, :headline, :employer_name, :municipality, :region,
    :occupation_label, :occupation_concept_id, :application_deadline,
    :publication_date, :webpage_url, :description_text, :description_hash,
    :first_seen, :last_seen, :last_filter_signature, :is_active
)
"""

_UPDATE_AD = """
UPDATE ads SET
    headline = :headline,
    employer_name = :employer_name,
    municipality = :municipality,
    region = :region,
    occupation_label = :occupation_label,
    occupation_concept_id = :occupation_concept_id,
    application_deadline = :application_deadline,
    publication_date = :publication_date,
    webpage_url = :webpage_url,
    description_text = :description_text,
    description_hash = :description_hash,
    last_seen = :last_seen,
    last_filter_signature = :last_filter_signature,
    is_active = 1
WHERE id = :id
"""


def _write_chunks(conn: sqlite3.Connection, ad_id: str, description: str) -> None:
    chunks = chunk_description(description)
    if not chunks:
        return
    conn.executemany(
        'INSERT INTO ad_chunks (ad_id, chunk_index, chunk_text) VALUES (?, ?, ?)',
        [(ad_id, index, text) for index, text in enumerate(chunks)],
    )


def _deactivate_missing(
    conn: sqlite3.Connection,
    filter_signature: str,
    seen_ids: set[str],
    timestamp: str,
) -> int:
    rows = conn.execute(
        'SELECT id FROM ads WHERE last_filter_signature = ? AND is_active = 1',
        (filter_signature,),
    ).fetchall()
    missing = [row['id'] for row in rows if row['id'] not in seen_ids]
    if not missing:
        return 0
    placeholders = ','.join('?' * len(missing))
    conn.execute(
        f'UPDATE ads SET is_active = 0, last_seen = ? WHERE id IN ({placeholders})',
        (timestamp, *missing),
    )
    return len(missing)
