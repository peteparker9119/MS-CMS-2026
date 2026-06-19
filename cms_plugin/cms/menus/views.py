import logging
from django.db.models import Count
from rest_framework import viewsets, status

logger = logging.getLogger('cms')
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from cms.accounts.permissions import IsAdmin, IsAdminOrReadOnly
from .models import CustomMenu, MenuField, MenuEntry
from .serializers import (
    CustomMenuSerializer, CustomMenuWriteSerializer,
    MenuFieldSerializer, MenuEntrySerializer,
)


class CustomMenuViewSet(viewsets.ModelViewSet):
    queryset = (
        CustomMenu.objects
        .prefetch_related('fields')
        .annotate(entry_count=Count('entries'))
        .all()
    )

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        # entries POST is open to authenticated users; everything else needs admin
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return CustomMenuWriteSerializer
        return CustomMenuSerializer

    def create(self, request, *args, **kwargs):
        if not request.user.is_staff and getattr(request.user, 'role', '') != 'admin':
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not request.user.is_staff and getattr(request.user, 'role', '') != 'admin':
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_staff and getattr(request.user, 'role', '') != 'admin':
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # EC-10: log access attempts to inactive/unconfigured menus for admin review
        if not instance.is_active:
            logger.warning(
                'EC-10 inactive menu accessed: menu=%s (id=%s) by user=%s',
                instance.name, instance.pk, request.user.username,
            )
        if not instance.fields.exists():
            logger.info(
                'EC-10 menu with no fields accessed: menu=%s (id=%s) — may need configuration',
                instance.name, instance.pk,
            )
        return Response(CustomMenuSerializer(instance, context={'request': request}).data)

    @action(detail=True, methods=['post', 'put', 'delete'], url_path=r'fields(?:/(?P<field_id>\d+))?')
    def manage_field(self, request, pk=None, field_id=None):
        if not request.user.is_staff and getattr(request.user, 'role', '') != 'admin':
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)
        menu = self.get_object()
        if request.method == 'DELETE':
            MenuField.objects.filter(pk=field_id, menu=menu).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        if field_id:
            field = MenuField.objects.get(pk=field_id, menu=menu)
            ser = MenuFieldSerializer(field, data=request.data, partial=True)
        else:
            ser = MenuFieldSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(menu=menu)
        return Response(ser.data, status=status.HTTP_201_CREATED if not field_id else status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='entries')
    def entries(self, request, pk=None):
        menu = self.get_object()
        if request.method == 'GET':
            # Admin sees all; others see only their own
            if getattr(request.user, 'role', '') == 'admin' or request.user.is_staff:
                qs = menu.entries.select_related('submitted_by').all()
            else:
                qs = menu.entries.filter(submitted_by=request.user)
            return Response(MenuEntrySerializer(qs, many=True).data)

        ser = MenuEntrySerializer(
            data={'menu': menu.id, 'data': request.data.get('data', {})},
            context={'request': request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(menu=menu)
        return Response(ser.data, status=status.HTTP_201_CREATED)
