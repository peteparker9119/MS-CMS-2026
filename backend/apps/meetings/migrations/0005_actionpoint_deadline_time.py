from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meetings', '0004_meeting_calendar_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='actionpoint',
            name='deadline_time',
            field=models.TimeField(null=True, blank=True),
        ),
    ]
