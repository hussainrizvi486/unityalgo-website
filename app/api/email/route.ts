import nodemailer from 'nodemailer';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
    const { first_name, last_name, email, phone, message } = await req.json();

    if (!first_name || !last_name || !email || !phone || !message) {
        return Response.json({ success: false, message: 'Missing required fields.' }, { status: 400 });
    }

    try {
        await prisma.contactSubmission.create({
            data: {
                firstName: first_name,
                lastName: last_name,
                email,
                phone,
                message,
            },
        });
    } catch (error) {
        console.error('Failed to save contact submission:', error);
        return Response.json({ success: false, message: 'Failed to save your message.' }, { status: 500 });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: 'info@unityalgo.com',
            subject: `New Contact Form Submission from ${first_name} ${last_name}`,
            text: `
            You have a new contact form submission:
            Name: ${first_name} ${last_name}
            Email: ${email}
            Phone: ${phone}
            Message: ${message}`,
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Failed to send contact notification email:', error);
    }

    return Response.json({ success: true, message: 'Message received!' });
}
