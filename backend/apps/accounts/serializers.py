from rest_framework import serializers
from .models import User
from apps.units.models import ConvergenceUnit


class UserSerializer(serializers.ModelSerializer):
    unit_slug  = serializers.CharField(source='unit.slug',  read_only=True, allow_null=True)
    unit_name  = serializers.CharField(source='unit.name',  read_only=True, allow_null=True)
    unit_color = serializers.CharField(source='unit.color', read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'is_team_lead', 'menu_permissions',
            'unit_slug', 'unit_name', 'unit_color',
        ]
        read_only_fields = ['id']


class AdminUserSerializer(serializers.ModelSerializer):
    unit_slug  = serializers.CharField(source='unit.slug',  read_only=True, allow_null=True)
    unit_name  = serializers.CharField(source='unit.name',  read_only=True, allow_null=True)
    unit_color = serializers.CharField(source='unit.color', read_only=True, allow_null=True)
    unit_id    = serializers.PrimaryKeyRelatedField(
        queryset=ConvergenceUnit.objects.all(),
        source='unit', allow_null=True, required=False,
    )

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'is_team_lead', 'menu_permissions',
            'unit_id', 'unit_slug', 'unit_name', 'unit_color',
            'is_active',
        ]

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save(update_fields=['password'])
        return instance


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    unit_id  = serializers.PrimaryKeyRelatedField(
        queryset=ConvergenceUnit.objects.all(),
        source='unit', allow_null=True, required=False,
    )

    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'password', 'role', 'is_team_lead', 'menu_permissions', 'unit_id',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
