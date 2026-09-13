/**
 * The registration field rules, shared by the browser and the server action.
 *
 * One module rather than two copies: a client rule that is stricter than the
 * server's silently blocks a legitimate signup, and one that is looser lets a
 * form submit only to bounce back. Both sides call the same functions, so they
 * cannot drift.
 *
 * The server still validates everything on its own — the client copy is a
 * convenience, never a gate. Nothing here is a substitute for the checks in
 * createCustomerAction.
 */

export interface RegistrationValues {
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
}

export type RegistrationField = keyof RegistrationValues;

export type FieldErrors = Partial<Record<string, string>>;

export const PASSWORD_MIN_LENGTH = 8;

/** Digits, spaces and the punctuation real phone numbers are written with. */
const PHONE_SHAPE = /^\+?[\d\s().-]{7,20}$/;

/** A name can be anything a person is actually called, so this only rejects
 *  what cannot be a name: empty, one character, or containing digits. */
const NAME_SHAPE = /^[^\d]{2,60}$/;

export function validateField(field: RegistrationField, raw: string): string | null {
    const value = raw.trim();

    switch (field) {
        case 'firstName':
        case 'lastName': {
            const label = field === 'firstName' ? 'First name' : 'Last name';
            if (!value) return `${label} is required.`;
            if (value.length < 2) return `${label} must be at least 2 characters.`;
            if (value.length > 60) return `${label} must be 60 characters or fewer.`;
            if (!NAME_SHAPE.test(value)) return `${label} cannot contain numbers.`;
            return null;
        }
        case 'phone': {
            if (!value) return 'Phone number is required.';
            const digits = value.replace(/\D/g, '');
            if (digits.length < 7) return 'Enter a complete phone number.';
            if (digits.length > 15) return 'That phone number is too long.';
            if (!PHONE_SHAPE.test(value)) return 'Use digits, spaces, and + ( ) - only.';
            return null;
        }
        case 'password': {
            // Not trimmed: a leading or trailing space is a legitimate part of
            // a password, and silently removing it would break the next login.
            if (!raw) return 'Password is required.';
            if (raw.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
            if (raw.length > 200) return 'Password must be 200 characters or fewer.';
            if (!/[a-zA-Z]/.test(raw) || !/\d/.test(raw)) return 'Password must include at least one letter and one number.';
            return null;
        }
    }
}

/** Every field's error, keyed by field name. Empty object means valid. */
export function validateRegistration(values: RegistrationValues): FieldErrors {
    const errors: FieldErrors = {};
    for (const field of ['firstName', 'lastName', 'phone', 'password'] as const) {
        const message = validateField(field, values[field]);
        if (message) errors[field] = message;
    }
    return errors;
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
