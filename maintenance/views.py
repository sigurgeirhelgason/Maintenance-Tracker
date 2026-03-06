from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from .models import Property, Area, MaintenanceTask, Vendor, Attachment, TaskType
from .serializers import (
    PropertySerializer, AreaSerializer, MaintenanceTaskSerializer,
    VendorSerializer, AttachmentSerializer, TaskTypeSerializer
)

class PropertyViewSet(viewsets.ModelViewSet):
    queryset = Property.objects.all()
    serializer_class = PropertySerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ['name', 'created_at']

class AreaViewSet(viewsets.ModelViewSet):
    queryset = Area.objects.all()
    serializer_class = AreaSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['property']
    ordering_fields = ['name', 'created_at']

class TaskTypeViewSet(viewsets.ModelViewSet):
    queryset = TaskType.objects.all()
    serializer_class = TaskTypeSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['is_predefined']
    ordering_fields = ['name', 'created_at']

class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['name']
    ordering_fields = ['name', 'created_at']

class MaintenanceTaskViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceTask.objects.all()
    serializer_class = MaintenanceTaskSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['property', 'status', 'task_type', 'vendor']
    ordering_fields = ['created_date', 'created_at']

class AttachmentViewSet(viewsets.ModelViewSet):
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['task']
    ordering_fields = ['uploaded_at']
