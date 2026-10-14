import { createContactAction } from '@/app/admin/actions';
import { ContactForm } from '../contact-form';

export default function NewContactPage() {
    return (
        <div>
            <h1 className="portal-page-title mb-8">New Contact</h1>
            <ContactForm action={createContactAction} submitLabel="Create Contact" />
        </div>
    );
}
