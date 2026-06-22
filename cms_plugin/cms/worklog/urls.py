from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkTaskViewSet

router = DefaultRouter()
router.register(r'tasks', WorkTaskViewSet, basename='worktask')

urlpatterns = [
    path('', include(router.urls)),
]
