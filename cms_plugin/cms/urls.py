from django.urls import path, include

urlpatterns = [
    path('units/', include('cms.units.urls')),
    path('meetings/', include('cms.meetings.urls')),
    path('items/', include('cms.items.urls')),
    path('worklog/', include('cms.worklog.urls')),
    path('kpi/', include('cms.kpi.urls')),
    path('gantt/', include('cms.gantt.urls')),
    path('reviews/', include('cms.reviews.urls')),
    path('documents/', include('cms.documents.urls')),
    path('notifications/', include('cms.notifications.urls')),
    path('menus/', include('cms.menus.urls')),
    path('accounts/', include('cms.accounts.urls')),
    path('taskboard/', include('cms.taskboard.urls')),
]
