from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.meetings.models import ActionPoint
from apps.notifications.whatsapp import send_whatsapp


class Command(BaseCommand):
    help = 'Send WhatsApp reminders for action points due in 3 days'

    def handle(self, *args, **options):
        target = (timezone.now() + timezone.timedelta(days=3)).date()
        aps = (ActionPoint.objects
               .filter(done=False, deadline=target)
               .select_related(
                   'assigned_to',
                   'minutes__meeting__pair__unit_a',
                   'minutes__meeting__pair__unit_b',
               ))
        count = 0
        for ap in aps:
            meeting = ap.minutes.meeting
            pair    = meeting.pair
            if ap.assigned_to and ap.assigned_to.whatsapp_number:
                msg = (
                    f"Action Point Due in 3 Days\n"
                    f"ID: {ap.aid}\n"
                    f"Task: {ap.text}\n"
                    f"Meeting: {pair.unit_a.abbr} x {pair.unit_b.abbr} ({meeting.date})\n"
                    f"Deadline: {ap.deadline}"
                )
                if send_whatsapp(ap.assigned_to.whatsapp_number, msg):
                    count += 1
        self.stdout.write(f'Sent {count} AP deadline reminder(s) for {target}')
