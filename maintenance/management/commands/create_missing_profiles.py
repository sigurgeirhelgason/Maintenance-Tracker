"""
Management command to create missing UserProfiles for existing users.
Run with: python manage.py create_missing_profiles
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from maintenance.models import UserProfile


class Command(BaseCommand):
    help = 'Create missing UserProfile instances for users without profiles'

    def handle(self, *args, **options):
        users_without_profile = []
        
        # Find all users without profiles
        for user in User.objects.all():
            try:
                user.profile
            except UserProfile.DoesNotExist:
                users_without_profile.append(user)
        
        # Create profiles for users without them
        for user in users_without_profile:
            try:
                UserProfile.objects.create(user=user)
                self.stdout.write(self.style.SUCCESS(f'Created profile for user: {user.username}'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Error creating profile for {user.username}: {e}'))
        
        if not users_without_profile:
            self.stdout.write(self.style.SUCCESS('All users already have profiles!'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nSuccessfully created {len(users_without_profile)} missing profiles'))
