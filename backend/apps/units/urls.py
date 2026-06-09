from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConvergenceUnitViewSet, UnitPairViewSet

router = DefaultRouter()
router.register('units', ConvergenceUnitViewSet)
router.register('pairs', UnitPairViewSet)

urlpatterns = [path('', include(router.urls))]
