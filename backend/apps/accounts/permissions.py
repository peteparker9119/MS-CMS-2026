import logging
from rest_framework.permissions import BasePermission

logger = logging.getLogger('cms')

VALID_ROLES = {'super_admin', 'admin', 'poc', 'team'}

# Roles with admin-level privileges
ADMIN_ROLES     = {'super_admin', 'admin'}
# Roles that can access daily work / team activity
TEAM_ROLES      = {'super_admin', 'poc', 'team'}


def _check_role(user):
    role = getattr(user, 'role', None)
    if role not in VALID_ROLES:
        logger.error(
            'EC-06 role mapping failure: user=%s has unrecognised role=%r — defaulting to restricted',
            getattr(user, 'username', user), role,
        )
        return False
    return True


class IsSuperAdmin(BasePermission):
    """Allow access only to super_admin."""
    message = 'Super admin access required.'

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return _check_role(request.user) and request.user.role == 'super_admin'


class IsAdmin(BasePermission):
    """Allow access to super_admin and admin."""
    message = 'Admin access required.'

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if not _check_role(request.user):
            return False
        if request.user.role not in ADMIN_ROLES:
            logger.warning(
                'EC-01 unauthorized access attempt: user=%s role=%s path=%s',
                request.user.username, request.user.role, request.path,
            )
            return False
        return True


class IsAdminOrReadOnly(BasePermission):
    """Read access for any authenticated user; write access only for admin roles."""
    message = 'Admin access required for write operations.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not _check_role(request.user):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if request.user.role not in ADMIN_ROLES:
            logger.warning(
                'EC-01 unauthorized write attempt: user=%s role=%s path=%s method=%s',
                request.user.username, request.user.role, request.path, request.method,
            )
            return False
        return True


class IsPOCUploadAdminView(BasePermission):
    """
    D.O. Letters access:
      - GET  → any authenticated user
      - POST → admin roles or POC
      - DELETE → admin roles or the uploader
    """
    message = 'Only unit reps or admins can upload letters.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if request.method == 'POST':
            return request.user.role in ('super_admin', 'admin', 'poc')
        if request.method == 'DELETE':
            return True
        return False

    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if request.method == 'DELETE':
            return request.user.role in ADMIN_ROLES or obj.uploaded_by_id == request.user.id
        return False
