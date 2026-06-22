from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from .serializers import UserSerializer

User = get_user_model()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Forbidden'}, status=403)
    users = User.objects.all().select_related('unit')
    from .serializers import AdminUserSerializer
    return Response(AdminUserSerializer(users, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def user_update(request, pk):
    if request.user.role != 'admin':
        return Response({'detail': 'Forbidden'}, status=403)
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'Not found'}, status=404)
    from .serializers import AdminUserSerializer
    serializer = AdminUserSerializer(user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def user_create(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Forbidden'}, status=403)
    from .serializers import AdminUserCreateSerializer, AdminUserSerializer
    serializer = AdminUserCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(AdminUserSerializer(user).data, status=201)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def user_delete(request, pk):
    if request.user.role != 'admin':
        return Response({'detail': 'Forbidden'}, status=403)
    if str(pk) == str(request.user.pk):
        return Response({'detail': 'Cannot delete yourself'}, status=400)
    try:
        User.objects.get(pk=pk).delete()
    except User.DoesNotExist:
        return Response({'detail': 'Not found'}, status=404)
    return Response(status=204)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def users_by_units(request):
    """Return active users belonging to the given unit IDs (for assignment dropdowns)."""
    unit_ids = request.query_params.getlist('unit_ids')
    if not unit_ids:
        return Response([])
    users = (User.objects
             .filter(unit_id__in=unit_ids, is_active=True)
             .select_related('unit'))
    data = [
        {
            'id':       u.id,
            'name':     u.get_full_name() or u.username,
            'username': u.username,
            'unit_id':  u.unit_id,
        }
        for u in users
    ]
    return Response(data)
