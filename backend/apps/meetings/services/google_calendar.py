import json
import base64
import logging
from django.conf import settings

logger = logging.getLogger('cms')


def _get_service():
    creds_raw = getattr(settings, 'GOOGLE_CALENDAR_CREDENTIALS_JSON', '')
    if not creds_raw:
        logger.warning('Google Calendar skipped — GOOGLE_CALENDAR_CREDENTIALS_JSON not set')
        return None
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        try:
            creds_dict = json.loads(creds_raw)
        except (json.JSONDecodeError, ValueError):
            creds_dict = json.loads(base64.b64decode(creds_raw).decode())
        scopes = ['https://www.googleapis.com/auth/calendar']
        credentials = service_account.Credentials.from_service_account_info(
            creds_dict, scopes=scopes
        )
        return build('calendar', 'v3', credentials=credentials, cache_discovery=False)
    except ImportError:
        logger.warning('google-api-python-client not installed — Calendar integration disabled')
        return None
    except Exception as exc:
        logger.error('Google Calendar service init failed: %s', exc)
        return None


def create_meeting_event(meeting, attendee_emails: list):
    service = _get_service()
    if not service:
        return None
    try:
        from datetime import datetime, timedelta
        pair     = meeting.pair
        title    = f"{pair.unit_a.abbr} × {pair.unit_b.abbr} Convergence Meeting"
        date_str = str(meeting.date)
        time_str = str(meeting.time) if meeting.time else '10:00:00'
        start_dt = f"{date_str}T{time_str}+05:30"
        start    = datetime.fromisoformat(start_dt)
        end_dt   = (start + timedelta(hours=1)).isoformat()
        event = {
            'summary':     title,
            'description': meeting.agenda or '',
            'start': {'dateTime': start_dt, 'timeZone': 'Asia/Kolkata'},
            'end':   {'dateTime': end_dt,   'timeZone': 'Asia/Kolkata'},
            'attendees': [{'email': e} for e in attendee_emails if e],
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 1440},
                    {'method': 'email', 'minutes': 60},
                    {'method': 'popup', 'minutes': 30},
                ],
            },
        }
        result = service.events().insert(
            calendarId='primary', body=event, sendUpdates='all'
        ).execute()
        logger.info('Google Calendar event created: %s', result.get('id'))
        return result
    except Exception as exc:
        logger.error('Google Calendar event creation failed: %s', exc)
        return None


def update_meeting_event(event_id: str, meeting) -> bool:
    service = _get_service()
    if not service or not event_id:
        return False
    try:
        from datetime import datetime, timedelta
        date_str = str(meeting.date)
        time_str = str(meeting.time) if meeting.time else '10:00:00'
        start_dt = f"{date_str}T{time_str}+05:30"
        start    = datetime.fromisoformat(start_dt)
        end_dt   = (start + timedelta(hours=1)).isoformat()
        service.events().patch(
            calendarId='primary', eventId=event_id,
            body={
                'start': {'dateTime': start_dt, 'timeZone': 'Asia/Kolkata'},
                'end':   {'dateTime': end_dt,   'timeZone': 'Asia/Kolkata'},
            },
            sendUpdates='all',
        ).execute()
        return True
    except Exception as exc:
        logger.error('Google Calendar event update failed: %s', exc)
        return False
