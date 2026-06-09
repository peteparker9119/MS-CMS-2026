from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CMSTokenObtainPairView, MeView, user_list, user_update, user_create, user_delete, logout_view, users_by_units

urlpatterns = [
    path('login/', CMSTokenObtainPairView.as_view(), name='auth-login'),
    path('logout/', logout_view, name='auth-logout'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('users/', user_list),
    path('users/create/', user_create),
    path('users/<int:pk>/', user_update),
    path('users/<int:pk>/delete/', user_delete),
    path('users-by-units/', users_by_units),
]
