from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from django.http import FileResponse
from django.contrib.auth.models import User
from datetime import datetime
from .models import Property, Area, MaintenanceTask, Vendor, Attachment, TaskType
from .serializers import (
    PropertySerializer, AreaSerializer, MaintenanceTaskSerializer,
    VendorSerializer, AttachmentSerializer, TaskTypeSerializer,
    UserRegistrationSerializer, UserSerializer, ExportSerializer, ImportSerializer
)
from .services.export_service import DatapackExporter
from .services.import_service import DatapackImporter

class PropertyViewSet(viewsets.ModelViewSet):
    serializer_class = PropertySerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ['name', 'created_at']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only return properties for the current user
        return Property.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Automatically set the current user
        serializer.save(user=self.request.user)

class AreaViewSet(viewsets.ModelViewSet):
    serializer_class = AreaSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['property']
    ordering_fields = ['name', 'created_at']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only return areas for properties owned by the current user
        return Area.objects.filter(property__user=self.request.user)

class TaskTypeViewSet(viewsets.ModelViewSet):
    queryset = TaskType.objects.all()
    serializer_class = TaskTypeSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['is_predefined']
    ordering_fields = ['name', 'created_at']
    permission_classes = [IsAuthenticated]

class VendorViewSet(viewsets.ModelViewSet):
    serializer_class = VendorSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['name']
    ordering_fields = ['name', 'created_at']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only return vendors for the current user
        return Vendor.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Automatically set the current user
        serializer.save(user=self.request.user)

class MaintenanceTaskViewSet(viewsets.ModelViewSet):
    serializer_class = MaintenanceTaskSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['property', 'status', 'task_type', 'vendor']
    ordering_fields = ['created_date', 'created_at']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only return tasks for the current user
        return MaintenanceTask.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Automatically set the current user
        serializer.save(user=self.request.user)

class AttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = AttachmentSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['task']
    ordering_fields = ['uploaded_at']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only return attachments for the current user
        return Attachment.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Automatically set the current user
        serializer.save(user=self.request.user)
# Authentication Views
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register a new user"""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """Get current authenticated user"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_datapack(request):
    """Export all user data to a ZIP file (datapack)"""
    try:
        # Create exporter and generate ZIP
        exporter = DatapackExporter(request.user)
        zip_buffer = exporter.export()
        
        # Return ZIP file as download
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'maintenance_export_{request.user.id}_{timestamp}.zip'
        
        response = FileResponse(zip_buffer, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
    except Exception as e:
        return Response(
            {'error': f'Export failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_datapack(request):
    """Import user data from a ZIP datapack file"""
    serializer = ImportSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Get the uploaded file
        zip_file = request.FILES.get('file')
        if not zip_file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create importer and import data
        importer = DatapackImporter(request.user)
        summary = importer.import_datapack(zip_file)
        
        return Response(summary, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {'error': f'Import failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )