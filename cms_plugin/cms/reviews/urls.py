from django.urls import path, include
from rest_framework.routers import DefaultRouter
from cms.authentication import Auth
from .views import ReviewTemplateViewSet, ReviewEntryViewSet, reviews_summary

router = DefaultRouter()
router.register(r'review-templates', ReviewTemplateViewSet, basename='reviewtemplate')
router.register(r'review-entries', ReviewEntryViewSet, basename='reviewentry')

urlpatterns = [
    path('', include(router.urls)),
    path('reviews/summary/', reviews_summary, name='reviews-summary'),
]
