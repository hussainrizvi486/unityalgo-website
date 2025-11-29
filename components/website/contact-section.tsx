'use client'
import { useState } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <section id="contact" className="relative py-24 bg-white overflow-hidden">

      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gray-200/20 rounded-full blur-[100px] pointer-events-none -translate-x-1/3 translate-y-1/3" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-start">

          <div className="mt-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-brand-900 mb-6">
                Let&apos;s Build <br /> Something <span className="text-brand-600">Great.</span>
              </h1>
              <p className="text-lg text-gray-600 mb-12 max-w-lg leading-relaxed">
                Have an idea? We&apos;re ready to help turn your vision into reality. From concept to execution, we deliver results that truly make an impact.
              </p>

              <div className="space-y-8">
                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Mail className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">Email Us</p>
                    <a href="mailto:info@unityalgo.com" className="text-gray-600 hover:text-brand-600 transition-colors">info@unityalgo.com</a>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Phone className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">Call Us</p>
                    <a href="tel:+92317244595" className="text-gray-600 hover:text-brand-600 transition-colors">+92 317 244595</a>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <MapPin className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">Location</p>
                    <span className="text-gray-600">Karachi, Pakistan</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-xl border border-white/50 p-8 md:p-10 rounded-3xl shadow-2xl shadow-gray-200/50"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="first_name" className="text-xs font-semibold uppercase tracking-wider text-gray-500">First Name</label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    className="bg-gray-50 border-gray-200 focus:border-brand-500 focus:ring-brand-500/20 h-12"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="last_name" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Last Name</label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    className="bg-gray-50 border-gray-200 focus:border-brand-500 focus:ring-brand-500/20 h-12"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email Address</label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="bg-gray-50 border-gray-200 focus:border-brand-500 focus:ring-brand-500/20 h-12"
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Phone Number</label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="bg-gray-50 border-gray-200 focus:border-brand-500 focus:ring-brand-500/20 h-12"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Message</label>
                <textarea
                  id="message"
                  className="flex w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-3 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50 min-h-[120px]"
                  placeholder="Tell us about your project..."
                  value={formData.message}
                  onChange={handleChange}
                  required
                />
              </div>

              <Button
                className="w-full h-12 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-medium shadow-lg shadow-brand-600/20 transition-all"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span >Sending...</span>
                ) : (
                  <span >Send Message </span>
                )}
              </Button>
            </form>
          </motion.div>

        </div>
      </div>
    </section>
  );
}