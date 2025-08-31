import json
from pathlib import Path
p = Path(r"c:\dev\quiz-app\quizzes\entra-identity-platform.json")
front_to_remove = "How to configure token lifetimes today?"

if not p.exists():
    print('File not found:', p)
    raise SystemExit(1)

data = json.loads(p.read_text(encoding='utf-8'))
removed = 0
for key in ('anki','items','cloze'):
    if isinstance(data.get(key), list):
        before = len(data[key])
        data[key] = [c for c in data[key] if c.get('front') != front_to_remove and c.get('question') != front_to_remove]
        after = len(data[key])
        removed += before - after

if removed:
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Removed {removed} card(s) matching front: {front_to_remove}')
else:
    print('No matching card found for front:', front_to_remove)
