from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomMenuViewSet

router = DefaultRouter()
router.register('custom-menus', CustomMenuViewSet, basename='custom-menus')

urlpatterns = [path('', include(router.urls))]
