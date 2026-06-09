from rest_framework.routers import DefaultRouter
from .views import CustomMenuViewSet

router = DefaultRouter()
router.register('custom-menus', CustomMenuViewSet, basename='custom-menus')

urlpatterns = router.urls
