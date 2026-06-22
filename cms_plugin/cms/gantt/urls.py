from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GanttTaskViewSet

router = DefaultRouter()
router.register(r'gantt', GanttTaskViewSet, basename='gantttask')

urlpatterns = [
    path('', include(router.urls)),
]
