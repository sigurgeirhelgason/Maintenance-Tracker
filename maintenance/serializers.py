from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import Property, Area, MaintenanceTask, TaskType, Vendor, Attachment, UserProfile, DataShare

class UserRegistrationSerializer(serializers.ModelSerializer):
    """Registration serializer - users register with email and password"""
    password = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True, min_length=6)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'password', 'password2', 'first_name', 'last_name']
    
    def validate_email(self, value):
        """Check if email is already registered"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value
    
    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match."
            })
        return data
    
    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        email = validated_data.get('email')
        
        # Use email as username
        user = User.objects.create(
            username=email,  # Set username to email for compatibility
            **validated_data
        )
        user.set_password(password)
        user.save()
        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class EmailTokenObtainPairSerializer(serializers.Serializer):
    """Custom token serializer that authenticates using email instead of username"""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        # Try to get user by email
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({
                'email': 'No user found with this email address.'
            })
        
        # Verify password
        if not user.check_password(password):
            raise serializers.ValidationError({
                'password': 'Invalid password.'
            })
        
        # Check if user is active
        if not user.is_active:
            raise serializers.ValidationError('User account is disabled.')
        
        # Import here to avoid circular imports
        from rest_framework_simplejwt.tokens import RefreshToken
        
        refresh = RefreshToken.for_user(user)
        
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
            }
        }


class PropertySimpleSerializer(serializers.ModelSerializer):
    """Lightweight property serializer without tasks/areas to avoid circular references"""
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Property
        fields = ['id', 'user', 'user_email', 'name', 'address', 'num_floors', 'has_garden', 'image', 'created_at', 'updated_at']
        read_only_fields = ['user', 'user_email', 'created_at', 'updated_at']

class PropertySerializer(serializers.ModelSerializer):
    areas = serializers.SerializerMethodField()
    tasks = serializers.SerializerMethodField()
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = Property
        fields = '__all__'
        read_only_fields = ['user', 'user_email', 'created_at', 'updated_at']

    def get_areas(self, obj):
        return AreaSerializer(obj.areas.all(), many=True, context=self.context).data

    def get_tasks(self, obj):
        return MaintenanceTaskSerializer(obj.tasks.all(), many=True, context=self.context).data

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
    speciality_details = TaskTypeSerializer(source='speciality', read_only=True)
    secondary_specialities_details = TaskTypeSerializer(source='secondary_specialities', many=True, read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True, allow_null=True)
    favorite = serializers.SerializerMethodField()
    saved = serializers.SerializerMethodField()
    
    class Meta:
        model = Vendor
        fields = '__all__'
        read_only_fields = ['user', 'user_email', 'created_at', 'updated_at', 'is_global', 'favorite', 'saved']
    
    def _get_user_pref(self, obj):
        """
        Return the UserVendorPreference for the requesting user and this vendor.

        When the vendor was loaded via PropertyViewSet's prefetch
        (to_attr='_user_prefs'), the rows are already in memory and no extra
        query is issued.  For all other call sites the preference is fetched
        with a single filter query (the original behaviour).
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        # Fast path: use the prefetched list placed by PropertyViewSet
        if hasattr(obj, '_user_prefs'):
            prefs = obj._user_prefs  # list filtered to request.user already
            return prefs[0] if prefs else None

        # Slow path: direct DB query (used by VendorViewSet and toggle actions)
        from .models import UserVendorPreference
        return UserVendorPreference.objects.filter(
            user=request.user,
            vendor=obj
        ).first()

    def get_favorite(self, obj):
        """Check if the requesting user has marked this vendor as favorite"""
        pref = self._get_user_pref(obj)
        return pref.is_favorite if pref else False

    def get_saved(self, obj):
        """Check if the requesting user has saved this vendor"""
        pref = self._get_user_pref(obj)
        return pref.is_saved if pref else False

class AttachmentSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Attachment
        fields = '__all__'
        read_only_fields = ['user', 'user_email', 'uploaded_at']

