from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DOLetterViewSet

router = DefaultRouter()
router.register(r'do-letters', DOLetterViewSet, basename='doletter')

urlpatterns = [
    path('', include(router.urls)),
]
