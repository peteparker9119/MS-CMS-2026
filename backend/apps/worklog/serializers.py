from rest_framework import serializers
from .models import WorkTask, WorkEntry, WorkComment


class WorkCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = WorkComment
        fields = ['id', 'user', 'user_name', 'username', 'text', 'created_at']
        read_only_fields = ['id', 'user', 'user_name', 'username', 'created_at']


class WorkEntrySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = WorkEntry
        fields = ['id', 'task', 'user', 'user_name', 'username', 'description', 'work_hours', 'date', 'logged_at']
        read_only_fields = ['id', 'task', 'user', 'user_name', 'username', 'date', 'logged_at']


class WorkTaskListSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True)
    entry_count = serializers.IntegerField(source='entries.count', read_only=True)
    comment_count = serializers.IntegerField(source='comments.count', read_only=True)

    class Meta:
        model = WorkTask
        fields = [
            'id', 'title', 'description',
            'assigned_to', 'assigned_to_name',
            'created_by', 'created_by_name',
            'unit', 'unit_name',
            'deadline', 'status', 'priority',
            'started_at', 'completed_at', 'hours_taken',
            'created_at', 'updated_at',
            'entry_count', 'comment_count',
        ]
        read_only_fields = [
            'id', 'created_by', 'created_by_name',
            'assigned_to_name', 'unit_name',
            'entry_count', 'comment_count',
            'started_at', 'completed_at', 'hours_taken',
            'created_at', 'updated_at',
        ]


class WorkTaskDetailSerializer(WorkTaskListSerializer):
    entries = WorkEntrySerializer(many=True, read_only=True)
    comments = WorkCommentSerializer(many=True, read_only=True)

    class Meta(WorkTaskListSerializer.Meta):
        fields = WorkTaskListSerializer.Meta.fields + ['entries', 'comments']
