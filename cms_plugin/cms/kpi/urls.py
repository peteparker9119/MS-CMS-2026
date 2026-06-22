from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KPIDefinitionViewSet, KPIEntryViewSet, kpi_summary

router = DefaultRouter()
router.register(r'kpis', KPIDefinitionViewSet, basename='kpidefinition')
router.register(r'kpi-entries', KPIEntryViewSet, basename='kpientry')

urlpatterns = [
    path('', include(router.urls)),
    path('kpi-summary/', kpi_summary, name='kpi-summary'),
]
