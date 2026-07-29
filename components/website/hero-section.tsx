'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShieldCheck, Zap, Layers, BrainCircuit, Rocket } from 'lucide-react';
// import { Globe } from '@/components/globe';

export function HeroSection() {
    // const [windowWidth, setWindowWidth] = useState(1000);

    // const globeY = useTransform(scrollY, [0, 500], [0, 100]);

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    // const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // useEffect(() => {
    //     const handleResize = () => setWindowWidth(window.innerWidth)
    //     const handleMouseMove = (e: MouseEvent) => {
    //         setMousePosition({
    //             x: (e.clientX - window.innerWidth / 2) / 20,
    //             y: (e.clientY - window.innerHeight / 2) / 20
    //         });
    //     };

    //     window.addEventListener('mousemove', handleMouseMove);
    //     window.addEventListener("resize", handleResize)
    //     window.addEventListener("DOMContentLoaded", handleResize)

    //     return () => {
    //         window.removeEventListener('mousemove', handleMouseMove);
    //         window.removeEventListener("resize", handleResize);
    //         window.removeEventListener("DOMContentLoaded", handleResize)
    //     }
    // }, []);


    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background pt-32 pb-20">
            <div className='container'>


                {/* <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-grid-pattern mask-[radial-gradient(ellipse_at_center,black_30%,transparent_70%)] opacity-40" />
            </div> */}

                {/* <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div
                    style={{ x: mousePosition.x * -1, y: mousePosition.y * -1 }}
                    className="absolute -top-[20%] -left-[10%] w-[700px] h-[700px] bg-brand-500/10 rounded-full blur-[100px] mix-blend-multiply animate-blob"
                />
                <motion.div
                    style={{ x: mousePosition.x, y: mousePosition.y }}
                    className="absolute top-[20%] -right-[10%] w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] mix-blend-multiply animate-blob animation-delay-2000"
                />
            </div> */}

                {/* {windowWidth > 760 &&
                <motion.div
                    style={{ y: globeY }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="absolute z-0 top-[15%] md:top-[10%] opacity-40 md:opacity-100 pointer-events-none"
                >

                    <div className="relative">
                        <Globe className="w-[500px] h-[500px] md:w-[800px] md:h-[800px]" />
                        <div className="absolute inset-0 bg-linear-to-t from-white via-transparent to-transparent z-10" />
                    </div>
                </motion.div>
            } */}

                <div className="relative z-10 px-4">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-8"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-brand-500/10 shadow-sm backdrop-blur-md">
                            <Rocket className="relative flex size-4 stroke-brand-600" />
                            <span className="text-xs font-bold uppercase tracking-wide">
                                Built for Tomorrow
                            </span>
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="relative text-4xl md:text-6xl font-bold tracking-tight  mb-6 text-balance leading-[1.1]"
                    >
                        AI-powered software. <br />
                        Built smarter.<br />
                        Driving  Innovation every day.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                        className="relative md:text-xl text-gray-600 mb-10 text-balance backdrop-blur-sm"
                    >
                        We build AI-powered web, mobile, and enterprise software that streamlines operations, accelerates growth, and helps businesses stay ahead in a rapidly evolving digital world.
                    </motion.p>


                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
                        className="flex flex-col sm:flex-row gap-4 items-center mb-20"
                    >
                        <Button
                            size="lg"
                            className="text-xs sm:h-12 sm:text-base bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg shadow-brand-500/25 transition-all hover:scale-105"
                        >
                            Get Started <ArrowRight className="ml-1 size-4" />
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => scrollToSection('services')}

                            className="px-8 text-xs sm:h-12 sm:text-base bg-white/60 backdrop-blur-md shadow-md border-input hover:bg-white rounded-full transition-all"
                        >
                            Our Services
                        </Button>
                    </motion.div>

                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-12"
                    >
                        {[
                            {
                                icon: BrainCircuit,
                                title: "Enterprise Resource Planning (ERP)",
                                desc: "Integrated ERP solutions that streamline operations, automate workflows, and improve business efficiency."
                            },
                            {
                                icon: ShieldCheck,
                                title: "AI-Native Software Engineering",
                                desc: "Build intelligent, AI-first applications with modern architectures, automation, and scalable development practices."
                            },
                            {
                                icon: Layers,
                                title: "Tailored Software Solutions",
                                desc: "Tailor-made software solutions designed to meet your unique business needs with scalability and long-term reliability."
                            }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-8 rounded-2xl shadow-sm border border-zinc-100 bg-transparent"
                            >

                                <div className='mb-6 h-32'>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                                    <p className="text-base text-gray-500 leading-relaxed">{item.desc}</p>
                                </div>


                                <div className="flex items-center justify-between">
                                    <div>
                                        <item.icon className="w-12 h-12 text-brand-900 stroke-1.5" />
                                    </div>

                                    <Link className='bg-brand-100 rounded-full p-2 hover:cursor-pointer' href={"/"}>
                                        <ArrowRight className='size-4' />
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
