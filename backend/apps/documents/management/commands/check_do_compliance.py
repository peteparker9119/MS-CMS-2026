from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.units.models import ConvergenceUnit
from apps.documents.models import DOLetter, DOLetterCompliance
from apps.notifications.whatsapp import send_whatsapp
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Check DO letter compliance (deadline: 12th of month) and alert admin via WhatsApp'

    def handle(self, *args, **options):
        now   = timezone.localdate()
        year  = now.year
        month = now.month

        if now.day <= 12:
            self.stdout.write('Skipping — before the 12th deadline')
            return

        units         = ConvergenceUnit.objects.all()
        non_compliant = []

        for unit in units:
            has_letter = DOLetter.objects.filter(
                uploaded_by__unit=unit,
                date__year=year,
                date__month=month,
            ).exists()

            DOLetterCompliance.objects.update_or_create(
                unit=unit, year=year, month=month,
                defaults={'is_compliant': has_letter},
            )

            if not has_letter:
                non_compliant.append(unit)

        self.stdout.write(
            f'{len(non_compliant)} non-compliant unit(s): '
            f'{", ".join(u.abbr for u in non_compliant) or "none"}'
        )

        if non_compliant:
            admin_users = User.objects.filter(role='admin').exclude(whatsapp_number='')
            unit_names  = ', '.join(u.abbr for u in non_compliant)
            msg = (
                f"DO Letter Compliance Alert\n"
                f"Month: {now.strftime('%B %Y')}\n"
                f"Non-compliant ({len(non_compliant)}): {unit_names}\n"
                f"These units have not uploaded their DO letter by the 12th."
            )
            for admin in admin_users:
                send_whatsapp(admin.whatsapp_number, msg)
            DOLetterCompliance.objects.filter(
                year=year, month=month, unit__in=non_compliant
            ).update(notified_at=timezone.now())
