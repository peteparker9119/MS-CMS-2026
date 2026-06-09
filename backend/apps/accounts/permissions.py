import logging
from rest_framework.permissions import BasePermission

logger = logging.getLogger('cms')

VALID_ROLES = {'admin', 'poc'}


def _check_role(user):
    """EC-06: log and fall back to restricted access if role is unknown."""
    role = getattr(user, 'role', None)
    if role not in VALID_ROLES:
        logger.error(
            'EC-06 role mapping failure: user=%s has unrecognised role=%r — defaulting to restricted',
            getattr(user, 'username', user), role,
        )
        return False
    return True


class IsAdmin(BasePermission):
    """Allow access only to users with role='admin'."""
    message = 'Admin access required.'

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if not _check_role(request.user):
            return False
        if request.user.role != 'admin':
            logger.warning(
                'EC-01 unauthorized access attempt: user=%s role=%s path=%s',
                request.user.username, request.user.role, request.path,
            )
            return False
        return True


class IsAdminOrReadOnly(BasePermission):
    """Read access for any authenticated user; write access only for admins."""
    message = 'Admin access required for write operations.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not _check_role(request.user):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if request.user.role != 'admin':
            logger.warning(
                'EC-01 unauthorized write attempt: user=%s role=%s path=%s method=%s',
                request.user.username, request.user.role, request.path, request.method,
            )
            return False
        return True


class IsPOCUploadAdminView(BasePermission):
    """
    D.O. Letters access model:
      - GET/HEAD/OPTIONS  → any authenticated user (admin + all POC)
      - POST (upload)     → POC only
      - DELETE            → admin or the POC who uploaded (object level)
    """
    message = 'Only unit POCs can upload letters.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if request.method == 'POST':
            return request.user.role == 'poc'
        if request.method == 'DELETE':
            return True  # narrowed further in has_object_permission
        return False

    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if request.method == 'DELETE':
            return request.user.role == 'admin' or obj.uploaded_by_id == request.user.id
        return False
