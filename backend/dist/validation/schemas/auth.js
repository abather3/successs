"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizationHeaderSchema = exports.refreshTokenSchema = exports.verifyTokenSchema = exports.resetPasswordSchema = exports.requestPasswordResetSchema = exports.changePasswordSchema = exports.registerSchema = exports.loginSchema = void 0;
const types_1 = require("../../types");
/**
 * Validation schema for login
 */
exports.loginSchema = {
    email: {
        in: ['body'],
        isEmail: {
            errorMessage: 'Invalid email address'
        },
        normalizeEmail: true,
        trim: true
    },
    password: {
        in: ['body'],
        isLength: {
            options: { min: 6 },
            errorMessage: 'Password must be at least 6 characters long'
        },
        trim: true
    }
};
/**
 * Validation schema for registration
 */
exports.registerSchema = {
    email: {
        in: ['body'],
        isEmail: {
            errorMessage: 'Invalid email address'
        },
        normalizeEmail: true,
        trim: true
    },
    full_name: {
        in: ['body'],
        notEmpty: {
            errorMessage: 'Full name is required'
        },
        isLength: {
            options: { min: 2, max: 100 },
            errorMessage: 'Full name must be between 2 and 100 characters'
        },
        trim: true
    },
    password: {
        in: ['body'],
        isLength: {
            options: { min: 8 },
            errorMessage: 'Password must be at least 8 characters long'
        },
        matches: {
            options: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
            errorMessage: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        },
        trim: true
    },
    role: {
        in: ['body'],
        custom: {
            options: (value) => {
                return Object.values(types_1.UserRole).includes(value);
            },
            errorMessage: 'Invalid user role'
        }
    }
};
/**
 * Validation schema for password change
 */
exports.changePasswordSchema = {
    email: {
        in: ['body'],
        isEmail: {
            errorMessage: 'Invalid email address'
        },
        normalizeEmail: true,
        trim: true
    },
    currentPassword: {
        in: ['body'],
        notEmpty: {
            errorMessage: 'Current password is required'
        },
        trim: true
    },
    newPassword: {
        in: ['body'],
        isLength: {
            options: { min: 8 },
            errorMessage: 'New password must be at least 8 characters long'
        },
        matches: {
            options: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
            errorMessage: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        },
        trim: true
    }
};
/**
 * Validation schema for password reset request
 */
exports.requestPasswordResetSchema = {
    email: {
        in: ['body'],
        isEmail: {
            errorMessage: 'Invalid email address'
        },
        normalizeEmail: true,
        trim: true
    }
};
/**
 * Validation schema for password reset
 */
exports.resetPasswordSchema = {
    token: {
        in: ['body'],
        notEmpty: {
            errorMessage: 'Reset token is required'
        },
        isLength: {
            options: { min: 32, max: 128 },
            errorMessage: 'Invalid reset token format'
        },
        trim: true
    },
    newPassword: {
        in: ['body'],
        isLength: {
            options: { min: 8 },
            errorMessage: 'New password must be at least 8 characters long'
        },
        matches: {
            options: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
            errorMessage: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        },
        trim: true
    }
};
/**
 * Validation schema for token verification
 */
exports.verifyTokenSchema = {
    token: {
        in: ['body'],
        notEmpty: {
            errorMessage: 'Token is required'
        },
        isLength: {
            options: { min: 32, max: 128 },
            errorMessage: 'Invalid token format'
        },
        trim: true
    }
};
/**
 * Validation schema for refresh token
 */
exports.refreshTokenSchema = {
    refreshToken: {
        in: ['body'],
        optional: { options: { nullable: true } },
        isJWT: {
            errorMessage: 'Invalid refresh token format'
        }
    }
};
/**
 * Validation schema for authorization header
 */
exports.authorizationHeaderSchema = {
    authorization: {
        in: ['headers'],
        matches: {
            options: /^Bearer\s[\w\-\.]+$/,
            errorMessage: 'Invalid authorization header format'
        }
    }
};
//# sourceMappingURL=auth.js.map