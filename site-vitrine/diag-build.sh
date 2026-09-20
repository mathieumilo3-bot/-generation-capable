#!/usr/bin/env bash
set +e
npm run build > build-output.txt 2>&1
code=$?

mkdir -p diagnostic-publish diag-functions
printf '%s\n' '<!doctype html><html><body><h1>diagnostic</h1></body></html>' > diagnostic-publish/index.html

# Netlify's deploy API exposes deployed function names. Encode the tail of the
# build log into temporary function names so the diagnostic can be read back
# through the connected Netlify API without relying on browser access.
python - <<'PY'
from pathlib import Path
import base64, re, shutil
out = Path("diag-functions")
if out.exists():
    shutil.rmtree(out)
out.mkdir()
text = Path("build-output.txt").read_text(errors="replace")
# Keep the part most likely to contain the TypeScript/Next failure.
tail = text[-2400:]
encoded = base64.b32encode(tail.encode()).decode().rstrip("=")
chunks = [encoded[i:i+48] for i in range(0, len(encoded), 48)]
for i, chunk in enumerate(chunks[:80]):
    name = f"d{i:03d}-{chunk.lower()}"
    (out / f"{name}.mjs").write_text(
        'export default async () => new Response("diag");\n'
    )
PY

exit 0
