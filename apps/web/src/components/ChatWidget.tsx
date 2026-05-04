"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, User, Users } from "lucide-react";

const messagesData = [
  { id: 1, text: "Hey! How is the new batch coming along?", sender: "Admin", time: "10:00 AM", isMe: false },
  { id: 2, text: "Almost done. The yield is looking good.", sender: "Production", time: "10:05 AM", isMe: true },
  { id: 3, text: "Great, update the inventory once finished.", sender: "Admin", time: "10:06 AM", isMe: false },
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(messagesData);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState("teams");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setMessages([...messages, { 
      id: Date.now(), 
      text: newMessage, 
      sender: "Me", 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
      isMe: true 
    }]);
    setNewMessage("");
  };

  return (
    <>
      <div className="fixed bottom-8 right-8 z-[100]">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
        >
          {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-28 right-8 w-[380px] h-[600px] bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-2xl z-[100] flex flex-col overflow-hidden"
          >
            <div className="p-4 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">AXOS Communications</h3>
              </div>
              <div className="flex gap-2 bg-gray-200/50 dark:bg-black/20 p-1 rounded-xl">
                <button 
                  onClick={() => setActiveTab('teams')}
                  className={`flex-1 flex justify-center items-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'teams' ? 'bg-white dark:bg-[#222] shadow-sm' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  <Users className="w-4 h-4" /> Departments
                </button>
                <button 
                  onClick={() => setActiveTab('direct')}
                  className={`flex-1 flex justify-center items-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'direct' ? 'bg-white dark:bg-[#222] shadow-sm' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  <User className="w-4 h-4" /> Direct
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-gray-400 mb-1 px-1">{msg.sender} • {msg.time}</span>
                  <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 dark:bg-white/10 rounded-bl-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white dark:bg-[#111] border-t border-gray-100 dark:border-white/5">
              <form onSubmit={handleSend} className="relative flex items-center">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..." 
                  className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-full py-3 pl-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-black/5"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-full transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
