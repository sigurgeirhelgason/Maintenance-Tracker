from rest_framework.routers import DefaultRouter
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    PropertyViewSet, AreaViewSet, MaintenanceTaskViewSet,
    VendorViewSet, AttachmentViewSet, TaskTypeViewSet, DataShareViewSet,
    register, login, get_current_user, export_datapack, import_datapack,
    get_user_settings, update_user_profile, change_password, lookup_postal_code
)

router = DefaultRouter()
router.register(r'properties', PropertyViewSet, basename='property')
router.register(r'areas', AreaViewSet, basename='area')
router.register(r'tasktypes', TaskTypeViewSet, basename='tasktype')
router.register(r'tasks', MaintenanceTaskViewSet, basename='maintenancetask')
router.register(r'vendors', VendorViewSet, basename='vendor')
router.register(r'attachments', AttachmentViewSet, basename='attachment')
router.register(r'datashare', DataShareViewSet, basename='datashare')

urlpatterns = [
    # Authentication endpoints
    path('auth/login/', login, name='login'),
    path('auth/register/', register, name='register'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('user/me/', get_current_user, name='get_current_user'),
    # Export/Import endpoints
    path('export/', export_datapack, name='export_datapack'),
    path('import/', import_datapack, name='import_datapack'),
    # User settings endpoints
    path('user/settings/', get_user_settings, name='get_user_settings'),
    path('user/settings/update/', update_user_profile, name='update_user_profile'),
    path('user/settings/change-password/', change_password, name='change_password'),
    # Postal code lookup
    path('postal-code/lookup/', lookup_postal_code, name='lookup_postal_code'),
] + router.urls