"""Generate ignored env files for the isolated local Supabase stack; never overwrite."""
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
status = json.loads(Path(sys.argv[1]).read_text())
if status['API_URL'] not in ('http://127.0.0.1:55421', 'http://localhost:55421'):
    raise SystemExit('Expected MacroLens local Supabase on port 55421')
files = {
    root/'apps/client/.env': f"EXPO_PUBLIC_SUPABASE_URL={status['API_URL']}\nEXPO_PUBLIC_SUPABASE_ANON_KEY={status['ANON_KEY']}\nEXPO_PUBLIC_API_URL=http://localhost:8010\n",
    root/'services/api/.env': f"SUPABASE_URL={status['API_URL']}\nSUPABASE_ANON_KEY={status['ANON_KEY']}\nSUPABASE_SERVICE_ROLE_KEY={status['SERVICE_ROLE_KEY']}\nCORS_ORIGINS=http://localhost:8081,http://localhost:8082\nENVIRONMENT=development\n",
}
for path, content in files.items():
    if path.exists():
        print(f'Preserved existing {path.relative_to(root)}')
        continue
    path.write_text(content)
    path.chmod(0o600)
    print(f'Created {path.relative_to(root)}')
