from rest_framework import serializers
from django.core.exceptions import ValidationError
from .models import StudentProgram, StudentModule
from students.models import Student
from students.serializers import StudentSerializer
from courses.models import Programme, Module
from courses.serializers import ProgrammeSerializer, ModuleSerializer


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


class StudentProgramSerializer(serializers.ModelSerializer):
    """Serializer for StudentProgram model."""
    student = StudentSerializer(read_only=True)
    programme = ProgrammeSerializer(read_only=True)
    student_id = serializers.CharField(write_only=True)
    programme_code = serializers.CharField(write_only=True)

    class Meta:
        model = StudentProgram
        fields = '__all__'
        read_only_fields = ['enrollment_id', 'created_at', 'updated_at']

    def validate_term_code(self, value):
        """Validate term code format."""
        return validate_term_code(value)

    def validate(self, data):
        """Validate enrollment dates and relationships."""
        enrollment_date = data.get('enrollment_date')
        completion_date = data.get('completion_date')
        
        if enrollment_date and completion_date:
            if completion_date < enrollment_date:
                raise serializers.ValidationError({
                    'completion_date': 'Completion date must be after or equal to enrollment date.'
                })
        
        return data

    def create(self, validated_data):
        student_id = validated_data.pop('student_id')
        programme_code = validated_data.pop('programme_code')
        
        try:
            student = Student.objects.get(student_id=student_id)
        except Student.DoesNotExist:
            raise serializers.ValidationError({'student_id': f'Student with ID {student_id} does not exist.'})
        
        try:
            programme = Programme.objects.get(programme_code=programme_code)
        except Programme.DoesNotExist:
            raise serializers.ValidationError({'programme_code': f'Programme with code {programme_code} does not exist.'})
        
        return StudentProgram.objects.create(
            student=student,
            programme=programme,
            **validated_data
        )

    def update(self, instance, validated_data):
        if 'student_id' in validated_data:
            student_id = validated_data.pop('student_id')
            try:
                instance.student = Student.objects.get(student_id=student_id)
            except Student.DoesNotExist:
                raise serializers.ValidationError({'student_id': f'Student with ID {student_id} does not exist.'})
        
        if 'programme_code' in validated_data:
            programme_code = validated_data.pop('programme_code')
            try:
                instance.programme = Programme.objects.get(programme_code=programme_code)
            except Programme.DoesNotExist:
                raise serializers.ValidationError({'programme_code': f'Programme with code {programme_code} does not exist.'})
        
        return super().update(instance, validated_data)


class StudentModuleSerializer(serializers.ModelSerializer):
    """Serializer for StudentModule model."""
    student = StudentSerializer(read_only=True)
    module = ModuleSerializer(read_only=True)
    student_id = serializers.CharField(write_only=True)
    module_code = serializers.CharField(write_only=True)

    class Meta:
        model = StudentModule
        fields = '__all__'
        read_only_fields = ['enrollment_id', 'created_at', 'updated_at']

    def validate_term_code(self, value):
        """Validate term code format."""
        return validate_term_code(value)

    def validate(self, data):
        """Validate enrollment dates and relationships."""
        enrollment_date = data.get('enrollment_date')
        completion_date = data.get('completion_date')
        
        if enrollment_date and completion_date:
            if completion_date < enrollment_date:
                raise serializers.ValidationError({
                    'completion_date': 'Completion date must be after or equal to enrollment date.'
                })
        
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
        
        return StudentModule.objects.create(
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
