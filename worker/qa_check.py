#!/usr/bin/env python3
"""Local mirror of the hub's deliverable gate (supabase/functions/earn-agent/lib/qa.ts).

Usage: python3 worker/qa_check.py deliverables/<slug> [...]
Exit 0 when every deliverable passes, 1 otherwise. The hub re-runs the
authoritative checks before submitting; this gives the worker the same
verdict before it pushes.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO_PREFIX = "https://github.com/mathieumilo3-bot/-generation-capable/"
PLACEHOLDER = re.compile(
    r"\b(TODO|TBD|FIXME|lorem ipsum)\b|\[(insert|your|link|placeholder|add)[^\]]*\]|\{\{[^}]*\}\}|<insert|\bXXX\b",
    re.I,
)
SECRET = re.compile(r"\bsk_[A-Za-z0-9_-]{10,}|\bgh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJhbGciOi[A-Za-z0-9_-]{20,}")
SAFE_PATH = re.compile(r"^(?!/)(?!.*\.\.)[A-Za-z0-9._/-]{1,200}$")
URL = re.compile(r"https?://[^\s)<>\"']+")
URL_REGEX = re.compile(
    r"^(https?://)?(www\.)?[-a-zA-Z0-9@:%_+~#=]+(?:\.[-a-zA-Z0-9@:%_+~#=]+)*\.[a-zA-Z0-9()]{1,256}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$",
    re.I,
)
TEXT_SUFFIXES = {".md", ".txt", ".py", ".ts", ".js", ".json", ".rs", ".toml", ".yml", ".yaml", ".csv", ".html", ".sql", ".sh"}


def job_for(slug: str) -> dict | None:
    try:
        queue = json.loads((ROOT / "state" / "queue.json").read_text())
    except FileNotFoundError:
        return None
    return next((j for j in queue.get("jobs", []) if j["slug"] == slug), None)


def check(folder: pathlib.Path) -> list[str]:
    errors: list[str] = []
    slug = folder.name
    mpath = folder / "submission.json"
    if not mpath.exists():
        return [f"{mpath} missing"]
    try:
        m = json.loads(mpath.read_text())
    except json.JSONDecodeError as e:
        return [f"submission.json is not valid JSON: {e}"]

    job = job_for(slug)
    if job is None:
        errors.append(f"no job for slug {slug} in state/queue.json (run worker/sync.py)")
    if m.get("version") != 1:
        errors.append("version must be 1")
    if m.get("slug") != slug:
        errors.append(f"slug {m.get('slug')} != folder {slug}")
    if job and m.get("listingId") != job["listingId"]:
        errors.append(f"listingId {m.get('listingId')} != {job['listingId']}")
    if m.get("status") == "abandoned":
        if len((m.get("abandonReason") or "").strip()) < 15:
            errors.append("abandonReason must explain precisely why")
        return errors
    if m.get("status") != "ready":
        errors.append("status must be 'ready' or 'abandoned'")

    primary = m.get("primaryFile") or "README.md"
    if not SAFE_PATH.match(primary):
        errors.append(f"unsafe primaryFile {primary}")
    elif not (folder / primary).exists():
        errors.append(f"primary file {primary} missing")
    else:
        text = (folder / primary).read_text(errors="replace")
        if len(text.strip()) < 600:
            errors.append("primary deliverable shorter than 600 characters")

    for f in folder.rglob("*"):
        if f.is_file() and f.suffix.lower() in TEXT_SUFFIXES:
            body = f.read_text(errors="replace")
            if PLACEHOLDER.search(body) and f.name != "submission.json":
                errors.append(f"placeholder in {f.relative_to(folder)}: {PLACEHOLDER.search(body).group(0)!r}")
            if SECRET.search(body):
                errors.append(f"possible secret in {f.relative_to(folder)}")

    info = (m.get("otherInfo") or "").strip()
    if not 80 <= len(info) <= 4000:
        errors.append(f"otherInfo length {len(info)} not within 80–4000")
    if PLACEHOLDER.search(info):
        errors.append("placeholder in otherInfo")
    if not re.search(r"\b(AI|artificial intelligence|agent)\b", info, re.I):
        errors.append("otherInfo must disclose that an AI agent produced the work")

    listing_urls = set(URL.findall(f"{job.get('descriptionHtml', '')} {job.get('requirementsText', '')}")) if job else set()
    given = m.get("eligibilityAnswers") or []
    for i, q in enumerate((job or {}).get("eligibility") or []):
        hit = next((a for a in given if (a.get("question") or "").strip() == q["question"].strip()), None)
        if hit is None and i < len(given):
            hit = given[i]
        answer = ((hit or {}).get("answer") or "").strip()
        if not answer and not q.get("optional"):
            errors.append(f"missing answer to required question {q['question']!r}")
        if answer:
            if PLACEHOLDER.search(answer):
                errors.append(f"placeholder in answer to {q['question']!r}")
            if (q.get("isLink") or q.get("type") == "link") and not URL_REGEX.match(answer):
                errors.append(f"answer to link question {q['question']!r} is not a URL")
            for u in URL.findall(answer):
                if not u.startswith(REPO_PREFIX) and u not in listing_urls:
                    errors.append(f"answer to {q['question']!r} links outside our deliverables: {u}")

    qa = m.get("qa") or {}
    if not isinstance(qa.get("score"), (int, float)) or qa["score"] < 8:
        errors.append(f"qa.score {qa.get('score')} < 8")
    if not qa.get("reviewer") or qa["reviewer"] in ("self", "pending"):
        errors.append("qa.reviewer must be the independent reviewer")
    checklist = qa.get("checklist") or []
    if not checklist:
        errors.append("qa.checklist empty")
    unmet = [c.get("requirement") for c in checklist if not c.get("met")]
    if unmet:
        errors.append(f"unmet requirements: {unmet}")
    for flag in ("originality", "noFabrication", "languageOk"):
        if qa.get(flag) is not True:
            errors.append(f"qa.{flag} must be true")
    return errors


def main(paths: list[str]) -> int:
    if not paths:
        print(__doc__)
        return 1
    failed = False
    for p in paths:
        folder = (ROOT / p).resolve() if not pathlib.Path(p).is_absolute() else pathlib.Path(p)
        errs = check(folder)
        if errs:
            failed = True
            print(f"FAIL {folder.name}")
            for e in errs:
                print(f"  - {e}")
        else:
            print(f"PASS {folder.name}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
