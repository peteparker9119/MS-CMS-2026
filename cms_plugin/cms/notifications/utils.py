from django.core.mail import send_mail
from django.conf import settings
from .models import Notification


def notify_users(users, title, message, notif_type, object_id=None,
                 action_type='', action_data=None, send_email=True):
    """Create in-app notification + optionally send email to each user."""
    if action_data is None:
        action_data = {}
    for user in users:
        Notification.objects.create(
            user=user, title=title, message=message,
            notif_type=notif_type, object_id=object_id,
            action_type=action_type, action_data=action_data,
        )
        if send_email and user.email:
            try:
                send_mail(
                    subject=title,
                    message=message,
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'cms@tnschools.gov.in'),
                    recipient_list=[user.email],
                    fail_silently=True,
                )
            except Exception:
                pass
