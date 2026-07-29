import { createContactAction } from '@/app/admin/actions';
import { ContactForm } from '../contact-form';

export default function NewContactPage() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-8">New Contact</h1>
            <ContactForm action={createContactAction} submitLabel="Create Contact" />
        </div>
    );
}
