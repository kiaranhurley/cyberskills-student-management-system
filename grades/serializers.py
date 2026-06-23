from rest_framework import serializers
from decimal import Decimal
from datetime import date, timedelta
from .models import StudentResult
from students.models import Student
from students.serializers import StudentSerializer
from courses.models import Module
from courses.serializers import ModuleSerializer


def validate_term_code(value):
    """Validate term code format (YYYYSS)."""
    if not value:
        return value
    
    value_str = str(value).strip()
    # Remove trailing .0 if present
    if value_str.endswith('.0'):
        value_str = value_str[:-2]
    
    # Check format: should be 5 or 6 digits (YYYYSS or YYYY00)
    if not value_str.isdigit():
        raise serializers.ValidationError('Term code must contain only digits.')
    
    if len(value_str) not in [5, 6]:
        raise serializers.ValidationError('Term code must be 5 or 6 digits (e.g., 20241, 202400).')
    
    return value_str


def validate_grade_consistency(numeric_grade, processed_grade):
    """Validate that processed_grade matches numeric_grade logic."""
    if numeric_grade is None:
        return
    
    numeric = float(numeric_grade)
    
    if processed_grade == 'PASS':
        if numeric < 40:
            raise serializers.ValidationError({
                'processed_grade': 'Processed grade PASS requires numeric_grade >= 40.'
            })
    elif processed_grade == 'COMPENSATORY_PASS':
        if not (35 <= numeric < 40):
            raise serializers.ValidationError({
                'processed_grade': 'Processed grade COMPENSATORY_PASS requires numeric_grade between 35 and 39.'
            })
    elif processed_grade == 'FAIL':
        if numeric >= 40:
            raise serializers.ValidationError({
                'processed_grade': 'Processed grade FAIL requires numeric_grade < 40.'
            })


class StudentResultSerializer(serializers.ModelSerializer):
    """Serializer for StudentResult model."""
    student = StudentSerializer(read_only=True)
    module = ModuleSerializer(read_only=True)
    student_id = serializers.CharField(write_only=True)
    module_code = serializers.CharField(write_only=True)

    class Meta:
        model = StudentResult
        fields = '__all__'
        read_only_fields = ['result_id', 'created_at', 'updated_at']

    def validate_term_code(self, value):
        """Validate term code format."""
        return validate_term_code(value)

    def validate_numeric_grade(self, value):
        """Validate numeric grade is between 0 and 100."""
        if value is not None:
            numeric = float(value)
            if numeric < 0 or numeric > 100:
                raise serializers.ValidationError('Numeric grade must be between 0 and 100.')
        return value

    def validate_recorded_date(self, value):
        """Validate recorded_date is reasonable (not in future, not too far in past)."""
        if value:
            today = date.today()
            # Allow dates up to 1 year in the future (for planning purposes)
            max_future = today + timedelta(days=365)
            # Allow dates up to 10 years in the past
            min_past = today - timedelta(days=3650)
            
            if value > max_future:
                raise serializers.ValidationError('Recorded date cannot be more than 1 year in the future.')
            
            if value < min_past:
                raise serializers.ValidationError('Recorded date cannot be more than 10 years in the past.')
        
        return value

    def validate(self, data):
        """Validate grade consistency and relationships."""
        numeric_grade = data.get('numeric_grade')
        processed_grade = data.get('processed_grade')
        
        # Validate grade consistency
        if numeric_grade is not None and processed_grade:
            validate_grade_consistency(numeric_grade, processed_grade)
        
        return data

    def create(self, validated_data):
        student_id = validated_data.pop('student_id')
        module_code = validated_data.pop('module_code')
        
        try:
            student = Student.objects.get(student_id=student_id)
        except Student.DoesNotExist:
            raise serializers.ValidationError({'student_id': f'Student with ID {student_id} does not exist.'})
        
        try:
            module = Module.objects.get(module_code=module_code)
        except Module.DoesNotExist:
            raise serializers.ValidationError({'module_code': f'Module with code {module_code} does not exist.'})
        
        return StudentResult.objects.create(
            student=student,
            module=module,
            **validated_data
        )

    def update(self, instance, validated_data):
        if 'student_id' in validated_data:
            student_id = validated_data.pop('student_id')
            try:
                instance.student = Student.objects.get(student_id=student_id)
            except Student.DoesNotExist:
                raise serializers.ValidationError({'student_id': f'Student with ID {student_id} does not exist.'})
        
        if 'module_code' in validated_data:
            module_code = validated_data.pop('module_code')
            try:
                instance.module = Module.objects.get(module_code=module_code)
            except Module.DoesNotExist:
                raise serializers.ValidationError({'module_code': f'Module with code {module_code} does not exist.'})
        
        return super().update(instance, validated_data)
