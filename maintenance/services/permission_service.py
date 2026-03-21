"""
Permission service for handling data sharing and access control.
Provides utilities to check read/write permissions for shared data.
"""

from django.contrib.auth.models import User
from django.db.models import Q
from maintenance.models import DataShare


def get_shareable_users(user):
    """
    Get a list of all users whose data this user should have access to.
    Includes the user themselves and any users who have shared data with them.

    Args:
        user: The requesting User object

    Returns:
        Q object for filtering querysets to include user's own data and shared data
    """
    # Get all users who have shared data with this user
    shared_user_ids = DataShare.objects.filter(
        shared_with=user
    ).values_list('owner_id', flat=True)
    
    # Return Q object combining self and shared users
    return Q(user=user) | Q(user__in=shared_user_ids)


def can_read(user, resource_owner, resource_type):
    """
    Check if a user can read a specific resource owned by another user.
    
    Args:
        user: The requesting User object
        resource_owner: The User who owns the resource
        resource_type: The type of resource ('properties', 'tasks', 'vendors', 'areas', 'attachments')
        
    Returns:
        True if user can read the resource, False otherwise
    """
    # User can always read their own data
    if user == resource_owner:
        return True

    try:
        share = DataShare.objects.get(owner=resource_owner, shared_with=user)
        permission = share.get_permission(resource_type)
        # Can read if permission is 'ro' (read-only) or 'rw' (read-write)
        return permission in ['ro', 'rw']
    except DataShare.DoesNotExist:
        return False


def can_write(user, resource_owner, resource_type):
    """
    Check if a user can write/update/delete a specific resource owned by another user.
    
    Args:
        user: The requesting User object
        resource_owner: The User who owns the resource
        resource_type: The type of resource ('properties', 'tasks', 'vendors', 'areas', 'attachments')
        
    Returns:
        True if user can write to the resource, False otherwise
    """
    # User can always write their own data
    if user == resource_owner:
        return True

    try:
        share = DataShare.objects.get(owner=resource_owner, shared_with=user)
        permission = share.get_permission(resource_type)
        # Can write only if permission is 'rw' (read-write)
        return permission == 'rw'
    except DataShare.DoesNotExist:
        return False


def can_write_global_vendor(user):
    """
    Check if a user can write/modify global vendors (create, edit, delete).
    Only admin/staff users can modify global vendors.
    
    Args:
        user: The requesting User object
        
    Returns:
        True if user is admin/staff, False otherwise
    """
    return user.is_staff
