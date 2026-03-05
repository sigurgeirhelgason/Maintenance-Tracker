from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import (
    PropertyViewSet, AreaViewSet, MaintenanceTaskViewSet,
    VendorViewSet, AttachmentViewSet, TaskTypeViewSet
)

router = DefaultRouter()
router.register(r'properties', PropertyViewSet)
router.register(r'areas', AreaViewSet)
router.register(r'tasktypes', TaskTypeViewSet)
router.register(r'tasks', MaintenanceTaskViewSet)
router.register(r'vendors', VendorViewSet)
router.register(r'attachments', AttachmentViewSet)

urlpatterns = router.urls