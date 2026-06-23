from rest_framework import permissions
from .models import Role, LecturerCourse
from students.models import Student


def has_role(user, role_name):
    """Helper function to check if user has a specific role."""
    if not user or not user.is_authenticated:
        return False
    return user.user_roles.filter(role__name=role_name).exists()


def is_administrator(user):
    """Check if user is an administrator (ADMIN role or Django superuser/staff)."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return True
    return has_role(user, 'ADMIN')


def is_lecturer(user):
    """Check if user is a lecturer."""
    return has_role(user, 'LECTURER')


def is_student(user):
    """Check if user is a student."""
    return has_role(user, 'STUDENT')


def get_lecturer_modules(user):
    """Get modules assigned to a lecturer."""
    if not is_lecturer(user):
        return []
    return LecturerCourse.objects.filter(user=user).values_list('module_code', flat=True)


class IsAdministrator(permissions.BasePermission):
    """Permission check for Administrator role."""
    def has_permission(self, request, view):
        return is_administrator(request.user)


class IsLecturer(permissions.BasePermission):
    """Permission check for Lecturer role."""
    def has_permission(self, request, view):
        return is_lecturer(request.user)


class IsStudent(permissions.BasePermission):
    """Permission check for Student role."""
    def has_permission(self, request, view):
        return is_student(request.user)


class IsAdministratorOrLecturer(permissions.BasePermission):
    """Permission check for Administrator or Lecturer roles."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return is_administrator(request.user) or is_lecturer(request.user)


class StudentPermission(permissions.BasePermission):
    """Permission for Student model - ADMIN: full access, LECTURER: read assigned courses, STUDENT: own records only."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Administrators have full access
        if is_administrator(request.user):
            return True
        
        # Lecturers can read students enrolled in their assigned modules
        if is_lecturer(request.user):
            return request.method in permissions.SAFE_METHODS
        
        # Students can read their own records
        if is_student(request.user):
            return request.method in permissions.SAFE_METHODS
        
        return False
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permissions."""
        # Administrators have full access
        if is_administrator(request.user):
            return True
        
        # Lecturers can read students enrolled in their assigned modules
        if is_lecturer(request.user):
            if request.method in permissions.SAFE_METHODS:
                # Check if student is enrolled in any module assigned to lecturer
                lecturer_modules = get_lecturer_modules(request.user)
                from enrollments.models import StudentModule
                return StudentModule.objects.filter(
                    student=obj,
                    module__module_code__in=lecturer_modules
                ).exists()
            return False
        
        # Students can only access their own record
        if is_student(request.user):
            if request.method in permissions.SAFE_METHODS:
                # Check if student_id matches user's student record
                try:
                    student = Student.objects.get(student_id=request.user.username)
                    return obj.student_id == student.student_id
                except Student.DoesNotExist:
                    return False
            return False
        
        return False


class CoursePermission(permissions.BasePermission):
    """Permission for Programme/Module models - ADMIN: full access, LECTURER: read assigned courses, STUDENT: read only."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Administrators have full access
        if is_administrator(request.user):
            return True
        
        # Lecturers can read assigned modules
        if is_lecturer(request.user):
            return request.method in permissions.SAFE_METHODS
        
        # Students can read courses
        if is_student(request.user):
            return request.method in permissions.SAFE_METHODS
        
        return False
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permissions."""
        # Administrators have full access
        if is_administrator(request.user):
            return True
        
        # Lecturers can read modules assigned to them
        if is_lecturer(request.user):
            if request.method in permissions.SAFE_METHODS:
                lecturer_modules = get_lecturer_modules(request.user)
                # For modules, check if module_code is in lecturer's assignments
                if hasattr(obj, 'module_code'):
                    return obj.module_code in lecturer_modules
                # For programmes, check if any associated modules are assigned
                elif hasattr(obj, 'module_associations'):
                    return obj.module_associations.filter(
                        module__module_code__in=lecturer_modules
                    ).exists()
            return False
        
        # Students can read all courses
        if is_student(request.user):
            return request.method in permissions.SAFE_METHODS
        
        return False


class EnrollmentPermission(permissions.BasePermission):
    """Permission for StudentProgram/StudentModule - ADMIN: full access, LECTURER: read assigned courses, STUDENT: own enrollments only."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Administrators have full access
        if is_administrator(request.user):
            return True
        
        # Lecturers can read enrollments for assigned modules
        if is_lecturer(request.user):
            return request.method in permissions.SAFE_METHODS
        
        # Students can read their own enrollments
        if is_student(request.user):
            return request.method in permissions.SAFE_METHODS
        
        return False
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permissions."""
        # Administrators have full access
        if is_administrator(request.user):
            return True
        
        # Lecturers can read enrollments for their assigned modules
        if is_lecturer(request.user):
            if request.method in permissions.SAFE_METHODS:
                lecturer_modules = get_lecturer_modules(request.user)
                # Check if enrollment is for a module assigned to lecturer
                if hasattr(obj, 'module'):
                    return obj.module.module_code in lecturer_modules
                elif hasattr(obj, 'programme'):
                    # For programme enrollments, check if student is enrolled in any assigned module
                    from enrollments.models import StudentModule
                    return StudentModule.objects.filter(
                        student=obj.student,
                        module__module_code__in=lecturer_modules
                    ).exists()
            return False
        
        # Students can only access their own enrollments
        if is_student(request.user):
            if request.method in permissions.SAFE_METHODS:
                try:
                    student = Student.objects.get(student_id=request.user.username)
                    return obj.student.student_id == student.student_id
                except Student.DoesNotExist:
                    return False
            return False
        
        return False


class ResultPermission(permissions.BasePermission):
    """Permission for StudentResult - ADMIN: full access, LECTURER: read/create/update assigned courses, STUDENT: own results only."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Administrators have full access
        if is_administrator(request.user):
            return True
        
        # Lecturers can read and create/update results for assigned modules
        if is_lecturer(request.user):
            return True
        
        # Students can read their own results
        if is_student(request.user):
            return request.method in permissions.SAFE_METHODS
        
        return False
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permissions."""
        # Administrators have full access
        if is_administrator(request.user):
            return True
        
        # Lecturers can read and update results for their assigned modules
        if is_lecturer(request.user):
            lecturer_modules = get_lecturer_modules(request.user)
            if obj.module.module_code in lecturer_modules:
                # Can read and update, but not delete
                return request.method in ['GET', 'PUT', 'PATCH']
            return False
        
        # Students can only read their own results
        if is_student(request.user):
            if request.method in permissions.SAFE_METHODS:
                try:
                    student = Student.objects.get(student_id=request.user.username)
                    return obj.student.student_id == student.student_id
                except Student.DoesNotExist:
                    return False
            return False
        
        return False
