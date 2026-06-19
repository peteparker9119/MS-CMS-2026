from rest_framework import serializers
from .models import CustomMenu, MenuField, MenuEntry


class MenuFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MenuField
        fields = ['id', 'label', 'field_key', 'field_type', 'placeholder', 'options', 'required', 'order']


class CustomMenuSerializer(serializers.ModelSerializer):
    fields      = MenuFieldSerializer(many=True, read_only=True)
    entry_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model  = CustomMenu
        fields = [
            'id', 'name', 'slug', 'icon', 'description', 'access',
            'is_active', 'order', 'created_at', 'fields', 'entry_count',
        ]
        read_only_fields = ['id', 'created_at']


class CustomMenuWriteSerializer(serializers.ModelSerializer):
    fields_data = MenuFieldSerializer(many=True, required=False, write_only=True)

    class Meta:
        model  = CustomMenu
        fields = ['id', 'name', 'slug', 'icon', 'description', 'access', 'is_active', 'order', 'fields_data']
        read_only_fields = ['id']

    def create(self, validated_data):
        fields_data = validated_data.pop('fields_data', [])
        menu = CustomMenu.objects.create(**validated_data)
        for f in fields_data:
            MenuField.objects.create(menu=menu, **f)
        return menu

    def update(self, instance, validated_data):
        fields_data = validated_data.pop('fields_data', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if fields_data is not None:
            instance.fields.all().delete()
            for f in fields_data:
                MenuField.objects.create(menu=instance, **f)
        return instance


class MenuEntrySerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = MenuEntry
        fields = ['id', 'menu', 'submitted_by', 'submitted_by_name', 'data', 'submitted_at']
        read_only_fields = ['id', 'submitted_by', 'submitted_by_name', 'submitted_at']

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            name = f'{obj.submitted_by.first_name} {obj.submitted_by.last_name}'.strip()
            return name or obj.submitted_by.username
        return 'Anonymous'

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['submitted_by'] = request.user
        return super().create(validated_data)
