"""
Custom exception handlers for consistent API error responses.
"""
from rest_framework.views import exception_handler
from rest_framework import status
from rest_framework.response import Response
from django.core.exceptions import ValidationError as DjangoValidationError, ObjectDoesNotExist
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound


def custom_exception_handler(exc, context):
    """
    Custom exception handler that returns consistent error responses.
    
    Handles:
    - ValidationError (DRF and Django)
    - DoesNotExist exceptions
    - PermissionDenied
    - NotFound
    - Generic exceptions
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    # Handle Django ValidationError
    if isinstance(exc, DjangoValidationError):
        return Response(
            {
                'error': 'Validation failed',
                'details': exc.message_dict if hasattr(exc, 'message_dict') else str(exc)
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Handle DoesNotExist exceptions (all model.DoesNotExist inherit ObjectDoesNotExist)
    if isinstance(exc, ObjectDoesNotExist):
        return Response(
            {
                'error': 'Resource not found',
                'details': str(exc)
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    # If response is already handled by DRF, format it consistently
    if response is not None:
        custom_response_data = {
            'error': 'Request failed',
            'details': response.data
        }
        
        # Handle ValidationError
        if isinstance(exc, ValidationError):
            custom_response_data['error'] = 'Validation failed'
            # Flatten nested validation errors
            if isinstance(response.data, dict):
                details = {}
                for field, errors in response.data.items():
                    if isinstance(errors, list):
                        details[field] = errors[0] if len(errors) == 1 else errors
                    else:
                        details[field] = errors
                custom_response_data['details'] = details
        
        # Handle PermissionDenied
        elif isinstance(exc, PermissionDenied):
            custom_response_data['error'] = 'Permission denied'
            custom_response_data['details'] = str(exc.detail) if hasattr(exc, 'detail') else str(exc)
        
        # Handle NotFound
        elif isinstance(exc, NotFound):
            custom_response_data['error'] = 'Resource not found'
            custom_response_data['details'] = str(exc.detail) if hasattr(exc, 'detail') else str(exc)
        
        response.data = custom_response_data
        return response
    
    # Handle unexpected exceptions
    return Response(
        {
            'error': 'Internal server error',
            'details': str(exc) if hasattr(exc, '__str__') else 'An unexpected error occurred'
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
