"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  Search, 
  Send, 
  Paperclip, 
  Image as ImageIcon,
  MoreVertical,
  Phone,
  Video,
  Hash,
  Users
} from "lucide-react";
import Link from "next/link";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isMe: boolean;
  avatar: string;
}

interface Channel {
  id: string;
  name: string;
  type: "channel" | "direct";
  unread: number;
}

const mockChannels: Channel[] = [
  { id: "c1", name: "general", type: "channel", unread: 0 },
  { id: "c2", name: "production-line-a", type: "channel", unread: 3 },
  { id: "c3", name: "quality-alerts", type: "channel", unread: 1 },
  { id: "d1", name: "Sarah Connor (Plant Mgr)", type: "direct", unread: 0 },
  { id: "d2", name: "John Smith (QA)", type: "direct", unread: 0 },
];

const mockMessages: Record<string, Message[]> = {
  "c2": [
    { id: "m1", sender: "John Smith", content: "Line A is experiencing a 5% drop in yield. Anyone check the pick-and-place machine?", timestamp: "10:30 AM", isMe: false, avatar: "JS" },
    { id: "m2", sender: "Sarah Connor", content: "Maintenance team is on it. We suspect a calibration issue.", timestamp: "10:32 AM", isMe: false, avatar: "SC" },
    { id: "m3", sender: "Admin", content: "I'll update the NCR ticket with this info.", timestamp: "10:35 AM", isMe: true, avatar: "AD" },
  ]
};

export default function TeamsChatPage() {
  const [activeChannel, setActiveChannel] = useState<Channel>(mockChannels[1]);
  const [messages, setMessages] = useState<Message[]>(mockMessages["c2"] || []);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Math.random().toString(),
      sender: "Admin (You)",
      content: inputValue,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
      avatar: "AD"
    };

    setMessages([...messages, newMessage]);
    setInputValue("");
    
    // Simulate a reply if in direct message or just random
    if (activeChannel.type === "direct") {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: activeChannel.name,
          content: "Copy that. I'm checking it right now.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: false,
          avatar: activeChannel.name.charAt(0)
        }]);
      }, 2000);
    }
  };

  const switchChannel = (channel: Channel) => {
    setActiveChannel(channel);
    setMessages(mockMessages[channel.id] || []);
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-lg">Communications</h1>
        </div>
        
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search or start a chat" 
              className="w-full bg-gray-50 dark:bg-white/5 rounded-xl py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Hash className="w-3 h-3" /> Channels
            </h2>
            <div className="space-y-1">
              {mockChannels.filter(c => c.type === "channel").map(channel => (
                <button 
                  key={channel.id}
                  onClick={() => switchChannel(channel)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${activeChannel.id === channel.id ? 'bg-black text-white dark:bg-white dark:text-black font-medium' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                >
                  <span className="flex items-center gap-2"># {channel.name}</span>
                  {channel.unread > 0 && activeChannel.id !== channel.id && (
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{channel.unread}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Users className="w-3 h-3" /> Direct Messages
            </h2>
            <div className="space-y-1">
              {mockChannels.filter(c => c.type === "direct").map(channel => (
                <button 
                  key={channel.id}
                  onClick={() => switchChannel(channel)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${activeChannel.id === channel.id ? 'bg-black text-white dark:bg-white dark:text-black font-medium' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${activeChannel.id === channel.id ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black' : 'bg-gray-200 dark:bg-white/10'}`}>
                    {channel.name.charAt(0)}
                  </div>
                  <span className="truncate">{channel.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#111]">
        {/* Chat Header */}
        <div className="h-16 border-b border-gray-200 dark:border-white/10 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-lg flex items-center gap-2">
              {activeChannel.type === 'channel' ? <Hash className="w-5 h-5 text-gray-400" /> : null}
              {activeChannel.name}
            </h2>
          </div>
          <div className="flex items-center gap-4 text-gray-400">
            <button className="hover:text-black dark:hover:text-white transition-colors"><Phone className="w-5 h-5" /></button>
            <button className="hover:text-black dark:hover:text-white transition-colors"><Video className="w-5 h-5" /></button>
            <button className="hover:text-black dark:hover:text-white transition-colors"><MoreVertical className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FBFBFD] dark:bg-[#0A0A0A]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Hash className="w-12 h-12 mb-4 opacity-20" />
              <p>This is the start of your history with <strong>{activeChannel.name}</strong>.</p>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id} 
                  className={`flex gap-4 max-w-2xl ${msg.isMe ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold shadow-sm ${msg.isMe ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'}`}>
                    {msg.avatar}
                  </div>
                  <div className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-bold text-sm">{msg.sender}</span>
                      <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
                    </div>
                    <div className={`px-5 py-3 rounded-2xl text-sm shadow-sm ${msg.isMe ? 'bg-black text-white dark:bg-white dark:text-black rounded-tr-sm' : 'bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-tl-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-[#111] border-t border-gray-200 dark:border-white/10 shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-gray-50 dark:bg-white/5 p-2 rounded-2xl border border-gray-200 dark:border-white/10 focus-within:border-gray-300 dark:focus-within:border-white/20 transition-all">
            <button type="button" className="p-3 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>
            <button type="button" className="p-3 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              <ImageIcon className="w-5 h-5" />
            </button>
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Message ${activeChannel.type === 'channel' ? '#' : ''}${activeChannel.name}`}
              className="flex-1 bg-transparent border-none outline-none py-3 px-2 text-sm"
            />
            <button 
              type="submit" 
              disabled={!inputValue.trim()}
              className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
