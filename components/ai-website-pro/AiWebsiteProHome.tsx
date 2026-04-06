'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Search,
  Zap,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  MessageSquare,
  Clock,
  Globe,
  ArrowUpRight,
  Flame,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  businessName: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AiWebsiteProHome() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      businessName: '',
      phone: '',
      message: '',
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/ai-website-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setIsSuccess(true);
        reset();
        toast.success('Request received', {
          description: "We'll be in touch shortly to discuss your AI website.",
        });
      } else {
        throw new Error('Failed to submit');
      }
    } catch {
      toast.error('Something went wrong', {
        description: 'Please try again or use the direct payment link.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const faqs = [
    {
      q: "How does this help me get more customers?",
      a: "Your AI chatbot engages every visitor instantly — answering questions, capturing leads, and qualifying prospects 24/7. While competitors sleep, your website is closing deals."
    },
    {
      q: "Will I show up in ChatGPT searches?",
      a: "Yes. We structure your content so AI tools like ChatGPT, Claude, and Grok recognize your business as an authoritative source. When someone asks AI for a recommendation in your industry, you show up."
    },
    {
      q: "How fast can I get started?",
      a: "Same day. After activating your account, our team begins building within 24 hours and you're live within 7 days or less — fully optimized for both Google and AI search."
    },
    {
      q: "What makes this different from a regular website?",
      a: "A regular website waits. Yours hunts. The AI chatbot proactively engages visitors, answers their exact questions, captures their info, and alerts you the moment a hot lead arrives."
    }
  ];

  const CANNED_FREE_REPLY =
    "I don't have the answer to that question right now, but if you provide your email we will get back to you as soon as I do.";

  type ChatMessage = { role: "user" | "ai"; text: string };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [userDraft, setUserDraft] = useState("");
  const [chatPhase, setChatPhase] = useState<"idle" | "typing-q" | "thinking" | "typing-a">("idle");
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLElement>(null);
  const chatIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = chatMessagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, inputText, userDraft, chatPhase]);

  const handleUserSend = () => {
    if (chatPhase !== "idle") return;
    const trimmed = userDraft.trim();
    if (!trimmed) return;
    if (chatIntervalRef.current) clearTimeout(chatIntervalRef.current);

    setActiveChat(null);
    setUserDraft("");
    setChatMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setChatPhase("thinking");

    chatIntervalRef.current = setTimeout(() => {
      setChatPhase("typing-a");
      setChatMessages((prev) => [...prev, { role: "ai", text: "" }]);
      let aIdx = 0;
      const typeCanned = () => {
        aIdx++;
        setChatMessages((prev) => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = { role: "ai", text: CANNED_FREE_REPLY.slice(0, aIdx) };
          return msgs;
        });
        if (aIdx < CANNED_FREE_REPLY.length) {
          chatIntervalRef.current = setTimeout(typeCanned, 16);
        } else {
          setChatPhase("idle");
        }
      };
      chatIntervalRef.current = setTimeout(typeCanned, 80);
    }, 900);
  };

  const handleFaqClick = (index: number) => {
    if (chatPhase !== "idle") return;
    if (chatIntervalRef.current) clearTimeout(chatIntervalRef.current);

    setActiveChat(index);
    setChatMessages([]);
    setInputText("");
    setUserDraft("");
    setChatPhase("typing-q");

    chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

    const question = faqs[index].q;
    const answer = faqs[index].a;
    let qIdx = 0;

    const typeQuestion = () => {
      qIdx++;
      setInputText(question.slice(0, qIdx));
      if (qIdx < question.length) {
        chatIntervalRef.current = setTimeout(typeQuestion, 28);
      } else {
        chatIntervalRef.current = setTimeout(() => {
          setInputText("");
          setChatMessages([{ role: "user", text: question }]);
          setChatPhase("thinking");
          chatIntervalRef.current = setTimeout(() => {
            setChatPhase("typing-a");
            let aIdx = 0;
            setChatMessages(prev => [...prev, { role: "ai", text: "" }]);
            const typeAnswer = () => {
              aIdx++;
              setChatMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { role: "ai", text: answer.slice(0, aIdx) };
                return msgs;
              });
              if (aIdx < answer.length) {
                chatIntervalRef.current = setTimeout(typeAnswer, 18);
              } else {
                setChatPhase("idle");
              }
            };
            chatIntervalRef.current = setTimeout(typeAnswer, 80);
          }, 1200);
        }, 300);
      }
    };

    chatIntervalRef.current = setTimeout(typeQuestion, 100);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-white overflow-hidden selection:bg-[#00d4ff]/30 selection:text-white">
      {/* Sticky Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img
              src="/blueBall.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className="font-heading font-bold text-xl tracking-tight text-white">aiWebDF</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/home-original"
              className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline"
            >
              Classic site
            </Link>
            <Button asChild className="bg-white text-black hover:bg-gray-200 font-medium px-6 rounded-full transition-all duration-300">
              <a href="https://square.link/u/AIWebsitePro" target="_blank" rel="noopener noreferrer">
                Get Started
              </a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero-bg.png" 
            alt="Abstract Neural Network" 
            className="w-full h-full object-cover opacity-30 object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/50 via-[#0a0a0f]/80 to-[#0a0a0f]"></div>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#0066ff]/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-4xl mx-auto text-center"
          >
            <motion.div variants={fadeIn} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/10 text-[#00d4ff] text-sm font-medium mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4ff] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00d4ff]"></span>
              </span>
              The Rules Have Changed
            </motion.div>
            
            <motion.h1 variants={fadeIn} className="text-5xl lg:text-7xl font-bold font-heading leading-[1.1] mb-8 text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Getting Customers Online Just Got <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#0066ff]">10x Harder.</span>
            </motion.h1>
            
            <motion.p variants={fadeIn} className="text-xl lg:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
              Digital noise is deafening. Ad costs are soaring. Traditional websites just sit there. You need a site that actively <span className="text-white font-semibold">hunts for customers 24/7.</span>
            </motion.p>
            
            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="w-full sm:w-auto h-16 px-10 rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] hover:from-[#0052cc] hover:to-[#00bfff] text-black font-bold text-lg shadow-[0_0_40px_-10px_#00d4ff] transition-all duration-300 hover:scale-105">
                <a href="https://square.link/u/AIWebsitePro" target="_blank" rel="noopener noreferrer">
                  Activate Your AI Website <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <span className="text-sm text-gray-500 mt-4 sm:mt-0 sm:ml-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00d4ff]" /> Live in 7 days or less
              </span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* The Pain */}
      <section className="py-24 bg-[#0d0d1a] relative border-y border-white/5">
        <div className="container mx-auto px-6 relative z-10">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid lg:grid-cols-2 gap-16 items-center"
          >
            <div>
              <motion.h2 variants={fadeIn} className="text-3xl lg:text-5xl font-bold font-heading mb-6">
                Consumers don't Google anymore. <br/>
                <span className="text-gray-500">They ask ChatGPT.</span>
              </motion.h2>
              <motion.p variants={fadeIn} className="text-lg text-gray-400 mb-8">
                The shift is already here. People are typing "what's the best plumber near me" into AI platforms instead of search engines. If your business isn't optimized for AI, you are completely invisible to the next generation of buyers.
              </motion.p>
              <motion.div variants={fadeIn} className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Rising Ad Costs</h4>
                    <p className="text-gray-400">Traditional PPC is becoming unsustainable for local businesses.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <Globe className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Algorithm Chaos</h4>
                    <p className="text-gray-400">Google updates are burying honest businesses beneath aggregators.</p>
                  </div>
                </div>
              </motion.div>
            </div>
            
            <motion.div variants={fadeIn} className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#7c3aed]/20 to-transparent rounded-3xl blur-2xl"></div>
              <div className="relative bg-[#0a0a0f] border border-white/10 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
                  <Search className="w-5 h-5 text-gray-400" />
                  <div className="text-gray-400 font-mono text-sm">Query behavior shift (2023-2025)</div>
                </div>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">Traditional Search (Google)</span>
                      <span className="text-red-400">-24%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500/50 w-[76%] rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">Generative AI (ChatGPT, Claude)</span>
                      <span className="text-[#00d4ff]">+415%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] w-full rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* The Solution */}
      <section className="py-24 relative">
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-[#7c3aed]/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold font-heading mb-6">Your Unfair Advantage.</h2>
            <p className="text-xl text-gray-400">
              We build you a high-converting website armed with an AI Q&A chatbot. It boosts your standard SEO while optimizing your business directly for AI search models.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Bot className="w-8 h-8 text-[#00d4ff]" />,
                title: "24/7 AI Sales Rep",
                desc: "An intelligent chatbot that answers questions, handles objections, and captures leads while you sleep."
              },
              {
                icon: <Search className="w-8 h-8 text-[#7c3aed]" />,
                title: "LLM Optimization",
                desc: "Structured data specifically designed so ChatGPT, Claude, and Grok recommend your business."
              },
              {
                icon: <BarChart3 className="w-8 h-8 text-[#0066ff]" />,
                title: "Traditional SEO Boost",
                desc: "The FAQ approach naturally dominates long-tail Google searches and featured snippets."
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-[#0d0d1a] border border-white/5 rounded-2xl p-8 hover:border-[#00d4ff]/30 transition-colors group"
              >
                <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live AI Chat Demo */}
      <section ref={chatSectionRef} className="py-24 bg-[#0d0d1a] border-y border-white/5 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold font-heading mb-6">See It In Action.</h2>
              <p className="text-xl text-gray-400 mb-8">
                This is how your website will engage visitors. Tap a question and watch the AI respond in real time.
              </p>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <button
                    key={i}
                    onClick={() => handleFaqClick(i)}
                    disabled={chatPhase !== "idle"}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      activeChat === i
                      ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-white'
                      : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20 hover:bg-white/8'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{faq.q}</span>
                      <ArrowUpRight className={`w-5 h-5 shrink-0 ml-3 ${activeChat === i ? 'text-[#00d4ff]' : 'text-gray-500'}`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* iPhone-style chat window */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-[#0066ff]/20 to-[#7c3aed]/20 rounded-[2.5rem] blur-2xl"></div>
              <div className="relative bg-[#1c1c1e] border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col h-[580px] shadow-2xl" style={{ boxShadow: '0 40px 80px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)' }}>

                {/* iPhone-style status bar */}
                <div className="px-6 pt-4 pb-2 flex items-center justify-between text-xs text-white/50 bg-[#1c1c1e]">
                  <span className="font-semibold">9:41</span>
                  <div className="flex items-center gap-1">
                    <div className="flex gap-[2px] items-end h-3">
                      <div className="w-[3px] h-1 bg-white/50 rounded-sm"></div>
                      <div className="w-[3px] h-2 bg-white/50 rounded-sm"></div>
                      <div className="w-[3px] h-3 bg-white/50 rounded-sm"></div>
                      <div className="w-[3px] h-3 bg-white/30 rounded-sm"></div>
                    </div>
                    <svg className="w-4 h-3 fill-white/50" viewBox="0 0 24 12"><rect x="0" y="2" width="22" height="9" rx="2" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" fill="none"/><rect x="22" y="4.5" width="2" height="3" rx="1" fill="white" fillOpacity="0.5"/><rect x="1.5" y="3.5" width="16" height="6" rx="1" fill="white" fillOpacity="0.5"/></svg>
                  </div>
                </div>

                {/* Header */}
                <div className="px-4 pb-3 flex flex-col items-center border-b border-white/5 bg-[#1c1c1e]">
                  <div className="relative mb-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0066ff] to-[#00d4ff] flex items-center justify-center shadow-lg shadow-[#00d4ff]/20">
                      <Bot className="w-7 h-7 text-white" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#1c1c1e]"></div>
                  </div>
                  <span className="font-semibold text-sm text-white">AI Assistant</span>
                  <span className="text-[10px] text-green-400">Online</span>
                </div>

                {/* Chat Area */}
                <div ref={chatMessagesRef} className="flex-1 px-4 py-4 overflow-y-auto flex flex-col gap-3 bg-[#1c1c1e]">
                  {/* Initial greeting bubble */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="flex items-end gap-2 max-w-[80%]"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#0066ff] to-[#00d4ff] flex items-center justify-center shrink-0 mb-1">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-[#2c2c2e] text-white/90 rounded-[18px] rounded-bl-[4px] px-4 py-2.5 text-sm leading-relaxed shadow-sm">
                      Hi! Ask me anything about getting more customers with AI. Tap a question to the left to see how I respond.
                    </div>
                  </motion.div>

                  {/* Dynamic messages */}
                  {chatMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.92, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse self-end max-w-[80%]" : "max-w-[80%]"}`}
                    >
                      {msg.role === "ai" && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#0066ff] to-[#00d4ff] flex items-center justify-center shrink-0 mb-1">
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      <div className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "bg-[#0066ff] text-white rounded-[18px] rounded-br-[4px]"
                          : "bg-[#2c2c2e] text-white/90 rounded-[18px] rounded-bl-[4px]"
                      }`}>
                        {msg.text}
                        {msg.role === "ai" && chatPhase === "typing-a" && i === chatMessages.length - 1 && (
                          <span className="inline-block w-0.5 h-3.5 bg-white/70 ml-0.5 align-middle animate-pulse" />
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Thinking dots */}
                  {chatPhase === "thinking" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-end gap-2 max-w-[80%]"
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#0066ff] to-[#00d4ff] flex items-center justify-center shrink-0 mb-1">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="bg-[#2c2c2e] rounded-[18px] rounded-bl-[4px] px-4 py-3 flex gap-1 items-center">
                        {[0, 1, 2].map(dot => (
                          <motion.div
                            key={dot}
                            className="w-2 h-2 rounded-full bg-white/50"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: dot * 0.15, ease: "easeInOut" }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* Input Area */}
                <div className="px-4 py-3 border-t border-white/5 bg-[#1c1c1e]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={chatPhase === "typing-q" ? inputText : userDraft}
                        onChange={(e) => {
                          if (chatPhase === "idle") setUserDraft(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && chatPhase === "idle" && userDraft.trim()) {
                            e.preventDefault();
                            handleUserSend();
                          }
                        }}
                        placeholder={chatPhase === "idle" ? "Type a message…" : "iMessage"}
                        readOnly={chatPhase !== "idle"}
                        className="w-full bg-[#2c2c2e] border border-white/10 rounded-full py-2.5 px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/50 caret-[#00d4ff] disabled:opacity-70"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleUserSend}
                      disabled={chatPhase !== "idle" || !userDraft.trim()}
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                        chatPhase === "idle" && userDraft.trim()
                          ? "bg-[#0066ff] shadow-lg shadow-[#0066ff]/40 scale-105"
                          : "bg-[#2c2c2e]"
                      } disabled:opacity-50 disabled:scale-100`}
                    >
                      <ArrowRight
                        className={`w-4 h-4 transition-colors ${
                          chatPhase === "idle" && userDraft.trim() ? "text-white" : "text-white/30"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold font-heading mb-6">Live in 7 Days or Less.</h2>
            <p className="text-xl text-gray-400">
              No complex onboarding. No dragged-out agency processes. We move fast so you can start winning fast.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative rounded-3xl overflow-hidden aspect-square lg:aspect-auto lg:h-[600px] border border-white/10"
            >
              <img 
                src="/how-it-works.png" 
                alt="AI Process" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent"></div>
            </motion.div>

            <div className="space-y-12">
              {[
                { num: "01", title: "Activate Account", desc: "Secure your spot via our simple payment link. Activation is instant." },
                { num: "02", title: "We Build", desc: "Our engineers construct your custom, AI-optimized website in 7 days or less." },
                { num: "03", title: "Dominate", desc: "Your site goes live. Your AI chatbot starts engaging. You watch the leads roll in." }
              ].map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.2 }}
                  viewport={{ once: true }}
                  className="flex gap-6"
                >
                  <div className="shrink-0 font-heading text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#00d4ff] to-transparent opacity-50">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                    <p className="text-gray-400 text-lg">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Now / Urgency */}
      <section className="py-24 bg-[#0d0d1a] border-y border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0066ff]/10 via-[#0d0d1a] to-[#0d0d1a]"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-400 text-sm font-bold mb-8 border border-red-500/20 uppercase tracking-wider">
                <Clock className="w-4 h-4" /> The window is closing
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold font-heading mb-8">
                Early Movers{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-orange-400 to-red-500">
                  Take All.
                </span>
              </h2>
              <p className="text-xl lg:text-2xl text-gray-400 mb-12 leading-relaxed">
                When mobile search took over, businesses that adapted early dominated for a decade. AI search is happening 10x faster. Those who optimize now will lock in their local market. Those who wait will be left behind.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0d0d1a] to-[#0a0a0f]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-[#0066ff]/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold font-heading mb-6">Choose Your Advantage.</h2>
            <p className="text-xl text-gray-400">
              Start with your custom AI website — then scale as far as you want to go.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">

            {/* Tier 1 — Starter */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              viewport={{ once: true }}
              className="relative bg-[#0d0d1a] border border-white/10 rounded-3xl p-8 flex flex-col"
            >
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-2">Starter</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black font-heading text-white">$95.95</span>
                  <span className="text-gray-500 mb-1">/mo</span>
                </div>
                <p className="text-sm text-gray-500">One-time $95.95 setup fee to get your site built out</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Custom AI-powered website built for you",
                  "Site live in 7 days or less",
                  "Detailed email with full instructions",
                  "Web design makeover included",
                  "Text our Q&A robot anytime",
                  "We answer what it can't"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-400 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="w-full rounded-full border-white/20 text-white hover:bg-white/5 font-semibold h-12">
                <a href="https://square.link/u/AIWebsitePro" target="_blank" rel="noopener noreferrer">
                  Get Started
                </a>
              </Button>
            </motion.div>

            {/* Tier 2 — AI Pro — THE OBVIOUS CHOICE */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="relative rounded-3xl flex flex-col lg:-mt-4 lg:-mb-4"
              style={{ zIndex: 10 }}
            >
              {/* Glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#0066ff]/30 to-[#7c3aed]/20 rounded-3xl blur-xl -z-10"></div>
              <div className="relative bg-gradient-to-b from-[#0a1628] to-[#0d0d1a] border-2 border-[#0066ff]/60 rounded-3xl p-8 flex flex-col h-full shadow-[0_0_60px_-10px_#0066ff80]">
                {/* Badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black text-xs font-black uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                  Most Popular — Best Value
                </div>

                <div className="mb-6 mt-2">
                  <p className="text-sm font-semibold text-[#00d4ff] uppercase tracking-widest mb-2">AI Pro</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-black font-heading text-white">$499.95</span>
                    <span className="text-gray-400 mb-1.5">/mo</span>
                  </div>
                  <p className="text-sm text-[#00d4ff]/70">Everything to dominate AI search — every single month</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "Everything in Starter",
                    "Full AI optimization of your site monthly",
                    "Monthly strategy meeting with our team",
                    "AI feature integrations every month",
                    "Google, Yahoo & Bing SEO submission",
                    "ChatGPT targeting — get recommended by AI",
                    "Show up in Claude, Grok & Perplexity too",
                    "Monthly performance report"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${i === 0 ? "text-gray-500" : "text-[#00d4ff]"}`} />
                      <span className={i === 0 ? "text-gray-500" : "text-gray-200"}>{item}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild size="lg" className="w-full rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] hover:from-[#0052cc] hover:to-[#00bfff] text-black font-black text-lg h-14 shadow-[0_0_30px_-5px_#00d4ff] hover:scale-105 transition-all duration-200">
                  <a href="https://square.link/u/AIWebsitePro" target="_blank" rel="noopener noreferrer">
                    Start AI Pro <ArrowRight className="ml-2 w-5 h-5" />
                  </a>
                </Button>
                <p className="text-xs text-center text-[#00d4ff]/50 mt-3">The obvious choice for serious growth</p>
              </div>
            </motion.div>

            {/* Tier 3 — Full Agency — red / “fire” tier */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
              className="relative rounded-3xl flex flex-col lg:-mt-4 lg:-mb-4"
              style={{ zIndex: 11 }}
            >
              <div className="absolute -inset-px bg-gradient-to-b from-red-500/50 via-orange-500/35 to-red-600/20 rounded-3xl blur-2xl -z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/25 via-orange-600/15 to-transparent rounded-3xl blur-xl -z-10" />
              <div className="relative bg-gradient-to-b from-[#1a0808] via-[#120606] to-[#0d0d1a] border-2 border-red-500/70 rounded-3xl p-8 flex flex-col h-full shadow-[0_0_72px_-10px_rgba(239,68,68,0.55),0_0_24px_-8px_rgba(249,115,22,0.35)] ring-1 ring-orange-500/25">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest px-4 sm:px-5 py-1.5 rounded-full shadow-lg shadow-red-950/60 whitespace-nowrap">
                  Elite · White-glove
                </div>

                <div className="mb-6 mt-2">
                  <p className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-red-500 uppercase tracking-widest mb-2">
                    Full AI Agency
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-black font-heading text-white">$4,999</span>
                    <span className="text-red-200/60 mb-1.5">/mo</span>
                  </div>
                  <p className="text-sm text-red-200/70">
                    Total market domination. A team obsessed with your business.
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "Everything in AI Pro",
                    "A dedicated team locked in on your business daily",
                    "Every cutting-edge AI tool, applied for you",
                    "Constant monitoring, adjusting & pushing forward",
                    "We grind it out by your side — every single day",
                    "Always looking. Always improving. Always ahead.",
                    "Full local market domination strategy",
                    "You pay for results, not hours",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          i === 0 ? "text-gray-500" : "text-orange-400"
                        }`}
                      />
                      <span className={i === 0 ? "text-gray-500" : "text-gray-200"}>{item}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  size="lg"
                  className="w-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-500 hover:via-orange-500 hover:to-orange-400 text-white font-black text-lg h-14 shadow-[0_0_36px_-6px_rgba(239,68,68,0.75)] hover:scale-[1.02] transition-all duration-200 border border-red-400/30"
                >
                  <a href="https://square.link/u/AIWebsitePro" target="_blank" rel="noopener noreferrer">
                    Contact Us <ArrowRight className="ml-2 w-5 h-5" />
                  </a>
                </Button>
                <p className="text-xs text-center text-orange-400/55 mt-3">For businesses that refuse to lose</p>
              </div>
            </motion.div>

          </div>

          {/* Bottom note */}
          <p className="text-center text-sm text-gray-600 mt-10">
            All plans include instant activation. Team reaches out within 24 hours to begin.
          </p>
        </div>
      </section>

      {/* Lead Capture — Full AI Agency fire intake */}
      <section className="relative py-28 md:py-32 overflow-hidden border-t border-red-950/40">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0303] via-[#0d0505] to-[#0a0a0f]" />
        <motion.div
          className="absolute -top-32 right-0 w-[min(90vw,520px)] h-[520px] rounded-full bg-red-600/30 blur-[100px] pointer-events-none"
          animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.08, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[min(85vw,480px)] h-[480px] rounded-full bg-orange-600/25 blur-[110px] pointer-events-none"
          animate={{ opacity: [0.3, 0.55, 0.3] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(220,38,38,0.18),transparent)] pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-500/40 bg-gradient-to-r from-red-950/80 to-orange-950/60 shadow-[0_0_24px_-4px_rgba(239,68,68,0.45)]">
                  <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-300">
                    Agency intake
                  </span>
                </div>
                <h2 className="text-4xl md:text-5xl lg:text-[2.75rem] font-black font-heading leading-[1.1]">
                  <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-red-100 to-orange-200">
                    Torch the competition.
                  </span>
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-red-600">
                    Start the conversation.
                  </span>
                </h2>
                <p className="text-lg text-red-100/65 leading-relaxed max-w-md">
                  Full AI Agency leads go straight to our team. No fluff — tell us what you&apos;re building and we&apos;ll
                  bring the heat.
                </p>
                <div className="space-y-5">
                  {[
                    { icon: MessageSquare, text: 'White-glove consult — zero pressure' },
                    { icon: Zap, text: 'Custom domination roadmap for your market' },
                    { icon: Flame, text: 'Priority routing for $4,999/mo partners' },
                  ].map(({ icon: Icon, text }) => (
                    <div
                      key={text}
                      className="flex items-center gap-4 text-red-100/80 group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600/40 to-orange-600/25 border border-red-500/35 flex items-center justify-center shadow-[0_0_20px_-6px_rgba(239,68,68,0.5)] group-hover:shadow-[0_0_28px_-4px_rgba(249,115,22,0.45)] transition-shadow">
                        <Icon className="w-5 h-5 text-orange-300" />
                      </div>
                      <span className="font-medium">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative lg:pt-2">
                <motion.div
                  className="absolute -inset-3 rounded-[1.75rem] bg-gradient-to-r from-red-600 via-orange-500 to-red-600 opacity-60 blur-xl"
                  animate={{ opacity: [0.45, 0.75, 0.45] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-red-500/90 via-orange-500/70 to-red-600/90 p-px shadow-[0_0_40px_-6px_rgba(239,68,68,0.6)]">
                  <div className="rounded-3xl bg-gradient-to-b from-[#160606] via-[#0c0303] to-[#080202] p-8 md:p-9 border border-red-950/60 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-600/15 rounded-full blur-2xl pointer-events-none" />

                    {isSuccess ? (
                      <div className="relative flex flex-col items-center justify-center text-center space-y-5 py-10">
                        <div className="flex items-center gap-2 mb-1">
                          <img
                            src="/blueBall.png"
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 object-contain opacity-90"
                          />
                          <span className="font-heading font-bold text-white tracking-tight">aiWebDF</span>
                        </div>
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500/30 to-red-600/30 border border-orange-400/40 flex items-center justify-center shadow-[0_0_32px_-4px_rgba(249,115,22,0.5)]">
                          <CheckCircle2 className="w-10 h-10 text-orange-400" />
                        </div>
                        <h3 className="text-2xl font-black font-heading text-transparent bg-clip-text bg-gradient-to-r from-white to-orange-200">
                          You&apos;re in the queue
                        </h3>
                        <p className="text-red-200/60 max-w-xs">Our agency team will reach out shortly.</p>
                        <Button
                          type="button"
                          onClick={() => setIsSuccess(false)}
                          variant="outline"
                          className="mt-2 border-red-500/40 text-orange-200 hover:bg-red-950/50 hover:text-white"
                        >
                          Send another
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-5">
                        <div className="flex items-center gap-3 pb-4 mb-1 border-b border-red-500/25">
                          <img
                            src="/blueBall.png"
                            alt=""
                            width={44}
                            height={44}
                            className="h-11 w-11 object-contain shrink-0 drop-shadow-[0_0_16px_rgba(59,130,246,0.45)]"
                          />
                          <div className="min-w-0">
                            <p className="text-xl font-black font-heading tracking-tight text-white">aiWebDF</p>
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-300/85 mt-0.5">
                              Full AI Agency · Contact
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-red-200/90 text-xs font-bold uppercase tracking-wider block mb-2">
                              Name
                            </label>
                            <Input
                              placeholder="John Doe"
                              className="bg-black/50 border-red-500/35 text-white placeholder:text-red-200/25 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:border-orange-400/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                              {...register('name')}
                            />
                            {errors.name && (
                              <p className="text-orange-300 text-sm mt-1.5">{errors.name.message}</p>
                            )}
                          </div>
                          <div>
                            <label className="text-red-200/90 text-xs font-bold uppercase tracking-wider block mb-2">
                              Phone <span className="text-red-400/50 font-normal normal-case">(optional)</span>
                            </label>
                            <Input
                              placeholder="555-0123"
                              className="bg-black/50 border-red-500/35 text-white placeholder:text-red-200/25 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:border-orange-400/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                              {...register('phone')}
                            />
                            {errors.phone && (
                              <p className="text-orange-300 text-sm mt-1.5">{errors.phone.message}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-red-200/90 text-xs font-bold uppercase tracking-wider block mb-2">
                            Email
                          </label>
                          <Input
                            placeholder="john@example.com"
                            type="email"
                            className="bg-black/50 border-red-500/35 text-white placeholder:text-red-200/25 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:border-orange-400/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                            {...register('email')}
                          />
                          {errors.email && (
                            <p className="text-orange-300 text-sm mt-1.5">{errors.email.message}</p>
                          )}
                        </div>

                        <div>
                          <label className="text-red-200/90 text-xs font-bold uppercase tracking-wider block mb-2">
                            Business <span className="text-red-400/50 font-normal normal-case">(optional)</span>
                          </label>
                          <Input
                            placeholder="Acme Corp"
                            className="bg-black/50 border-red-500/35 text-white placeholder:text-red-200/25 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:border-orange-400/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                            {...register('businessName')}
                          />
                          {errors.businessName && (
                            <p className="text-orange-300 text-sm mt-1.5">{errors.businessName.message}</p>
                          )}
                        </div>

                        <div>
                          <label className="text-red-200/90 text-xs font-bold uppercase tracking-wider block mb-2">
                            Message <span className="text-red-400/50 font-normal normal-case">(optional)</span>
                          </label>
                          <Textarea
                            placeholder="What does winning look like for you?"
                            className="bg-black/50 border-red-500/35 text-white placeholder:text-red-200/25 min-h-[120px] rounded-xl resize-none focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:border-orange-400/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                            {...register('message')}
                          />
                          {errors.message && (
                            <p className="text-orange-300 text-sm mt-1.5">{errors.message.message}</p>
                          )}
                        </div>

                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full h-14 rounded-xl text-base font-black uppercase tracking-wide bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-500 hover:via-orange-500 hover:to-orange-400 text-white shadow-[0_0_40px_-6px_rgba(239,68,68,0.85),0_0_20px_-8px_rgba(249,115,22,0.4)] border border-red-400/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:hover:scale-100"
                        >
                          {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Sending…
                            </span>
                          ) : (
                            <>
                              <Flame className="w-5 h-5 shrink-0" />
                              Request agency consultation
                            </>
                          )}
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 bg-[#0a0a0f] border-t border-white/5 text-center text-gray-500 text-sm">
        <div className="container mx-auto px-6 space-y-2">
          <p>© {new Date().getFullYear()} aiWebDF. All rights reserved.</p>
          <p>
            <Link href="/home-original" className="text-gray-400 hover:text-[#00d4ff] underline-offset-4 hover:underline">
              View classic AI Web Design Firm homepage
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}