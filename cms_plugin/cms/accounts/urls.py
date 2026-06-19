from django.urls import path
from cms.authentication import Auth
from .views import MeView, user_list, user_update, user_create, user_delete, users_by_units

urlpatterns = [
    path('me/', MeView.as_view(), name='auth-me'),
    path('users/', user_list),
    path('users/create/', user_create),
    path('users/<int:pk>/', user_update),
    path('users/<int:pk>/delete/', user_delete),
    path('users-by-units/', users_by_units),
]
