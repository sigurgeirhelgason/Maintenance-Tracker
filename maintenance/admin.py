from django.contrib import admin
from .models import Property, Area, MaintenanceTask, TaskType, Vendor, Attachment, DataShare

@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ('name', 'address', 'num_floors', 'has_garden', 'created_at')
    search_fields = ('name', 'address')
    list_filter = ('has_garden', 'created_at')

@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ('name', 'property', 'floor', 'created_at')
    search_fields = ('name', 'property__name')
    list_filter = ('floor', 'property', 'created_at')

@admin.register(TaskType)
class TaskTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_predefined', 'created_at')
    search_fields = ('name',)
    list_filter = ('is_predefined', 'created_at')

@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ('name', 'contact_person', 'phone', 'email', 'created_at')
    search_fields = ('name', 'contact_person', 'email')
    list_filter = ('created_at',)

@admin.register(MaintenanceTask)
class MaintenanceTaskAdmin(admin.ModelAdmin):
    list_display = ('description', 'property', 'status', 'task_type', 'vendor', 'created_date')
    search_fields = ('description', 'property__name')
    list_filter = ('status', 'task_type', 'vendor', 'created_date')
    filter_horizontal = ('areas',)

@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ('file', 'task', 'uploaded_at')
    search_fields = ('task__description',)
    list_filter = ('uploaded_at',)

@admin.register(DataShare)
class DataShareAdmin(admin.ModelAdmin):
    list_display = ('owner', 'shared_with', 'created_at')
    search_fields = ('owner__username', 'owner__email', 'shared_with__username', 'shared_with__email')
    list_filter = ('created_at', 'updated_at')
    readonly_fields = ('created_at', 'updated_at')