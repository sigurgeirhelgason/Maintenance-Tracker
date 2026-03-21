# Generated migration for adding is_saved field to UserVendorPreference

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('maintenance', '0025_remove_vendor_favorite_uservendorpreference'),
    ]

    operations = [
        migrations.AddField(
            model_name='uservendorpreference',
            name='is_saved',
            field=models.BooleanField(default=False, help_text='Whether user has saved vendor to their My Vendors collection (reference link)'),
        ),
    ]
