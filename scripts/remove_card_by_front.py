import json
from pathlib import Path
p = Path(r"c:\dev\quiz-app\quizzes\entra-identity-platform.json")
front_to_remove = "What is the Graph UserInfo endpoint scope?"

if not p.exists():
    print('File not found:', p)
    raise SystemExit(1)

data = json.loads(p.read_text(encoding='utf-8'))
removed = 0
if isinstance(data.get('anki'), list):
    before = len(data['anki'])
    data['anki'] = [c for c in data['anki'] if c.get('front') != front_to_remove]
    after = len(data['anki'])
    removed += before - after

# Also check items/cloze arrays just in case
for key in ('items','cloze'):
    if isinstance(data.get(key), list):
        before = len(data[key])
        data[key] = [c for c in data[key] if c.get('question') != front_to_remove and c.get('front') != front_to_remove]
        after = len(data[key])
        removed += before - after

if removed:
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Removed {removed} card(s) matching front: {front_to_remove}')
else:
    print('No matching card found for front:', front_to_remove)
