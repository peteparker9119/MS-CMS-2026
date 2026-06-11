import logging
import requests
from django.conf import settings

logger = logging.getLogger('cms')
_WA_URL = 'https://graph.facebook.com/v19.0/{phone_id}/messages'


def send_whatsapp(to_number: str, body: str) -> bool:
    """
    Send a plain-text WhatsApp message via Meta Cloud API.
    to_number must be E.164 without '+', e.g. '919876543210'.
    Returns True on success, False on any failure (never raises).
    """
    token    = getattr(settings, 'WHATSAPP_TOKEN', '')
    phone_id = getattr(settings, 'WHATSAPP_PHONE_ID', '')
    if not token or not phone_id or not to_number:
        logger.warning('WhatsApp skipped — credentials or recipient missing')
        return False
    url = _WA_URL.format(phone_id=phone_id)
    payload = {
        'messaging_product': 'whatsapp',
        'to': to_number,
        'type': 'text',
        'text': {'body': body},
    }
    try:
        r = requests.post(
            url, json=payload,
            headers={'Authorization': f'Bearer {token}'},
            timeout=10,
        )
        r.raise_for_status()
        logger.info('WhatsApp sent to %s', to_number)
        return True
    except Exception as exc:
        logger.error('WhatsApp send failed to=%s: %s', to_number, exc)
        return False
