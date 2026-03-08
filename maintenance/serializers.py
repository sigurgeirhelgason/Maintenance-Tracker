from rest_framework import serializers
from .models import Property, Area, MaintenanceTask, TaskType, Vendor, Attachment

class PropertySimpleSerializer(serializers.ModelSerializer):
    """Lightweight property serializer without tasks/areas to avoid circular references"""
    class Meta:
        model = Property
        fields = ['id', 'name', 'address', 'num_floors', 'has_garden', 'image', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class PropertySerializer(serializers.ModelSerializer):
    areas = serializers.SerializerMethodField()
    tasks = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def get_areas(self, obj):
        areas = obj.areas.all()
        return AreaSerializer(areas, many=True).data

    def get_tasks(self, obj):
        tasks = obj.tasks.all()
        return MaintenanceTaskSerializer(tasks, many=True).data

class AreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Area
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # On update: make property not required and read-only
        # On create: keep property required and writable
        if self.instance is not None:
            self.fields['property'].required = False
            self.fields['property'].read_only = True
    
    def update(self, instance, validated_data):
        # Ensure property is never updated
        validated_data.pop('property', None)
        return super().update(instance, validated_data)

class TaskTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskType
        fields = '__all__'
        read_only_fields = ['created_at']

class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = '__all__'
        read_only_fields = ['uploaded_at']

class MaintenanceTaskSerializer(serializers.ModelSerializer):
    attachments = serializers.SerializerMethodField()
    task_type_details = TaskTypeSerializer(source='task_type', read_only=True)
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    areas_details = AreaSerializer(source='areas', many=True, read_only=True)
    property_details = PropertySimpleSerializer(source='property', read_only=True)

    class Meta:
        model = MaintenanceTask
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_date']

    def get_attachments(self, obj):
        return AttachmentSerializer(obj.attachments.all(), many=True).data