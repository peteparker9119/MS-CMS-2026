from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meetings', '0005_actionpoint_deadline_time'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='actionpoint',
            name='deadline_time',
        ),
        migrations.AddField(
            model_name='actionpoint',
            name='start_date',
            field=models.DateField(blank=True, null=True),
        ),
    ]
