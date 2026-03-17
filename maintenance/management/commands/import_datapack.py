from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from maintenance.services.import_service import DatapackImporter
import os


class Command(BaseCommand):
    help = 'Import a datapack ZIP file for a specific user'

    def add_arguments(self, parser):
        parser.add_argument(
            'zip_path',
            type=str,
            help='Path to the ZIP datapack file to import'
        )
        parser.add_argument(
            '--user',
            type=int,
            required=True,
            help='User ID to import data for'
        )

    def handle(self, *args, **options):
        zip_path = options['zip_path']
        user_id = options['user']

        # Verify ZIP file exists
        if not os.path.exists(zip_path):
            raise CommandError(f'ZIP file not found: {zip_path}')

        # Get user
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise CommandError(f'User with ID {user_id} not found')

        # Import datapack
        try:
            self.stdout.write(f'Importing datapack for user: {user.username}')
            
            with open(zip_path, 'rb') as f:
                importer = DatapackImporter(user)
                summary = importer.import_datapack(f)

            # Display summary
            self.stdout.write(self.style.SUCCESS('\n✓ Import completed successfully!\n'))
            self.stdout.write(f'Properties created: {summary["properties_created"]}')
            self.stdout.write(f'Properties updated: {summary["properties_updated"]}')
            self.stdout.write(f'Areas created: {summary["areas_created"]}')
            self.stdout.write(f'Areas updated: {summary["areas_updated"]}')
            self.stdout.write(f'Vendors created: {summary["vendors_created"]}')
            self.stdout.write(f'Vendors updated: {summary["vendors_updated"]}')
            self.stdout.write(f'Tasks created: {summary["tasks_created"]}')
            self.stdout.write(f'Tasks updated: {summary["tasks_updated"]}')
            self.stdout.write(f'Attachments created: {summary["attachments_created"]}')
            self.stdout.write(f'Files restored: {summary["files_restored"]}')

            if summary['errors']:
                self.stdout.write(self.style.WARNING('\nErrors encountered:'))
                for error in summary['errors']:
                    self.stdout.write(f'  - {error}')
        except Exception as e:
            raise CommandError(f'Import failed: {str(e)}')
