from django.urls import path, include
from rest_framework.routers import DefaultRouter
from cms.authentication import Auth
from .views import ItemViewSet

router = DefaultRouter()
router.register('items', ItemViewSet, basename='item')

urlpatterns = [path('', include(router.urls))]
