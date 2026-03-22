from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from django.http import FileResponse
from django.contrib.auth.models import User
from django.db.models import Q, Case, When, Value, IntegerField, F, Prefetch
from datetime import datetime
from .models import Property, Area, MaintenanceTask, Vendor, Attachment, TaskType, DataShare, UserVendorPreference
from .serializers import (
    PropertySerializer, AreaSerializer, MaintenanceTaskSerializer,
    VendorSerializer, AttachmentSerializer, TaskTypeSerializer,
    UserRegistrationSerializer, UserSerializer, ExportSerializer, ImportSerializer,
    UserDetailSerializer, UserUpdateSerializer, PasswordChangeSerializer,
    EmailTokenObtainPairSerializer, DataShareSerializer, CreateDataShareSerializer
)
from .services.export_service import DatapackExporter
from .services.import_service import DatapackImporter
from .services.permission_service import get_shareable_users, can_read, can_write
from .services.postal_code_service import get_city_from_postal_code

class OwnerPermissionMixin:
    """
    Mixin that enforces owner-or-write-share permission on update and destroy.
    Subclasses must set `owner_resource_type` (e.g. 'properties', 'tasks').
    Override `get_object_owner(obj)` if the owner field is not `obj.user`.
    """
    owner_resource_type = None  # e.g. 'properties', 'tasks', 'vendors', 'areas', 'attachments'

    def get_object_owner(self, obj):
        """Return the User who owns the object. Override for non-standard owner fields."""
        return obj.user

    def perform_update(self, serializer):
        obj = self.get_object()
        owner = self.get_object_owner(obj)
        if owner != self.request.user and not can_write(self.request.user, owner, self.owner_resource_type):
            raise PermissionDenied(
                f"You do not have permission to update this {self.owner_resource_type.rstrip('s')}."
            )
        serializer.save()

    def perform_destroy(self, instance):
        owner = self.get_object_owner(instance)
        if owner != self.request.user and not can_write(self.request.user, owner, self.owner_resource_type):
            raise PermissionDenied(
                f"You do not have permission to delete this {self.owner_resource_type.rstrip('s')}."
            )
        instance.delete()


