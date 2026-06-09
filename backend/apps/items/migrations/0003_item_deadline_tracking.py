from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('items', '0002_item_deadline'),
    ]

    operations = [
        # Change deadline from DateTimeField → DateField
        migrations.AlterField(
            model_name='item',
            name='deadline',
            field=models.DateField(null=True, blank=True),
        ),
        # Track the original deadline so deviations are visible
        migrations.AddField(
            model_name='item',
            name='original_deadline',
            field=models.DateField(null=True, blank=True),
        ),
    ]
