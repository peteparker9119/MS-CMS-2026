"""
Local dev helper — generate a TNEMIS-format test token.

Usage:
  python gen_token.py [username] [role] [unit_id]

Defaults: username=admin  role=admin  unit_id=

Examples:
  python gen_token.py
  python gen_token.py poc_vp poc 1

Paste the printed token into your browser console:
  localStorage.setItem('tnemis_token', '<token>')
Then navigate to http://localhost:5173
"""
import sys
import jwt

SECRET = 'ingDLMRuGe9UKHRNjs7cYckS2yul4lc3'

# Reverse of the TNEmisAuth.assign_letters transform (JWT char → obfuscated char)
_LETTER_TO_SYMBOL = {
    'a': '!', 'B': '@', 'c': '#', 'D': '$', 'e': '%',
    'F': '^', 'g': '&', 'i': '?', 'J': '+', 'k': '=',
    'L': '|', 'm': '~', 'N': '/', 'o': '-', 'P': '_',
    'q': '{', 'R': '}', 's': '[', 'T': ']', 'U': '(',
    'v': ')', 'W': '<', 'x': '>', 'Y': ':', 'z': ';',
    '.': '*',
}

def encode_token(jwt_string):
    """Apply reverse assign_letters to produce the obfuscated token header value."""
    return ''.join(_LETTER_TO_SYMBOL.get(c, c) for c in jwt_string)


username = sys.argv[1] if len(sys.argv) > 1 else 'admin'
role     = sys.argv[2] if len(sys.argv) > 2 else 'admin'
unit_id  = int(sys.argv[3]) if len(sys.argv) > 3 else None

payload = {'username': username, 'role': role}
if unit_id is not None:
    payload['unit_id'] = unit_id

raw_jwt    = jwt.encode(payload, SECRET, algorithm='HS256')
obfuscated = encode_token(raw_jwt)

print(f'\nPayload : {payload}')
print(f'\nRaw JWT : {raw_jwt}')
print(f'\nObfuscated token (paste into localStorage):')
print(f'  localStorage.setItem("tnemis_token", "{obfuscated}")')
print(f'\nOr open: http://localhost:5173/?token={obfuscated}')
print()
