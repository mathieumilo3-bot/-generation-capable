#!/usr/bin/env bash
set +e
npm run build > build-output.txt 2>&1
code=$?
mkdir -p diagnostic-publish
{
  printf '%s\n' '<!doctype html><html><head><meta charset="utf-8"><style>body{background:#050505;color:#f5f5f5;font:13px/1.35 ui-monospace,monospace;padding:24px}h1{font:700 22px sans-serif}pre{white-space:pre-wrap;word-break:break-word}</style></head><body>'
  printf '<h1>Next build exit code: %s</h1><pre>\n' "$code"
  tail -n 140 build-output.txt | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g'
  printf '%s\n' '</pre></body></html>'
} > diagnostic-publish/index.html
cp build-output.txt diagnostic-publish/build-output.txt
exit 0
