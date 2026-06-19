from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Task, TaskAssignment, TaskActivity

User = get_user_model()


class TaskActivitySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskActivity
        fields = ['id', 'text', 'activity_type', 'support_needed', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at', 'created_by_name']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'System'


class TaskAssignmentSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    assigned_to_unit = serializers.SerializerMethodField()
    activities       = TaskActivitySerializer(many=True, read_only=True)
    assigned_to      = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = TaskAssignment
        fields = [
            'id', 'task', 'assigned_to', 'assigned_to_name', 'assigned_to_unit',
            'start_date', 'deadline', 'status', 'created_at', 'activities',
        ]
        read_only_fields = ['id', 'created_at']

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() or obj.assigned_to.username

    def get_assigned_to_unit(self, obj):
        if obj.assigned_to.unit:
            return {'id': obj.assigned_to.unit.id, 'abbr': obj.assigned_to.unit.abbr, 'color': obj.assigned_to.unit.color}
        return None


class TaskSerializer(serializers.ModelSerializer):
    assignments_count = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'order', 'created_at', 'assignments_count']
        read_only_fields = ['id', 'created_at']

    def get_assignments_count(self, obj):
        return obj.assignments.count()
