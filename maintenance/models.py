from django.db import models
from django.core.validators import MinValueValidator
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging
import os

logger = logging.getLogger(__name__)

class UserProfile(models.Model):
    """User profile for storing user preferences and settings"""
    CURRENCY_CHOICES = [
        ('Kr.', 'Icelandic Króna (Kr.)'),
        ('USD', 'US Dollar ($)'),
        ('EUR', 'Euro (€)'),
        ('GBP', 'British Pound (£)'),
        ('SEK', 'Swedish Króna (kr)'),
        ('NOK', 'Norwegian Krone (kr)'),
        ('DKK', 'Danish Krone (kr)'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    currency = models.CharField(max_length=10, choices=CURRENCY_CHOICES, default='Kr.')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} Profile"

# Signal to create UserProfile when User is created
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    # Create profile if it doesn't exist (for users created before the signal)
    if not hasattr(instance, 'profile') or instance.profile is None:
        try:
            UserProfile.objects.create(user=instance)
        except Exception as e:
            logger.warning("Failed to create UserProfile for user %s: %s", instance.pk, e)
    else:
        instance.profile.save()

class Property(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='properties', null=True, blank=True)
    name = models.CharField(max_length=255)
    address = models.TextField()
    postal_code = models.CharField(max_length=10, blank=True, help_text='Postal code (e.g., 101 for Reykjavik)')
    city = models.CharField(max_length=255, blank=True, help_text='City or location')
    num_floors = models.IntegerField(default=1, validators=[MinValueValidator(1)])
    has_garden = models.BooleanField(default=False)
    image = models.ImageField(upload_to='property_images/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Area(models.Model):
    ROOM_TYPE_CHOICES = [
        ('Living room', 'Living room'),
        ('Bed room', 'Bed room'),
        ('Storage', 'Storage'),
        ('Kitchen', 'Kitchen'),
        ('Bathroom', 'Bathroom'),
        ('Office', 'Office'),
        ('Laundry', 'Laundry'),
        ('Dining room', 'Dining room'),
        ('Garden', 'Garden'),
        ('Hallway', 'Hallway'),
        ('Other', 'Other'),
    ]
    
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='areas')
    type = models.CharField(max_length=50, choices=ROOM_TYPE_CHOICES, default='Living room')
    name = models.CharField(max_length=255, blank=True, null=True)  # Optional custom name
    floor = models.IntegerField(default=1, validators=[MinValueValidator(0)])  # Floor 0 = garden, 1+ = regular floors
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['floor', 'type', 'name']

    def __str__(self):
        if self.name:
            return f"{self.type} - {self.name} (Floor {self.floor})"
        return f"{self.type} (Floor {self.floor})"

class TaskType(models.Model):
    name = models.CharField(max_length=255, unique=True)
    is_predefined = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Stores a list of custom field names for this task type
    custom_field_definitions = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-is_predefined', 'name']

    def __str__(self):
        return self.name

class Vendor(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vendors', null=True, blank=True)
    name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    postal_code = models.CharField(max_length=10, blank=True, help_text='Postal code (e.g., 101 for Reykjavik)')
    city = models.CharField(max_length=255, blank=True, help_text='City or location')
    speciality = models.ForeignKey(TaskType, on_delete=models.SET_NULL, null=True, blank=True, related_name='vendors', help_text='Main speciality/task type')
    secondary_specialities = models.ManyToManyField(TaskType, related_name='vendors_secondary', blank=True, help_text='Secondary specialities/task types')
    is_global = models.BooleanField(default=False, help_text='Whether this is a global vendor available to all users')
    is_premium = models.BooleanField(default=False, help_text='Whether this vendor has premium status for search ranking')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class UserVendorPreference(models.Model):
    """
    Stores user preferences for vendors (favorites, saved, etc.)
    Allows multiple users to independently mark the same vendor as favorite/saved without duplication.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vendor_preferences')
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='user_preferences')
    is_favorite = models.BooleanField(default=False, help_text='Whether user has marked vendor as favorite for quick reference')
    is_saved = models.BooleanField(default=False, help_text='Whether user has saved vendor to their My Vendors collection (reference link)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'vendor')
        verbose_name_plural = 'User Vendor Preferences'

    def __str__(self):
        return f"{self.user.username} - {self.vendor.name} (favorite: {self.is_favorite})"

class MaintenanceTask(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('finished', 'Finished'),
    ]
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    areas = models.ManyToManyField(Area, related_name='tasks', blank=True)
    description = models.TextField(null=True, blank=True)
    task_type = models.ForeignKey(TaskType, on_delete=models.SET_NULL, null=True, blank=True)
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    due_date = models.DateField(null=True, blank=True)
    estimated_price = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(0)])
    final_price = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(0)])
    vat_refund_claimed = models.BooleanField(default=False, help_text='Whether 35% VAT refund has been claimed from Icelandic government')
    
    # Price breakdown with category, amount, and VAT refundable flag
    # Structure: [{"category": "materials|work|travel|tools|uncategorized", "amount": 1500.00, "vat_refundable": true, "description": "optional"}, ...] 
    price_breakdown = models.JSONField(default=list, blank=True, help_text='Breakdown of costs by category with VAT refundable status')
    
    currency = models.CharField(default='Kr.', blank=True)  # Default to Icelandic Krona, can be changed
    
    # Stores values for custom fields defined in task_type
    custom_field_values = models.JSONField(default=dict, blank=True)
    
    created_date = models.DateField(auto_now_add=True, null=True)
    completed_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.description} - {self.get_status_display()}"
    
    def save(self, *args, **kwargs):
        """Auto-calculate price breakdown with 'uncategorized' category handling."""
        
        # Initialize price_breakdown if final_price is set and breakdown is empty
        if self.final_price and (not self.price_breakdown or self.price_breakdown == []):
            self.price_breakdown = [
                {
                    "category": "uncategorized",
                    "amount": int(self.final_price),
                    "vat_refundable": False,
                    "description": ""
                }
            ]
        
        # Recalculate "uncategorized" amount if final_price exists
        if self.final_price and self.price_breakdown:
            final_price = int(self.final_price)
            
            # Calculate sum of all non-"uncategorized" items
            sum_non_other = 0
            other_item = None
            other_index = None
            
            for idx, item in enumerate(self.price_breakdown):
                if item.get('category') == 'uncategorized':
                    other_item = item
                    other_index = idx
                else:
                    sum_non_other += int(item.get('amount', 0))
            
            # Calculate what "uncategorized" should be
            other_amount = final_price - sum_non_other
            
            if other_amount > 0:
                # Update or create "uncategorized" item
                if other_item is not None:
                    self.price_breakdown[other_index]['amount'] = other_amount
                else:
                    self.price_breakdown.append({
                        "category": "uncategorized",
                        "amount": other_amount,
                        "vat_refundable": False,
                        "description": ""
                    })
            else:
                # Remove "uncategorized" item if amount is 0 or negative
                if other_item is not None:
                    self.price_breakdown.pop(other_index)
        
        # Clear price_breakdown if final_price is removed
        if not self.final_price:
            self.price_breakdown = []
        
        super().save(*args, **kwargs)

class Attachment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attachments', null=True, blank=True)
    task = models.ForeignKey(MaintenanceTask, on_delete=models.CASCADE, related_name='attachments', null=True, blank=True)
    file = models.FileField(upload_to='task_attachments/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attachment for {self.task}"

    def filename(self):
        return os.path.basename(self.file.name)


class DataShare(models.Model):
    """
    Tracks data sharing relationships between users.
    Allows an owner to share their data (properties, tasks, vendors, areas, attachments) with another user.
    Permissions are stored as a JSONField with resource type keys ('properties', 'tasks', 'vendors', 'areas', 'attachments')
    and values of 'ro' (read-only) or 'rw' (read-write).
    """
    
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shares_created')
    shared_with = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shares_received')
    
    # Permissions structure: {"properties": "rw", "tasks": "rw", "vendors": "rw", "areas": "rw", "attachments": "rw"}
    # Default is read-write for all resource types
    permissions = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('owner', 'shared_with')
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['shared_with']),
        ]
    
    def __str__(self):
        return f"{self.owner.username} shared with {self.shared_with.username}"
    
    def save(self, *args, **kwargs):
        """Initialize permissions with defaults if not provided."""
        if not self.permissions:
            self.permissions = {
                'properties': 'rw',
                'tasks': 'rw',
                'vendors': 'rw',
                'areas': 'rw',
                'attachments': 'rw',
            }
        super().save(*args, **kwargs)
    
    def get_permission(self, resource_type):
        """Get permission level for a specific resource type. Returns 'rw', 'ro', or None."""
        return self.permissions.get(resource_type)
