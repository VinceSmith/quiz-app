#!/usr/bin/env python3
import csv, json, os, sys

tsv_path = r"c:\dev\quiz-app\anki-entra-identity-platform.tsv"
readme_path = r"c:\dev\quiz-app\README2.md"
out_path = r"c:\dev\quiz-app\quizzes\entra-identity-platform.json"


def read_readme():
    try:
        with open(readme_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception:
        return ""

cards = []
with open(tsv_path, 'r', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    rows = list(reader)

if not rows:
    print("TSV file is empty or missing")
    sys.exit(1)

header = rows[0]
# find indexes
try:
    idx_front = header.index('Front')
    idx_back = header.index('Back')
    idx_tags = header.index('Tags')
except ValueError:
    idx_front, idx_back, idx_tags = 0, 1, 2

for r in rows[1:]:
    # pad
    while len(r) < 3:
        r.append('')
    front = r[idx_front].strip()
    back = r[idx_back].strip()
    tags_field = r[idx_tags].strip()
    tags = [t.strip() for t in tags_field.split() if t.strip()] if tags_field else []
    # Add a default difficulty level so the app can filter by level if needed
    cards.append({'level': 'Intermediate', 'front': front, 'back': back, 'tags': tags})

out = {
    'title': 'Microsoft identity platform (Entra ID) — Developer-depth for Product Managers',
    # Provide a writeup/summary using README2.md to populate the app's Overview pane
    'writeup': read_readme(),
    'source': os.path.basename(tsv_path),
    # App expects an `anki` array for Anki-style cards
    'anki': cards
}

# Ensure quizzes directory exists
os.makedirs(os.path.dirname(out_path), exist_ok=True)

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print('Wrote', out_path)
