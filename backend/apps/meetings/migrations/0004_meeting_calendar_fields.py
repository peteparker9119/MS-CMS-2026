import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meetings', '0003_actionpoint_assigned_to_actionpoint_deadline_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='meeting',
            name='title',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='meeting',
            name='end_time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='meeting',
            name='description',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='meeting',
            name='meet_link',
            field=models.CharField(blank=True, default='', max_length=300),
        ),
        migrations.AddField(
            model_name='meeting',
            name='recurrence',
            field=models.CharField(
                blank=True,
                choices=[
                    ('none', 'Does not repeat'),
                    ('daily', 'Daily'),
                    ('weekly', 'Weekly'),
                    ('monthly', 'Monthly'),
                    ('custom', 'Custom'),
                ],
                default='none',
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name='meeting',
            name='status',
            field=models.CharField(
                choices=[
                    ('scheduled', 'Scheduled'),
                    ('conducted', 'Conducted'),
                    ('postponed', 'Postponed'),
                    ('missed', 'Missed'),
                    ('cancelled', 'Cancelled'),
                ],
                default='scheduled',
                max_length=15,
            ),
        ),
        migrations.CreateModel(
            name='MeetingHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(
                    choices=[
                        ('scheduled', 'Scheduled'),
                        ('rescheduled', 'Rescheduled'),
                        ('cancelled', 'Cancelled'),
                    ],
                    max_length=20,
                )),
                ('reason', models.TextField(blank=True, default='')),
                ('old_date', models.DateField(blank=True, null=True)),
                ('new_date', models.DateField(blank=True, null=True)),
                ('old_time', models.TimeField(blank=True, null=True)),
                ('new_time', models.TimeField(blank=True, null=True)),
                ('changed_at', models.DateTimeField(auto_now_add=True)),
                ('meeting', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='history', to='meetings.meeting')),
                ('changed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='meeting_history', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'meetings_meetinghistory',
                'ordering': ['-changed_at'],
            },
        ),
    ]
