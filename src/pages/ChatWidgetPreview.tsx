import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Copy, 
  Check, 
  Code2, 
  ShieldCheck, 
  Laptop, 
  Bot,
  Stethoscope,
  BookOpen,
  Send,
  MessageCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Badge } from '../components/ui/CustomUI';

export const ChatWidgetPreview: React.FC = () => {
  const { selectedProject } = useProject();
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeBrand, setActiveBrand] = useState<'medicare' | 'lexbridge' | 'eduspark'>('medicare');
  
  // Floating chat state inside preview
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    { sender: 'bot', text: 'Hello! Welcome to our support. How can I help you today?', time: '10:30 AM' }
  ]);
  const [inputText, setInputText] = useState('');

  const brands = {
    medicare: {
      name: 'MediCare Health',
      projectKey: 'medicare_health_prod',
      color: '#0d9488', // Teal
      title: 'MediCare Assistant',
      welcomeMessage: 'Hi! How can I help you with your health benefits today?',
      logo: Stethoscope,
      bgClass: 'bg-teal-50',
      textClass: 'text-teal-900',
      borderClass: 'border-teal-100',
      btnClass: 'bg-teal-600 hover:bg-teal-700',
      widgetPosition: 'bottom-right',
      domain: 'medicarehealth.org',
      headline: 'Better health for a better life',
      subheadline: 'Compassionate care for individuals and families. Access medical benefits and wellness programs.'
    },
    lexbridge: {
      name: 'LexBridge Legal',
      projectKey: 'lexbridge_legal_prod',
      color: '#1e3a8a', // Dark Blue
      title: 'LexBridge Advisor',
      welcomeMessage: 'Welcome to LexBridge. Ask me anything about our legal counsel services.',
      logo: ShieldCheck,
      bgClass: 'bg-blue-50',
      textClass: 'text-blue-900',
      borderClass: 'border-blue-100',
      btnClass: 'bg-blue-900 hover:bg-blue-950',
      widgetPosition: 'bottom-right',
      domain: 'lexbridgelegal.com',
      headline: 'Legal clarity. Business confidence.',
      subheadline: 'Practical legal solutions tailored for your business needs. Resolve disputes and draft contracts.'
    },
    eduspark: {
      name: 'EduSpark Academy',
      projectKey: 'eduspark_academy_prod',
      color: '#7c3aed', // Violet
      title: 'EduSpark AI Bot',
      welcomeMessage: 'Hi! Let me assist you with courses, enrollment, or campus queries.',
      logo: BookOpen,
      bgClass: 'bg-violet-50',
      textClass: 'text-violet-900',
      borderClass: 'border-violet-100',
      btnClass: 'bg-violet-600 hover:bg-violet-700',
      widgetPosition: 'bottom-right',
      domain: 'eduspark.edu',
      headline: 'Learn today. Lead tomorrow.',
      subheadline: 'Quality education for brighter futures. Enroll in coding, engineering or humanities courses.'
    }
  };

  const currentBrand = brands[activeBrand];

  const embedCode = `<!-- Load Universal RAG Chat Widget -->
<script src="https://cdn.universalrag.com/widget/v1/widget.js" async></script>

<script>
  window.addEventListener('DOMContentLoaded', () => {
    UniversalRAGChat.init({
      projectKey: "${selectedProject ? selectedProject.id : 'your_project_key_here'}",
      position: "${currentBrand.widgetPosition}",
      primaryColor: "${currentBrand.color}",
      title: "${currentBrand.title}",
      welcomeMessage: "${currentBrand.welcomeMessage}"
    });
  });
</script>`;

  const copyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { sender: 'user' as const, text: inputText, time: timeStr };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    // Simulated RAG Response
    setTimeout(() => {
      let botText = "I will scan our RAG knowledge base to answer that.";
      if (activeBrand === 'medicare') {
        if (inputText.toLowerCase().includes('insurance') || inputText.toLowerCase().includes('benefit')) {
          botText = "According to the MediCare benefits document, employees have full medical, dental and optical coverage up to $5,000 annually. Submit claims via the benefits portal.";
        } else {
          botText = "Based on our health guides, you can schedule online appointments with primary care doctors via the patient dashboard.";
        }
      } else if (activeBrand === 'lexbridge') {
        if (inputText.toLowerCase().includes('contract') || inputText.toLowerCase().includes('terminate')) {
          botText = "The business contract template outlines that termination requires a 30-day written notice from either party, as documented in Section 7 of the handbook.";
        } else {
          botText = "We offer corporate compliance audit programs for enterprise operations. Let me know if you would like me to detail the onboarding steps.";
        }
      } else if (activeBrand === 'eduspark') {
        if (inputText.toLowerCase().includes('course') || inputText.toLowerCase().includes('admission')) {
          botText = "EduSpark registration for the autumn semester is open until September 1st. You must submit your transcripts and a personal statement online.";
        } else {
          botText = "Attendance rules require maintaining at least an 85% attendance rate in all lecture courses to qualify for examinations.";
        }
      }

      setMessages(prev => [...prev, { sender: 'bot', text: botText, time: timeStr }]);
    }, 1000);
  };

  const BrandIcon = currentBrand.logo;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Widget Integration & Preview</h2>
        <p className="text-sm text-slate-500">Preview custom branded chat widgets and copy HTML integration snippets.</p>
      </div>

      {/* Concept Card */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Branding Sandbox</h3>
            <p className="text-[11px] text-slate-400 font-medium">Select a company demo to test customization styling</p>
          </div>
          
          {/* Brand select buttons */}
          <div className="space-y-2">
            {(Object.keys(brands) as Array<keyof typeof brands>).map((key) => {
              const b = brands[key];
              const Icon = b.logo;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveBrand(key);
                    setMessages([
                      { sender: 'bot', text: b.welcomeMessage, time: '10:30 AM' }
                    ]);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                    activeBrand === key 
                      ? 'border-violet-600 bg-violet-50 text-violet-900 font-bold shadow-xs' 
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${activeBrand === key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="text-xs">
                    <div>{b.name}</div>
                    <div className="text-[9px] text-slate-400 font-medium">{b.domain}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3.5 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong>Isolated Security Model:</strong> Each website loads documents using its own project keys. No cross-company access is allowed.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Laptop className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <strong>Dynamic Theme Styling:</strong> Custom primary colors are injected dynamically upon script initializations.
              </div>
            </div>
          </div>
        </Card>

        {/* Integration Code + Sandbox Preview (col-span-3) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Visual Embed Code */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-violet-600" />
                  HTML Embed Code
                </CardTitle>
                <CardDescription>Paste this code snippet before the closing &lt;/body&gt; tag of your website</CardDescription>
              </div>
              <Button onClick={copyCode} variant="outline" size="sm" className="gap-1.5 cursor-pointer">
                {copiedCode ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Code
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-300 font-mono text-[11px] p-4 rounded-xl overflow-x-auto leading-relaxed border border-slate-800">
                {embedCode}
              </pre>
            </CardContent>
          </Card>

          {/* Sandbox Live Interactive Website Preview */}
          <Card className="overflow-hidden border-2 border-slate-200">
            {/* Mock browser header */}
            <div className="bg-slate-100 px-4 py-2 flex items-center justify-between border-b border-slate-200/80">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <div className="bg-white border border-slate-200 px-10 py-1 rounded-md text-[10px] text-slate-400 font-semibold font-mono tracking-wide w-80 text-center select-all">
                https://www.{currentBrand.domain}/
              </div>
              <div className="w-10" />
            </div>

            {/* Mock website content */}
            <div className="h-[400px] relative bg-white flex flex-col justify-between p-8 overflow-hidden select-none">
              
              {/* Logo / Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-slate-950 text-white">
                    <BrandIcon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">{currentBrand.name}</span>
                </div>
                <div className="flex gap-4 text-[10px] font-semibold text-slate-400">
                  <span>Home</span>
                  <span>Services</span>
                  <span>About</span>
                  <span>Contact</span>
                </div>
              </div>

              {/* Headline Hero Section */}
              <div className="max-w-md my-auto space-y-2">
                <Badge variant="purple" className="py-0.5 text-[9px] uppercase tracking-widest font-bold">Mock Client Page</Badge>
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  {currentBrand.headline}
                </h3>
                <p className="text-xs text-slate-500 leading-normal">
                  {currentBrand.subheadline}
                </p>
                <div className="flex gap-2 pt-2">
                  <span className={`px-4 py-2 rounded-lg text-[10px] font-bold text-white ${currentBrand.btnClass}`}>
                    Get Started
                  </span>
                  <span className="px-4 py-2 rounded-lg text-[10px] font-bold border border-slate-200 hover:bg-slate-50 text-slate-600">
                    Read Docs
                  </span>
                </div>
              </div>

              {/* Floating widget preview */}
              <div className="absolute bottom-6 right-6 z-10 flex flex-col items-end">
                {/* Chat window */}
                {chatOpen && (
                  <div className="w-72 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-80 mb-3 animate-in fade-in-50 zoom-in-95 duration-200">
                    {/* Header */}
                    <div 
                      className="p-3 text-white flex items-center justify-between"
                      style={{ backgroundColor: currentBrand.color }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-white/20">
                          <Bot className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold">{currentBrand.title}</span>
                      </div>
                      <button onClick={() => setChatOpen(false)} className="text-xs font-bold opacity-80 hover:opacity-100">×</button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-2.5 custom-scrollbar text-[11px]">
                      {messages.map((msg, i) => (
                        <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                          <div 
                            className={`p-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                              msg.sender === 'user'
                                ? 'bg-violet-600 text-white rounded-tr-none'
                                : 'bg-slate-100 text-slate-700 rounded-tl-none'
                            }`}
                            style={msg.sender === 'user' ? { backgroundColor: currentBrand.color } : {}}
                          >
                            {msg.text}
                          </div>
                          <span className="text-[8px] text-slate-400 font-semibold mt-0.5 px-1">{msg.time}</span>
                        </div>
                      ))}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-100 flex gap-1 bg-slate-50/50">
                      <input
                        type="text"
                        placeholder="Ask a question..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] focus:outline-hidden"
                      />
                      <button 
                        type="submit" 
                        className="p-1.5 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                        style={{ backgroundColor: currentBrand.color }}
                      >
                        <Send className="h-3 w-3" />
                      </button>
                    </form>
                  </div>
                )}

                {/* Floating bubble button */}
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="h-11 w-11 rounded-full shadow-lg flex items-center justify-center text-white cursor-pointer transition-transform hover:scale-105"
                  style={{ backgroundColor: currentBrand.color }}
                >
                  <MessageCircle className="h-5.5 w-5.5" />
                </button>
              </div>

            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
