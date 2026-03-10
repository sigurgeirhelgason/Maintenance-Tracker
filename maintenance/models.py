from django.db import models
from django.core.validators import MinValueValidator
from django.contrib.auth.models import User
import os

class Property(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='properties', null=True, blank=True)
    name = models.CharField(max_length=255)
    address = models.TextField()
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

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
    description = models.TextField()
    task_type = models.ForeignKey(TaskType, on_delete=models.SET_NULL, null=True, blank=True)
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    due_date = models.DateField(null=True, blank=True)
    estimated_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    final_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, default='Krónur', blank=True)  # Default to Icelandic Krona, can be changed
    
    # Stores values for custom fields defined in task_type
    custom_field_values = models.JSONField(default=dict, blank=True)
    
    created_date = models.DateField(auto_now_add=True, null=True)
    completed_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_date']

    def __str__(self):
        return f"{self.description} - {self.get_status_display()}"

class Attachment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attachments', null=True, blank=True)
    task = models.ForeignKey(MaintenanceTask, on_delete=models.CASCADE, related_name='attachments', null=True, blank=True)
    file = models.FileField(upload_to='task_attachments/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attachment for {self.task}"

    def filename(self):
        return os.path.basename(self.file.name)
