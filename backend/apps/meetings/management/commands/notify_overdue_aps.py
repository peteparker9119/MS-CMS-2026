from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.meetings.models import ActionPoint
from apps.notifications.whatsapp import send_whatsapp
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Notify admins of overdue (past-deadline, not-done) action points'

    def handle(self, *args, **options):
        today = timezone.now().date()

        overdue = (ActionPoint.objects
                   .filter(done=False, deadline__lt=today, deadline__isnull=False)
                   .select_related(
                       'assigned_to',
                       'minutes__meeting__pair__unit_a',
                       'minutes__meeting__pair__unit_b',
                   )
                   .order_by('deadline'))

        if not overdue.exists():
            self.stdout.write('No overdue action points.')
            return

        # Build summary message for admins
        lines = [f"⚠ OVERDUE ACTION POINTS — {today}\n"]
        for ap in overdue:
            meeting = ap.minutes.meeting
            pair = meeting.pair
            assignee = ap.assigned_to.get_full_name() or ap.assigned_to.username if ap.assigned_to else 'Unassigned'
            date_range = f"{ap.start_date} → {ap.deadline}" if ap.start_date else str(ap.deadline)
            lines.append(
                f"• [{ap.aid}] {ap.text}\n"
                f"  Meeting: {pair.unit_a.abbr} × {pair.unit_b.abbr} ({meeting.date})\n"
                f"  Assigned to: {assignee}\n"
                f"  Deadline: {date_range} (OVERDUE)"
            )

        msg = '\n\n'.join(lines)

        # Send to all admin and super_admin users with WhatsApp numbers
        admins = User.objects.filter(role__in=['admin', 'super_admin'], is_active=True)
        sent = 0
        for admin in admins:
            if admin.whatsapp_number:
                if send_whatsapp(admin.whatsapp_number, msg):
                    sent += 1

        self.stdout.write(
            f'Found {overdue.count()} overdue AP(s). Notified {sent} admin(s).'
        )
