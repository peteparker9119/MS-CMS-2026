from rest_framework import serializers
from .models import ReviewTemplate, ReviewCriterion, ReviewEntry, ReviewScore


class ReviewCriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewCriterion
        fields = ['id', 'template', 'label', 'max_score', 'order']
        read_only_fields = ['id']


class ReviewScoreSerializer(serializers.ModelSerializer):
    criterion_label = serializers.CharField(source='criterion.label', read_only=True)
    criterion_max = serializers.IntegerField(source='criterion.max_score', read_only=True)

    class Meta:
        model = ReviewScore
        fields = ['id', 'entry', 'criterion', 'criterion_label', 'criterion_max', 'score', 'notes']
        read_only_fields = ['id', 'entry', 'criterion_label', 'criterion_max']


class ReviewTemplateSerializer(serializers.ModelSerializer):
    criteria = ReviewCriterionSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True)

    class Meta:
        model = ReviewTemplate
        fields = [
            'id', 'title', 'unit', 'unit_name', 'description', 'frequency',
            'created_by', 'created_by_name', 'active', 'created_at', 'criteria',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at']


class ReviewEntrySerializer(serializers.ModelSerializer):
    scores = ReviewScoreSerializer(many=True, read_only=True)
    scores_input = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )
    reviewer_name = serializers.CharField(source='reviewer.get_full_name', read_only=True)
    reviewee_name = serializers.CharField(source='reviewee.get_full_name', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True)
    template_title = serializers.CharField(source='template.title', read_only=True)
    average_score = serializers.SerializerMethodField()

    class Meta:
        model = ReviewEntry
        fields = [
            'id', 'template', 'template_title',
            'reviewer', 'reviewer_name',
            'reviewee', 'reviewee_name',
            'unit', 'unit_name',
            'date', 'overall_notes', 'created_at',
            'scores', 'scores_input',
            'average_score',
        ]
        read_only_fields = ['id', 'reviewer', 'reviewer_name', 'created_at']

    def get_average_score(self, obj):
        scores = obj.scores.all()
        if not scores:
            return None
        return round(sum(s.score for s in scores) / len(scores), 2)

    def create(self, validated_data):
        scores_input = validated_data.pop('scores_input', [])
        entry = ReviewEntry.objects.create(**validated_data)
        for score_data in scores_input:
            ReviewScore.objects.create(
                entry=entry,
                criterion_id=score_data['criterion'],
                score=score_data['score'],
                notes=score_data.get('notes', ''),
            )
        return entry

    def update(self, instance, validated_data):
        scores_input = validated_data.pop('scores_input', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if scores_input is not None:
            instance.scores.all().delete()
            for score_data in scores_input:
                ReviewScore.objects.create(
                    entry=instance,
                    criterion_id=score_data['criterion'],
                    score=score_data['score'],
                    notes=score_data.get('notes', ''),
                )
        return instance
