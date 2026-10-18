'use client'
import Link from "next/link"
import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

export function Contact() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success('Message sent! We will reach out shortly.');
        setIsSubmitting(false);
        setFormData({ first_name: '', last_name: '', email: '', phone: '', message: '' });

      } else {
        toast.error('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('An error occurred. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }

    // await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <section id="contact" className="relative overflow-hidden site-section-spacing">

      <div className="absolute top-0 right-0 w-150 h-150 bg-primary/5 rounded-full blur-3xl pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-100 h-100 bg-border/20 rounded-full blur-3xl pointer-events-none -translate-x-1/3 translate-y-1/3" />

      <div className="site-container relative z-10 site-gutters">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-start">

          <div className="mt-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              {}
              <h2 className="text-4xl md:text-5xl tracking-tight mb-6">
                Great things start when we build together.
              </h2>
              <p className="text-base text-foreground/70 mb-12 max-w-lg leading-relaxed">
                Have an idea you’re excited about? We’re here to help transform your vision into something meaningful, impactful, and built to last. From shaping the initial concept and defining the right strategy to bringing every detail to life, we work closely with you throughout the entire journey. Our goal is to turn great ideas into thoughtful, high-quality solutions that not only meet your expectations but create lasting value and make a real difference.




              </p>

              <div className="">
                <div className="flex items-center gap-3 mb-4">
                  <Mail className="w-5 h-" />
                  <a href="mailto:info@unityalgo.com" className="font-medium text-sm hover:underline">info@unityalgo.com</a>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-" />
                  <a href="tel:+92317244595" className="font-medium text-sm hover:underline">+92 317 244595</a>
                </div>

              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-card/80 p-4 md:p-8 rounded shadow-md"
          >
            <form onSubmit={handleSubmit} className="space-y-gap-xl">
             <div>
               <div className="font-bold text-lg">Let’s Stay in Touch</div>
               <div className="text-sm text-foreground/70">Share your details below and we’ll reach out to you shortly.</div>
             </div>
              <div className="grid md:grid-cols-2 gap-gap-lg">
                <div className="relative mt-6">
                  <input
                    type="text"
                    id="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    placeholder=" "
                    className="peer h-10 w-full border-b-2 border-input text-foreground focus:outline-none focus:border-foreground transition-colors bg-transparent"
                  />
                  <label
                    htmlFor="first_name"
                    className="absolute left-0 -top-3.5 text-foreground/70 text-xs font-semibold tracking-wider transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-muted-foreground peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-foreground peer-focus:text-xs peer-focus:font-semibold peer-focus:tracking-wider pointer-events-none"
                  >
                    First Name
                  </label>
                </div>

                <div className="relative mt-6">
                  <input
                    type="text"
                    id="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    placeholder=" "
                    className="peer h-10 w-full border-b-2 border-input text-foreground focus:outline-none focus:border-foreground transition-colors bg-transparent"
                  />
                  <label
                    htmlFor="last_name"
                    className="absolute left-0 -top-3.5 text-foreground/70 text-xs font-semibold tracking-wider transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-muted-foreground peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-foreground peer-focus:text-xs peer-focus:font-semibold peer-focus:tracking-wider pointer-events-none"
                  >
                    Last Name
                  </label>
                </div>
              </div>

              <div className="relative mt-6">
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder=" "
                  className="peer h-10 w-full border-b-2 border-input text-foreground focus:outline-none focus:border-foreground transition-colors bg-transparent"
                />
                <label
                  htmlFor="email"
                  className="absolute left-0 -top-3.5 text-foreground/70 text-sm font-medium tracking-wider transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-muted-foreground peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-foreground peer-focus:text-xs peer-focus:font-semibold peer-focus:tracking-wider pointer-events-none"
                >
                  Email Address
                </label>
              </div>

              <div className="relative mt-6">
                <input
                  type="text"
                  id="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder=" "
                  className="peer h-10 w-full border-b-2 border-input text-foreground focus:outline-none focus:border-foreground transition-colors bg-transparent"
                />
                <label
                  htmlFor="phone"
                  className="absolute left-0 -top-3.5 text-foreground/70 text-xs font-semibold tracking-wider transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-muted-foreground peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-foreground peer-focus:text-xs peer-focus:font-semibold peer-focus:tracking-wider pointer-events-none"
                >
                  Phone Number
                </label>
              </div>

              <div className="relative mt-6">
                <input
                  type="text"
                  id="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  placeholder=""
                  className="peer h-10 w-full border-b-2 border-input text-foreground focus:outline-none focus:border-foreground transition-colors bg-transparent"
                />
                {}
                <label
                  htmlFor="message"
                  className="absolute left-0 -top-3.5 text-foreground/70 text-xs font-semibold tracking-wider transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-muted-foreground peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-foreground peer-focus:text-xs peer-focus:font-semibold peer-focus:tracking-wider pointer-events-none"
                >
                  Message
                </label>
              </div>


              <div className='flex gap-2 items-center '>
                <Button
                  className="py-4 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded font-bold flex-auto"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <span>Sending...</span> : <span>Send Request</span>}
                </Button>
               
              </div>
               <div className='text-micro text-center'>
                  By sending this form,  I confirm that I have read <br /> and accepted the &nbsp;
                  <Link href={"/privacy-policy"} className="underline">Privacy Policy.
                  </Link>
                </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}