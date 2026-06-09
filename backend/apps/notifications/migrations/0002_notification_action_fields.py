from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='action_type',
            field=models.CharField(
                max_length=20,
                choices=[('rsvp', 'RSVP'), ('acknowledge', 'Acknowledge')],
                blank=True,
                default='',
            ),
        ),
        migrations.AddField(
            model_name='notification',
            name='action_data',
            field=models.JSONField(default=dict, blank=True),
        ),
        migrations.AddField(
            model_name='notification',
            name='responded',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='notification',
            name='response',
            field=models.CharField(max_length=40, blank=True, default=''),
        ),
    ]
