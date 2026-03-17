from rest_framework.routers import DefaultRouter
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    PropertyViewSet, AreaViewSet, MaintenanceTaskViewSet,
    VendorViewSet, AttachmentViewSet, TaskTypeViewSet,
    register, get_current_user, export_datapack, import_datapack
)

router = DefaultRouter()
router.register(r'properties', PropertyViewSet, basename='property')
router.register(r'areas', AreaViewSet, basename='area')
router.register(r'tasktypes', TaskTypeViewSet, basename='tasktype')
router.register(r'tasks', MaintenanceTaskViewSet, basename='maintenancetask')
router.register(r'vendors', VendorViewSet, basename='vendor')
router.register(r'attachments', AttachmentViewSet, basename='attachment')

urlpatterns = [
    # Authentication endpoints
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', register, name='register'),
    path('user/me/', get_current_user, name='get_current_user'),
    # Export/Import endpoints
    path('export/', export_datapack, name='export_datapack'),
    path('import/', import_datapack, name='import_datapack'),
] + router.urls