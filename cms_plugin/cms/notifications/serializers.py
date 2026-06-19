from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Notification
        fields = [
            'id', 'title', 'message', 'notif_type', 'object_id',
            'read', 'created_at',
            'action_type', 'action_data', 'responded', 'response',
        ]
        read_only_fields = [
            'id', 'title', 'message', 'notif_type', 'object_id', 'created_at',
            'action_type', 'action_data',
        ]
