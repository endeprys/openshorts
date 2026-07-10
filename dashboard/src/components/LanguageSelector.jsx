import React, { useState } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';

const LANGUAGES = [
  { value: 'English', label: 'English', flag: '🇬🇧' },
  { value: 'Russian', label: 'Русский', flag: '🇷🇺' },
  { value: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { value: 'French', label: 'Français', flag: '🇫🇷' },
  { value: 'German', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'Portuguese', label: 'Português', flag: '🇧🇷' },
  { value: 'Italian', label: 'Italiano', flag: '🇮🇹' },
  { value: 'Japanese', label: '日本語', flag: '🇯🇵' },
  { value: 'Korean', label: '한국어', flag: '🇰🇷' },
  { value: 'Chinese', label: '中文', flag: '🇨🇳' },
  { value: 'Arabic', label: 'العربية', flag: '🇸🇦' },
  { value: 'Hindi', label: 'हिन्दी', flag: '🇮🇳' },
  { value: 'Turkish', label: 'Türkçe', flag: '🇹🇷' },
  { value: 'Ukrainian', label: 'Українська', flag: '🇺🇦' },
  { value: 'Kazakh', label: 'Қазақша', flag: '🇰🇿' },
];

export default function LanguageSelector({ lang, onLangChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = LANGUAGES.find(l => l.value === lang) || LANGUAGES[0];

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 transition-colors min-w-[160px]"
      >
        <span className="flex items-center gap-2 truncate">
          <Globe size={14} className="text-zinc-500 shrink-0" />
          <span className="truncate">{selected.flag} {selected.label}</span>
        </span>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-2 left-0 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20">
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  onClick={() => { onLangChange(l.value); setIsOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left text-sm ${lang === l.value ? 'text-white bg-white/5' : 'text-zinc-400'}`}
                >
                  <span className="text-base shrink-0">{l.flag}</span>
                  <span className="font-medium">{l.label}</span>
                  {lang === l.value && <Check size={14} className="text-primary ml-auto shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