class MaintenanceTaskSerializer(serializers.ModelSerializer):
    attachments = serializers.SerializerMethodField()
    task_type_details = TaskTypeSerializer(source='task_type', read_only=True)
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    areas_details = AreaSerializer(source='areas', many=True, read_only=True)
    property_details = PropertySimpleSerializer(source='property', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = MaintenanceTask
        fields = '__all__'
        read_only_fields = ['user', 'user_email', 'created_at', 'updated_at', 'created_date']

    def validate(self, data):
        """Validate that final_price can only be set when status is 'finished'"""
        final_price = data.get('final_price')
        status = data.get('status')
        
        # If updating, also check the instance's current status if status is not being changed
        if self.instance:
            status = status or self.instance.status
        
        if final_price is not None and final_price > 0 and status != 'finished':
            raise serializers.ValidationError(
                {'final_price': 'Final price can only be set when task status is "Finished".'}
            )
        
        return data

    def get_attachments(self, obj):
        return AttachmentSerializer(obj.attachments.all(), many=True).data


class ExportSerializer(serializers.Serializer):
    """Serializer for export endpoint - accepts no input, returns file download"""
    pass


class ImportSerializer(serializers.Serializer):
    """Serializer for import endpoint - accepts ZIP file upload"""
    file = serializers.FileField(required=True, help_text='ZIP file containing datapack')


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile settings"""
    class Meta:
        model = UserProfile
        fields = ['currency', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class UserDetailSerializer(serializers.ModelSerializer):
    """Serializer for comprehensive user details including profile"""
    profile = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'profile']
        read_only_fields = ['id', 'is_staff']


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile information"""
    currency = serializers.CharField(required=False, write_only=True)
    
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'currency']
    
    def update(self, instance, validated_data):
        """Update user and create/update profile"""
        currency = validated_data.pop('currency', None)
        
        # Update User fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update UserProfile currency
        if currency:
            profile, created = UserProfile.objects.get_or_create(user=instance)
            profile.currency = currency
            profile.save()
        
        return instance


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change"""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=6)
    new_password2 = serializers.CharField(required=True, write_only=True, min_length=6)
    
    def validate(self, data):
        if data['new_password'] != data['new_password2']:
            raise serializers.ValidationError({
                'new_password': 'Password fields didn\'t match.'
            })
        return data
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Old password is incorrect.')
        return value
    
    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class DataShareSerializer(serializers.ModelSerializer):
    """Serializer for reading and listing DataShare instances"""
    owner_email = serializers.CharField(source='owner.email', read_only=True)
    owner_name = serializers.CharField(source='owner.get_full_name', read_only=True)
    shared_with_email = serializers.CharField(source='shared_with.email', read_only=True)
    shared_with_name = serializers.CharField(source='shared_with.get_full_name', read_only=True)
    
    class Meta:
        model = DataShare
        fields = ['id', 'owner', 'owner_email', 'owner_name', 
                  'shared_with', 'shared_with_email', 'shared_with_name', 
                  'permissions', 'created_at', 'updated_at']
        read_only_fields = ['owner', 'created_at', 'updated_at']


class CreateDataShareSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating DataShare instances"""
    shared_with_email = serializers.EmailField(write_only=True)
    
    class Meta:
        model = DataShare
        fields = ['shared_with_email', 'permissions']
    
    def validate_shared_with_email(self, value):
        """Verify that the email belongs to an existing user"""
        try:
            user = User.objects.get(email=value)
        except User.DoesNotExist:
            raise serializers.ValidationError(f"No user found with email '{value}'.")
        return value
    
    def validate(self, data):
        """Prevent sharing with self"""
        request_user = self.context['request'].user
        email = data.get('shared_with_email')
        
        if request_user.email == email:
            raise serializers.ValidationError("You cannot share data with yourself.")
        
        return data
    
    def create(self, validated_data):
        """Create a new DataShare instance"""
        shared_with_email = validated_data.pop('shared_with_email')
        shared_with_user = User.objects.get(email=shared_with_email)
        owner = self.context['request'].user
        
        # Set default permissions if not provided
        permissions = validated_data.get('permissions', {})
        if not permissions:
            permissions = {
                'properties': 'rw',
                'tasks': 'rw',
                'vendors': 'rw',
                'areas': 'rw',
                'attachments': 'rw',
            }
        
        data_share = DataShare.objects.create(
            owner=owner,
            shared_with=shared_with_user,
            permissions=permissions
        )
        return data_share
    
    def update(self, instance, validated_data):
        """Update permissions for an existing DataShare"""
        instance.permissions = validated_data.get('permissions', instance.permissions)
        instance.save()
        return instance