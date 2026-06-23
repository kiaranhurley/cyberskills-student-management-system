from rest_framework import serializers
import re
from .models import Student


class StudentSerializer(serializers.ModelSerializer):
    """Serializer for Student model."""
    class Meta:
        model = Student
        fields = '__all__'
        read_only_fields = ['date_created', 'date_updated']

    def validate_student_id(self, value):
        """Validate student ID format (e.g., R00228237)."""
        if value:
            # Student ID should start with R followed by digits
            pattern = r'^R\d{8}$'
            if not re.match(pattern, value):
                raise serializers.ValidationError(
                    'Student ID must be in format R followed by 8 digits (e.g., R00228237).'
                )
        return value

    def validate(self, data):
        """Validate that at least one email is provided."""
        if not data.get('personal_email') and not data.get('student_email'):
            raise serializers.ValidationError('At least one email address (personal or student) must be provided.')
        return data
