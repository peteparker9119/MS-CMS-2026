from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_user_whatsapp_number'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('super_admin', 'Super Admin'),
                    ('admin',       'Admin'),
                    ('poc',         'Unit POC'),
                    ('team',        'Team Member'),
                ],
                default='team',
                max_length=15,
            ),
        ),
    ]
