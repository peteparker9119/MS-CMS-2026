import jwt
import logging
from datetime import datetime
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import APIException

logger = logging.getLogger('cms')


class CustomAuthenticationError(APIException):
    status_code = 500
    default_detail = "Authorization Is Mandatory."
    default_code = "authentication_error"

    def __init__(self, detail=None, status=None):
        if detail is None:
            detail = self.default_detail
        if status is None:
            status = self.status_code
        self.detail = {
            "dataStatus": False,
            "status": status,
            "message": detail,
        }


class Auth(BaseAuthentication):
    """
    TNEMIS platform authentication.

    Every request must carry:
      Authorization: <api_key>   — static key configured in TNEMIS_API_KEY
      Token: <obfuscated_jwt>    — TNEMIS-issued JWT after symbol→letter transform

    The decoded JWT is attached to request.tokenDetails.
    A local Django User is get-or-created from the token (username/role/unit_id)
    so that all existing request.user references keep working unchanged.
    """

    # ── Obfuscation helpers (mirror of TNEMIS platform) ──────────────────────

    def alphabet_to_number(self, string):
        mapping = {
            'A': '0', 'b': '1', 'C': '2', 'd': '3', 'E': '4',
            'f': '5', 'G': '6', 'h': '7', 'I': '8', 'j': '9',
        }
        return ''.join(mapping.get(c, '') for c in string)

    def assign_letters(self, text):
        mapping = {
            '!': 'a', '@': 'B', '#': 'c', '$': 'D', '%': 'e',
            '^': 'F', '&': 'g', '?': 'i', '+': 'J', '=': 'k',
            '|': 'L', '~': 'm', '/': 'N', '-': 'o', '_': 'P',
            '{': 'q', '}': 'R', '[': 's', ']': 'T', '(': 'U',
            ')': 'v', '<': 'W', '>': 'x', ':': 'Y', ';': 'z',
            '*': '.',
        }
        return ''.join(mapping.get(c, c) for c in text)

    # ── API key validation ────────────────────────────────────────────────────

    def validate_key(self, key):
        # Static key check (test or configured value)
        if key == settings.TNEMIS_API_KEY:
            return True
        # Time-based key check
        s = str(key)
        if len(s) < 13:
            return False
        first6, last6, middle = s[:6], s[-6:], s[6:-6]
        try:
            ts = int(self.alphabet_to_number(middle)) / 1000
            return first6 == last6 and datetime.fromtimestamp(ts) >= datetime.now()
        except Exception:
            return False

    # ── Core authenticate ─────────────────────────────────────────────────────

    def authenticate(self, request):
        api_key = request.headers.get('Authorization')
        token   = request.headers.get('Token')

        # ── Dev bypass (DEBUG only) ───────────────────────────────────────────
        # Frontend sends Authorization: dev + X-Dev-Role: super_admin|admin|poc|team
        if settings.DEBUG and api_key == 'dev':
            role     = request.headers.get('X-Dev-Role', 'admin')
            username = f'dev_{role}'
            unit_id  = 1 if role in ('poc', 'team') else None
            decoded  = {'username': username, 'role': role, 'unit_id': unit_id}
            request.tokenDetails = decoded
            return (self.sync_user(decoded), None)
        # ─────────────────────────────────────────────────────────────────────

        # Determine the last URL segment (used for EXEMPT_TOKEN lookup)
        segments = [s for s in request.path.split('/') if s]
        method   = segments[-1] if segments else ''
        exempt   = getattr(settings, 'EXEMPT_TOKEN', [])

        if not api_key:
            raise CustomAuthenticationError('Authorization Is Mandatory.')

        if not self.validate_key(api_key):
            raise CustomAuthenticationError('Authorization Key is Invalid!')

        if method not in exempt and not token:
            raise CustomAuthenticationError('Token Is Mandatory.')

        if not token:
            decoded = {}
        else:
            transformed = self.assign_letters(token)
            decoded = jwt.decode(
                transformed,
                settings.TNEMIS_JWT_SECRET,
                algorithms=['HS256'],
                options={'verify_signature': False, 'verify_exp': False},
            )
            logger.debug('TNEMIS token decoded for user=%s', decoded.get('username'))

        request.tokenDetails = decoded
        user = self.sync_user(decoded)
        return (user, None)

    # ── Local user sync ───────────────────────────────────────────────────────

    def sync_user(self, token_details):
        """
        Get or create a local Django User mirroring the TNEMIS token.
        Called on every authenticated request — keeps role/unit in sync.

        Note: unit_id in the token must match the id of a ConvergenceUnit row.
        """
        if not token_details:
            return None

        username = token_details.get('username')
        if not username:
            return None

        role    = token_details.get('role', 'poc')
        unit_id = token_details.get('unit_id')

        unit = None
        if unit_id:
            from cms.units.models import ConvergenceUnit
            unit = ConvergenceUnit.objects.filter(id=unit_id).first()
            if unit is None:
                logger.warning('TNEMIS unit_id=%s not found in ConvergenceUnit table', unit_id)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        user, created = User.objects.get_or_create(
            username=username,
            defaults={'role': role, 'unit': unit, 'is_active': True},
        )

        if created:
            user.set_unusable_password()
            user.save(update_fields=['password'])
        else:
            # Keep local copy in sync with TNEMIS on every request
            updates = []
            if user.role != role:
                user.role = role
                updates.append('role')
            if user.unit_id != (unit.id if unit else None):
                user.unit = unit
                updates.append('unit')
            if updates:
                user.save(update_fields=updates)

        return user
