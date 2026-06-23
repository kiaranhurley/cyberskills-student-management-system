from rest_framework import serializers
from .models import Programme, Module, ProgrammeModuleAssociation


class ProgrammeSerializer(serializers.ModelSerializer):
    """Serializer for Programme model."""
    class Meta:
        model = Programme
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def validate_credits(self, value):
        """Validate credits is non-negative."""
        if value is not None and value < 0:
            raise serializers.ValidationError('Credits must be non-negative.')
        return value

    def validate_fee(self, value):
        """Validate fee is non-negative."""
        if value is not None and value < 0:
            raise serializers.ValidationError('Fee must be non-negative.')
        return value

    def validate_programme_code(self, value):
        """Validate programme code format."""
        if value and len(value) > 20:
            raise serializers.ValidationError('Programme code must be 20 characters or less.')
        return value


class ModuleSerializer(serializers.ModelSerializer):
    """Serializer for Module model."""
    class Meta:
        model = Module
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def validate_credits(self, value):
        """Validate credits is non-negative."""
        if value is not None and value < 0:
            raise serializers.ValidationError('Credits must be non-negative.')
        return value

    def validate_fee(self, value):
        """Validate fee is non-negative."""
        if value is not None and value < 0:
            raise serializers.ValidationError('Fee must be non-negative.')
        return value

    def validate_module_code(self, value):
        """Validate module code format."""
        if value and len(value) > 20:
            raise serializers.ValidationError('Module code must be 20 characters or less.')
        return value


class ProgrammeModuleAssociationSerializer(serializers.ModelSerializer):
    """Serializer for ProgrammeModuleAssociation model."""
    programme = ProgrammeSerializer(read_only=True)
    module = ModuleSerializer(read_only=True)
    programme_code = serializers.CharField(write_only=True)
    module_code = serializers.CharField(write_only=True)

    class Meta:
        model = ProgrammeModuleAssociation
        fields = '__all__'
        read_only_fields = ['created_at']

    def create(self, validated_data):
        programme_code = validated_data.pop('programme_code')
        module_code = validated_data.pop('module_code')
        programme = Programme.objects.get(programme_code=programme_code)
        module = Module.objects.get(module_code=module_code)
        return ProgrammeModuleAssociation.objects.create(
            programme=programme,
            module=module,
            **validated_data
        )

    def update(self, instance, validated_data):
        if 'programme_code' in validated_data:
            programme_code = validated_data.pop('programme_code')
            instance.programme = Programme.objects.get(programme_code=programme_code)
        if 'module_code' in validated_data:
            module_code = validated_data.pop('module_code')
            instance.module = Module.objects.get(module_code=module_code)
        return super().update(instance, validated_data)
