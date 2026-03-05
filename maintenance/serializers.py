from rest_framework import serializers
from .models import Property, Area, MaintenanceTask, TaskType, Vendor, Attachment

class PropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = Property
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

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

    class Meta:
        model = MaintenanceTask
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_date']

    def get_attachments(self, obj):
        return AttachmentSerializer(obj.attachments.all(), many=True).data