@api_view(['GET'])
@permission_classes([AllowAny])
def lookup_postal_code(request):
    """
    Look up city from postal code.
    Query parameters:
    - postal_code: The postal code to look up (e.g., '101')
    """
    postal_code = request.query_params.get('postal_code', '').strip()
    
    if not postal_code:
        return Response({'error': 'postal_code parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    city = get_city_from_postal_code(postal_code)
    
    return Response({
        'postal_code': postal_code,
        'city': city
    }, status=status.HTTP_200_OK)

class PropertyViewSet(OwnerPermissionMixin, viewsets.ModelViewSet):
    serializer_class = PropertySerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ['name', 'created_at']
    permission_classes = [IsAuthenticated]
    owner_resource_type = 'properties'

    def get_queryset(self):
        # Return properties for the current user and shared properties, with all
        # related data prefetched to eliminate N+1 queries in PropertySerializer.
        user = self.request.user
        shared_users = DataShare.objects.filter(shared_with=user).values_list('owner_id', flat=True)

        # Prefetch UserVendorPreference rows for the current user so that
        # VendorSerializer.get_favorite() and get_saved() can be resolved from
        # the in-memory cache instead of issuing one query per vendor per task.
        vendor_prefs_prefetch = Prefetch(
            'tasks__vendor__user_preferences',
            queryset=UserVendorPreference.objects.filter(user=user),
            to_attr='_user_prefs',
        )

        return (
            Property.objects
            .filter(Q(user=user) | Q(user__in=shared_users))
            .select_related('user')
            .prefetch_related(
                'areas',
                'tasks',
                'tasks__user',
                'tasks__task_type',
                'tasks__areas',
                'tasks__attachments',
                'tasks__vendor',
                'tasks__vendor__speciality',
                'tasks__vendor__secondary_specialities',
                vendor_prefs_prefetch,
            )
        )

    def perform_create(self, serializer):
        # Automatically set the current user
        serializer.save(user=self.request.user)

class AreaViewSet(OwnerPermissionMixin, viewsets.ModelViewSet):
    serializer_class = AreaSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['property']
    ordering_fields = ['name', 'created_at']
    permission_classes = [IsAuthenticated]
    owner_resource_type = 'areas'

    def get_object_owner(self, obj):
        return obj.property.user

    def get_queryset(self):
        # Return areas for properties of current user and shared properties
        user = self.request.user
        shared_users = DataShare.objects.filter(shared_with=user).values_list('owner_id', flat=True)
        return Area.objects.filter(Q(property__user=user) | Q(property__user__in=shared_users))
    
    def perform_create(self, serializer):
        # Verify that the target property belongs to the current user or that the
        # user has write access to it via a data share before creating an area.
        property_obj = serializer.validated_data.get('property')
        if property_obj.user != self.request.user and not can_write(self.request.user, property_obj.user, 'areas'):
            raise PermissionDenied("You do not have permission to add areas to this property.")
        serializer.save()

class TaskTypeViewSet(viewsets.ModelViewSet):
    queryset = TaskType.objects.all()
    serializer_class = TaskTypeSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['is_predefined']
    ordering_fields = ['name', 'created_at']
    permission_classes = [IsAuthenticated]

class VendorViewSet(viewsets.ModelViewSet):
    serializer_class = VendorSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['name']
    search_fields = ['name', 'email', 'contact_person']
    ordering_fields = ['name', 'created_at', 'is_premium']
    ordering = ['-is_premium', 'name']  # Default ordering: premium first, then by name
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Return vendors for current user, shared vendors, and global vendors
        user = self.request.user
        shared_users = DataShare.objects.filter(shared_with=user).values_list('owner_id', flat=True)
        
        # Include: user's own vendors, shared vendors, and global vendors
        queryset = Vendor.objects.filter(
            Q(user=user) | Q(user__in=shared_users) | Q(is_global=True)
        )
        
        # Apply speciality-based ranking if speciality query param provided
        speciality_id = self.request.query_params.get('speciality', None)
        if speciality_id:
            # Create a ranking score: 
            # 1. Premium global vendors (2000)
            # 2. Primary speciality match (1500) 
            # 3. Secondary speciality match (1000)
            # 4. Others (0)
            ranking_score = Case(
                # Premium vendors get highest rank
                When(is_premium=True, then=Value(2000)),
                # Primary speciality match (but not premium)
                When(is_premium=False, speciality_id=speciality_id, then=Value(1500)),
                # Secondary speciality match 
                When(is_premium=False, secondary_specialities__id=speciality_id, then=Value(1000)),
                # Default
                default=Value(0),
                output_field=IntegerField()
            )
            queryset = queryset.annotate(
                search_rank=ranking_score
            ).order_by('-search_rank', '-is_premium', 'name')
        
        return queryset

    def perform_create(self, serializer):
        # Prevent non-admin users from creating global vendors
        is_global = self.request.data.get('is_global', False)
        if is_global and not self.request.user.is_staff:
            raise PermissionDenied("Only admin users can create global vendors.")

        # is_global and is_premium are read_only on the serializer; pass them
        # explicitly here so that admins can set them at creation time.
        save_kwargs = {'user': self.request.user}
        if self.request.user.is_staff:
            save_kwargs['is_global'] = bool(is_global)
            is_premium = self.request.data.get('is_premium', False)
            save_kwargs['is_premium'] = bool(is_premium)

        serializer.save(**save_kwargs)

    def perform_update(self, serializer):
        obj = self.get_object()

        # Global vendors: only admins can modify
        if obj.is_global and not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to update global vendors.")

        # Prevent non-admins from setting is_global=True on personal vendors
        is_global = self.request.data.get('is_global', obj.is_global)
        if is_global and not obj.is_global and not self.request.user.is_staff:
            raise PermissionDenied("Only admin users can create global vendors.")

        # For personal vendors: check if user is owner or has write permission via sharing
        if obj.user and obj.user.id != self.request.user.id:
            if not can_write(self.request.user, obj.user, 'vendors'):
                raise PermissionDenied("You do not have permission to update this vendor.")

        # is_global and is_premium are read_only on the serializer; pass them
        # explicitly here so that admins can update them.
        save_kwargs = {}
        if self.request.user.is_staff:
            save_kwargs['is_global'] = bool(is_global)
            is_premium = self.request.data.get('is_premium', obj.is_premium)
            save_kwargs['is_premium'] = bool(is_premium)

        serializer.save(**save_kwargs)
    
    def perform_destroy(self, instance):
        # Global vendors: only admins can delete
        if instance.is_global and not self.request.user.is_staff:
            raise PermissionDenied("You do not have permission to delete global vendors.")
        
        # For personal vendors: check if user is owner or has write permission via sharing
        if instance.user and instance.user.id != self.request.user.id:
            if not can_write(self.request.user, instance.user, 'vendors'):
                raise PermissionDenied("You do not have permission to delete this vendor.")
        
        instance.delete()
    
    def _toggle_preference(self, request, pk, field_name):
        """
        Toggle a boolean preference field (is_favorite or is_saved) on the
        UserVendorPreference record for the requesting user and the given vendor.
        """
        vendor = self.get_object()
        pref, _created = UserVendorPreference.objects.get_or_create(
            user=request.user,
            vendor=vendor,
        )
        setattr(pref, field_name, not getattr(pref, field_name))
        pref.save()
        return pref, vendor

    @action(detail=True, methods=['post'])
    def toggle_favorite(self, request, pk=None):
        """
        Toggle the favorite status of a vendor for the current user.
        This works for both personal and global vendors.
        """
        pref, vendor = self._toggle_preference(request, pk, 'is_favorite')
        serializer = self.get_serializer(vendor)
        return Response(
            {"detail": f"Vendor {'added to' if pref.is_favorite else 'removed from'} favorites", **serializer.data},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def toggle_saved(self, request, pk=None):
        """
        Toggle the saved status of a vendor for the current user.
        Saved vendors appear in My Vendors tab as references to global vendors.
        """
        pref, vendor = self._toggle_preference(request, pk, 'is_saved')
        serializer = self.get_serializer(vendor)
        return Response(
            {"detail": f"Vendor {'saved to' if pref.is_saved else 'removed from'} My Vendors", **serializer.data},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='send-email')
    def send_email(self, request, pk=None):
        vendor = self.get_object()
        if not vendor.email:
            return Response({'error': 'Vendor has no email address.'}, status=status.HTTP_400_BAD_REQUEST)

        subject = request.data.get('subject', '').strip()
        message = request.data.get('message', '').strip()
        if not subject or not message:
            return Response({'error': 'Subject and message are required.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.core.mail import send_mail
        from django.conf import settings as django_settings
        recipient = django_settings.DEBUG_EMAIL_RECIPIENT or vendor.email
        send_mail(subject, message, django_settings.DEFAULT_FROM_EMAIL, [recipient], fail_silently=False)
        return Response({'status': 'Email sent.'})

class MaintenanceTaskViewSet(OwnerPermissionMixin, viewsets.ModelViewSet):
    serializer_class = MaintenanceTaskSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['property', 'status', 'task_type', 'vendor']
    ordering_fields = ['created_date', 'created_at']
    permission_classes = [IsAuthenticated]
    owner_resource_type = 'tasks'

    def get_queryset(self):
        # Return tasks for current user and shared tasks
        user = self.request.user
        shared_users = DataShare.objects.filter(shared_with=user).values_list('owner_id', flat=True)
        return MaintenanceTask.objects.filter(Q(user=user) | Q(user__in=shared_users))

    def perform_create(self, serializer):
        property_obj = serializer.validated_data.get('property')
        if property_obj and property_obj.user != self.request.user:
            if not can_write(self.request.user, property_obj.user, 'tasks'):
                raise PermissionDenied("You do not have permission to add tasks to this property.")
        serializer.save(user=self.request.user)

class AttachmentViewSet(OwnerPermissionMixin, viewsets.ModelViewSet):
    serializer_class = AttachmentSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['task']
    ordering_fields = ['uploaded_at']
    permission_classes = [IsAuthenticated]
    owner_resource_type = 'attachments'

    def get_queryset(self):
        # Return attachments for current user and shared attachments
        user = self.request.user
        shared_users = DataShare.objects.filter(shared_with=user).values_list('owner_id', flat=True)
        return Attachment.objects.filter(Q(user=user) | Q(user__in=shared_users))

    def perform_create(self, serializer):
        # Automatically set the current user
        serializer.save(user=self.request.user)


class DataShareViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing data sharing between users.
    Users can create shares (own data), view shares received, and delete/update shares they created.
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [OrderingFilter]
    ordering_fields = ['created_at']
    
    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action in ['create', 'update', 'partial_update']:
            return CreateDataShareSerializer
        return DataShareSerializer
    
    def get_queryset(self):
        """Return shares created by the user or shared with the user"""
        user = self.request.user
        return DataShare.objects.filter(Q(owner=user) | Q(shared_with=user))
    
    def perform_create(self, serializer):
        """Create a new share with the current user as owner"""
        serializer.save(owner=self.request.user)
    
    def create(self, request, *args, **kwargs):
        """Override create to return full DataShare data in response"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        
        # Get the created instance and serialize it with DataShareSerializer
        instance = serializer.instance
        output_serializer = DataShareSerializer(instance)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_update(self, serializer):
        """Allow only the owner to update share permissions"""
        obj = self.get_object()
        if obj.owner != self.request.user:
            raise PermissionDenied("You can only update shares you created.")
        serializer.save()
    
    def perform_destroy(self, instance):
        """Allow only the owner to delete a share"""
        if instance.owner != self.request.user:
            raise PermissionDenied("You can only delete shares you created.")
        instance.delete()

# Authentication Views
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register a new user with email"""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'message': 'User registered successfully. You can now login with your email.'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Login with email and password"""
    serializer = EmailTokenObtainPairSerializer(data=request.data)
    if serializer.is_valid():
        return Response(serializer.validated_data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)


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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_settings(request):
    """Get user settings and profile information"""
    try:
        from django.conf import settings as django_settings
        serializer = UserDetailSerializer(request.user)
        data = serializer.data
        data['debug_email_recipient'] = getattr(django_settings, 'DEBUG_EMAIL_RECIPIENT', '') or ''
        return Response(data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {'error': f'Failed to get user settings: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_user_profile(request):
    """Update user profile (email, first_name, last_name, currency)"""
    try:
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserDetailSerializer(request.user).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {'error': f'Failed to update profile: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change user password"""
    try:
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'message': 'Password changed successfully'},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {'error': f'Failed to change password: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )