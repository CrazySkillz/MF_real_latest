"""Internal pipe only: read verified export, emit selected ciphertext to the local verifier.

No extraction, plaintext tokens, database, network, key input or writes.
"""
import hashlib
import json
import re
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PRIVATE = ROOT / 'audit-temp/v1-batch8-render-restore-private-20261029'
SOURCE = Path(r'C:\Users\me\Downloads\2026-10-29T14_05Z.dir.tar.gz')
HASH = 'aeadd0ca9ff0caaa81960c00f5a81aa8739671e8f72f8ea74f3d6bc2ca8a3ae9'
TARGETS = {'b74f98af-ede9-47af-9b19-0720ebb4d2c0': 'Promo',
           '36493a43-accd-4360-8ff2-de62f5a19b6e': 'V1 Batch 5 Test'}
FAMILIES = {'ga4_connections', 'hubspot_connections', 'salesforce_connections', 'shopify_connections'}


def uncopy(value):
    if value == b'\\N':
        return None
    # These fields are IDs, JSON and known campaign names: reject unsupported COPY escapes.
    out = bytearray()
    i = 0
    escapes = {92: 92, 110: 10, 114: 13, 116: 9, 98: 8, 102: 12, 118: 11}
    while i < len(value):
        if value[i] != 92:
            out.append(value[i])
        else:
            i += 1
            assert i < len(value) and value[i] in escapes
            out.append(escapes[value[i]])
        i += 1
    return out.decode('utf-8')


def read():
    assert ROOT.name == 'MF_real_latest' and sys.argv[1:] == ['--private-pipe']
    assert not SOURCE.is_symlink() and SOURCE.stat().st_size == 308867013
    initial = SOURCE.stat()
    with SOURCE.open('rb') as stream:
        assert hashlib.file_digest(stream, 'sha256').hexdigest() == HASH
    schema = (PRIVATE / 'schema.sql').read_bytes()
    assert hashlib.sha256(schema).hexdigest() == '72f20b25a0917126b5df5e22f646bd4ddfe30943ff89f4bace26ca29ad034b1b'
    columns = {table.decode(): re.findall(rb'^    "([a-z_][a-z0-9_]*)" ', body, re.M)
               for table, body in re.findall(rb'CREATE TABLE "public"\."([a-z_][a-z0-9_]*)" \((.*?)\n\);', schema, re.S)}
    wanted = FAMILIES | {'campaigns', 'clients'}
    toc = (PRIVATE / 'toc.list').read_text(encoding='utf-8')
    files = {f'{m[1]}.dat': m[2] for m in re.finditer(r'^(\d+); \d+ \d+ TABLE DATA public ([a-z_][a-z0-9_]*) \S+$', toc, re.M) if m[2] in wanted}
    assert len(files) == len(wanted)
    data = {}
    with tarfile.open(SOURCE, mode='r|gz') as archive:
        for member in archive:
            prefix = '2026-10-29T14:05Z/mf_db_pjsn/'
            name = member.name.removeprefix('./')
            if not name.startswith(prefix) or name[len(prefix):] not in files:
                continue
            assert member.isreg() and 0 <= member.size < 50_000_000
            table = files[name[len(prefix):]]
            assert table not in data
            data[table] = []
            with archive.extractfile(member) as stream:
                for line in stream:
                    if line in (b'\\.\n', b'\n'):
                        continue
                    values = line.removesuffix(b'\n').split(b'\t')
                    assert len(values) == len(columns[table])
                    row = dict(zip(columns[table], values))
                    if table in FAMILIES:
                        campaign = uncopy(row[b'campaign_id'])
                        if campaign not in TARGETS:
                            continue
                        assert all(row.get(k, b'\\N') in (b'\\N', b'') for k in (b'access_token', b'refresh_token', b'client_secret'))
                        data[table].append({'campaignId': campaign, 'table': table,
                                            'active': row[b'is_active'] == b't',
                                            'tokens': json.loads(uncopy(row[b'encrypted_tokens']))})
                    else:
                        keys = [b'id', b'owner_id', b'name'] + ([b'client_id', b'status'] if table == 'campaigns' else [])
                        data[table].append({k.decode(): uncopy(row[k]) for k in keys})
    assert set(data) == wanted
    clients = {c['id']: c for c in data['clients']}
    for campaign_id, name in TARGETS.items():
        matching = [c for c in data['campaigns'] if c['id'] == campaign_id]
        assert len(matching) == 1
        c = matching[0]
        assert c['name'] == name and c['owner_id'] and c['status'] == 'active'
        assert clients[c['client_id']]['owner_id'] == c['owner_id']
    rows = [r for table in sorted(FAMILIES) for r in data[table]]
    assert len(rows) == 7 and sum(r['active'] for r in rows) == 6
    assert {table: len(data[table]) for table in FAMILIES} == {'ga4_connections': 2, 'hubspot_connections': 2, 'salesforce_connections': 1, 'shopify_connections': 2}
    assert SOURCE.stat().st_size == initial.st_size and SOURCE.stat().st_mtime_ns == initial.st_mtime_ns
    return {'archiveSha256': HASH, 'rows': rows}


if __name__ == '__main__':
    try:
        print(json.dumps(read(), separators=(',', ':')))
    except Exception:
        # Never expose archive fields or tracebacks through a diagnostic error.
        print('BACKUP_SCOPE_NOT_VERIFIED', file=sys.stderr)
        sys.exit(1)
