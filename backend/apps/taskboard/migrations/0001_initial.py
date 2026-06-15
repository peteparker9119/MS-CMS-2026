from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Task',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('order', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                                  related_name='tb_created_tasks', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'taskboard_task', 'ordering': ['order', 'created_at']},
        ),
        migrations.CreateModel(
            name='TaskAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('start_date', models.DateField(blank=True, null=True)),
                ('deadline', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('in_progress', 'In Progress'),
                                                      ('completed', 'Completed'), ('blocked', 'Blocked')],
                                             default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('task', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                            related_name='assignments', to='taskboard.task')),
                ('assigned_to', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                                   related_name='task_assignments', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                                  related_name='created_task_assignments', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'taskboard_assignment', 'unique_together': {('task', 'assigned_to')}},
        ),
        migrations.CreateModel(
            name='TaskActivity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField()),
                ('activity_type', models.CharField(choices=[('action', 'Action Taken'), ('support', 'Support Given'),
                                                              ('comment', 'Comment'), ('close', 'Closed')],
                                                    max_length=20)),
                ('support_needed', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('assignment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                                  related_name='activities', to='taskboard.taskassignment')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                                  related_name='task_activities', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'taskboard_activity', 'ordering': ['created_at']},
        ),
    ]
