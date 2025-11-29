import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const { first_name, last_name, email, phone, message } = await req.json();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "info@unityalgo.com",
      subject: `New Contact Form Submission from ${first_name} ${last_name}`,
      text: `
            You have a new contact form submission:
            Name: ${first_name} ${last_name}
            Email: ${email}
            Phone: ${phone}
            Message: ${message}`,
    };

    await transporter.sendMail(mailOptions);

    return Response.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    return Response.json(
      { success: false, message: "Failed to send email.", error },
      { status: 500 }
    );
  }
}
