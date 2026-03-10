from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from django.contrib.auth.models import User
from .models import Property, Area, MaintenanceTask, Vendor, Attachment, TaskType
from .serializers import (
    PropertySerializer, AreaSerializer, MaintenanceTaskSerializer,
    VendorSerializer, AttachmentSerializer, TaskTypeSerializer,
    UserRegistrationSerializer, UserSerializer
)

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