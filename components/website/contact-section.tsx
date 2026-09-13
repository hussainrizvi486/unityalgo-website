'use client'
import Link from "next/link"
import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
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
    <section id="contact" className="relative py-24  overflow-hidden">

      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-ink-200/20 rounded-full blur-[100px] pointer-events-none -translate-x-1/3 translate-y-1/3" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-start">

          <div className="mt-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              {/* h2, not h1: the hero owns the page's single h1, and a second
                  one leaves the document with no unambiguous title for search
                  engines or a screen reader's heading list. */}
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Great things start when we build together.
              </h2>
              <p className="text-base text-ink-600 mb-12 max-w-lg leading-relaxed">
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
            className="bg-white/80  p-4 md:p-8 rounded shadow-md"
          >
            <form onSubmit={handleSubmit} className="space-y-8">
             <div>
               <div className="font-bold text-lg">Let’s Stay in Touch</div>
               <div className="text-sm text-ink-600">Share your details below and we’ll reach out to you shortly.</div>
             </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="relative mt-6">
                  <input
                    type="text"
                    id="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    placeholder=" "
                    className="peer h-10 w-full border-b-2 border-ink-300 text-ink-900 focus:outline-none focus:border-ink-900 transition-colors bg-transparent"
                  />
                  <label
                    htmlFor="first_name"
                    className="absolute left-0 -top-3.5 text-ink-600 text-xs font-semibold  tracking-wider transition-all
                     peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-ink-400 peer-placeholder-shown:top-2
                     peer-focus:-top-3.5 peer-focus:text-black peer-focus:text-xs peer-focus:font-semibold  peer-focus:tracking-wider
                     pointer-events-none"
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
                    className="peer h-10 w-full border-b-2 border-ink-300 text-ink-900 focus:outline-none focus:border-ink-900 transition-colors bg-transparent"
                  />
                  <label
                    htmlFor="last_name"
                    className="absolute left-0 -top-3.5 text-ink-600 text-xs font-semibold  tracking-wider transition-all
                     peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-ink-400 peer-placeholder-shown:top-2
                     peer-focus:-top-3.5 peer-focus:text-black peer-focus:text-xs peer-focus:font-semibold  peer-focus:tracking-wider
                     pointer-events-none"
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
                  className="peer h-10 w-full border-b-2 border-ink-300 text-ink-900 focus:outline-none focus:border-ink-900 transition-colors bg-transparent"
                />
                <label
                  htmlFor="email"
                  className="absolute left-0 -top-3.5 text-ink-600 text-sm font-medium tracking-wider transition-all
                   peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-ink-400 peer-placeholder-shown:top-2
                   peer-focus:-top-3.5 peer-focus:text-black peer-focus:text-xs peer-focus:font-semibold  peer-focus:tracking-wider
                   pointer-events-none"
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
                  className="peer h-10 w-full border-b-2 border-ink-300 text-ink-900 focus:outline-none focus:border-ink-900 transition-colors bg-transparent"
                />
                <label
                  htmlFor="phone"
                  className="absolute left-0 -top-3.5 text-ink-600 text-xs font-semibold tracking-wider transition-all
                   peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-ink-400 peer-placeholder-shown:top-2
                   peer-focus:-top-3.5 peer-focus:text-black peer-focus:text-xs peer-focus:font-semibold  peer-focus:tracking-wider
                   pointer-events-none"
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
                  className="peer h-10 w-full border-b-2 border-input text-ink-900 focus:outline-none focus:border-ink-900 transition-colors bg-transparent"
                />
                {/* <input
                  id="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  placeholder=" "
                  className="peer w-full border-b-2 border-ink-300 text-ink-900 focus:outline-none focus:border-ink-900 transition-colors bg-transparent min-h-[100px] resize-none pt-2"
                /> */}
                <label
                  htmlFor="message"
                  className="absolute left-0 -top-3.5 text-ink-600 text-xs font-semibold  tracking-wider transition-all
                   peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-ink-400 peer-placeholder-shown:top-2
                   peer-focus:-top-3.5 peer-focus:text-black peer-focus:text-xs peer-focus:font-semibold  peer-focus:tracking-wider
                   pointer-events-none"
                >
                  Message
                </label>
              </div>


              <div className='flex gap-2 items-center '>
                <Button
                  className="py-4 bg-ink-900 hover:bg-ink-800 text-white text-sm rounded font-bold flex-auto"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <span>Sending...</span> : <span>Send Request</span>}
                </Button>
               
              </div>
               <div className='text-[0.65rem] text-center'>
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