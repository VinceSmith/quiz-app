import json
from pathlib import Path
p = Path(r"c:\dev\quiz-app\quizzes\entra-identity-platform.json")
bak = p.with_suffix('.json.bak2')
# Create a timestamped or incremental backup if desired; here use .json.bak2 to avoid clobbering existing .bak
if p.exists():
    bak.write_text(p.read_text(encoding='utf-8'), encoding='utf-8')
    print('Backup written to', bak)
else:
    print('Source file missing', p)
    raise SystemExit(1)

d = json.loads(p.read_text(encoding='utf-8'))
for key in ('items','anki','cloze'):
    arr = d.get(key)
    if isinstance(arr, list):
        for v in arr:
            if isinstance(v, dict):
                v['level'] = 'None'

p.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding='utf-8')
print('Updated levels to None in', p)
