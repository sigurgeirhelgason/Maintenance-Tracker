# Generated migration for adding postal_code and city fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('maintenance', '0026_uservendorpreference_is_saved'),
    ]

    operations = [
        migrations.AddField(
            model_name='vendor',
            name='postal_code',
            field=models.CharField(blank=True, help_text='Postal code (e.g., 101 for Reykjavik)', max_length=10),
        ),
        migrations.AddField(
            model_name='vendor',
            name='city',
            field=models.CharField(blank=True, help_text='City or location', max_length=255),
        ),
        migrations.AddField(
            model_name='property',
            name='postal_code',
            field=models.CharField(blank=True, help_text='Postal code (e.g., 101 for Reykjavik)', max_length=10),
        ),
        migrations.AddField(
            model_name='property',
            name='city',
            field=models.CharField(blank=True, help_text='City or location', max_length=255),
        ),
    ]
