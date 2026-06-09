from rest_framework import serializers
from .models import GanttTask


class GanttTaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True)
    subtasks = serializers.SerializerMethodField()

    class Meta:
        model = GanttTask
        fields = [
            'id', 'title', 'description',
            'unit', 'unit_name',
            'assigned_to', 'assigned_to_name',
            'start_date', 'end_date',
            'milestone', 'parent',
            'color', 'progress',
            'academic_year',
            'created_by', 'created_by_name',
            'created_at',
            'subtasks',
        ]
        read_only_fields = ['id', 'created_at', 'created_by', 'created_by_name', 'assigned_to_name', 'unit_name', 'subtasks']

    def get_subtasks(self, obj):
        children = obj.subtasks.all()
        return GanttTaskSerializer(children, many=True, context=self.context).data
