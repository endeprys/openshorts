import React, { useState, useEffect } from 'react';
import { Bot, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { getApiUrl } from '../config';

const GEMINI_MODELS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'gemini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' },
];

const DEFAULT_MODEL = 'gemini-2.5-flash';

export default function ModelSelector({ model, onModelChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  const fetchOllamaModels = async () => {
    setOllamaLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/ollama/models'));
      const data = await res.json();
      setOllamaConnected(data.connected);
      setOllamaModels(data.models || []);
    } catch {
      setOllamaConnected(false);
      setOllamaModels([]);
    }
    setOllamaLoading(false);
  };

  useEffect(() => {
    fetchOllamaModels();
  }, []);

  const allModels = [
    ...GEMINI_MODELS,
    ...ollamaModels.map((m) => ({
      value: `ollama:${m}`,
      label: m,
      provider: 'ollama',
    })),
  ];

  const selected = allModels.find((m) => m.value === model) || {
    value: DEFAULT_MODEL,
    label: DEFAULT_MODEL,
    provider: 'gemini',
  };

  const ProviderIcon = ({ provider }) =>
    provider === 'ollama' ? (
      <svg viewBox="0 0 1024 1024" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M512 64C286 64 128 222 128 448c0 152 82 284 202 362-40 22-64 62-64 108v-4c0 14 8 26 20 32 0 0 36 18 92 18s92-18 92-18c12-6 20-18 20-32v4c0-46-24-86-64-108 120-78 202-210 202-362C896 222 738 64 512 64zm0 64c88 0 160 72 160 160s-72 160-160 160-160-72-160-160 72-160 160-160zm0 768c-24 0-48-2-70-6 14-8 24-22 28-38 6 2 12 4 18 6 8 2 16 4 24 6-22 4-44 6-66 6-70 0-128-18-128-18h-4c8-8 14-18 18-30 78 28 166 28 244 0 4 12 10 22 18 30h-4c0 0-58 18-128 18-22 0-44-2-66-6 8-2 16-4 24-6 6-2 12-4 18-6 4 16 14 30 28 38-22 4-46 6-70 6z"/>
      </svg>
    ) : (
      <Sparkles size={14} />
    );

  return (
    <div className="relative z-40">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 transition-colors min-w-[200px]"
        >
          <span className="flex items-center gap-2 truncate">
            <ProviderIcon provider={selected.provider} />
            <span className="truncate">{selected.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${selected.provider === 'ollama' ? 'bg-orange-500/20 text-orange-400' : 'bg-primary/20 text-primary'}`}>
              {selected.provider === 'ollama' ? 'Ollama' : 'Gemini'}
            </span>
          </span>
          <ChevronDown size={14} className={`text-zinc-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={fetchOllamaModels}
          title="Refresh Ollama models"
          className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={ollamaLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-2 left-0 w-72 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20">
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold bg-white/5">Gemini Models</div>
              {GEMINI_MODELS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => { onModelChange(m.value); setIsOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left text-sm ${model === m.value || (!model && m.value === DEFAULT_MODEL) ? 'text-white bg-white/5' : 'text-zinc-400'}`}
                >
                  <Sparkles size={14} className="text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{m.label}</div>
                    <div className="text-[10px] text-zinc-600">{m.value}</div>
                  </div>
                  {(model === m.value || (!model && m.value === DEFAULT_MODEL)) && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}

              <div className="border-t border-white/5 mt-1">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold bg-white/5 flex items-center justify-between">
                  <span>Ollama Models</span>
                  {ollamaConnected ? (
                    <span className="text-green-500">Connected</span>
                  ) : (
                    <span className="text-zinc-600">Disconnected</span>
                  )}
                </div>
                {ollamaModels.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-zinc-600 text-center">
                    {ollamaConnected ? 'No models found' : 'Ollama not available'}
                  </div>
                ) : (
                  ollamaModels.map((m) => (
                    <button
                      key={`ollama:${m}`}
                      onClick={() => { onModelChange(`ollama:${m}`); setIsOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left text-sm ${model === `ollama:${m}` ? 'text-white bg-white/5' : 'text-zinc-400'}`}
                    >
                      <svg viewBox="0 0 1024 1024" fill="currentColor" className="w-3.5 h-3.5 text-orange-400 shrink-0">
                        <path d="M512 64C286 64 128 222 128 448c0 152 82 284 202 362-40 22-64 62-64 108v-4c0 14 8 26 20 32 0 0 36 18 92 18s92-18 92-18c12-6 20-18 20-32v4c0-46-24-86-64-108 120-78 202-210 202-362C896 222 738 64 512 64zm0 64c88 0 160 72 160 160s-72 160-160 160-160-72-160-160 72-160 160-160zm0 768c-24 0-48-2-70-6 14-8 24-22 28-38 6 2 12 4 18 6 8 2 16 4 24 6-22 4-44 6-66 6-70 0-128-18-128-18h-4c8-8 14-18 18-30 78 28 166 28 244 0 4 12 10 22 18 30h-4c0 0-58 18-128 18-22 0-44-2-66-6 8-2 16-4 24-6 6-2 12-4 18-6 4 16 14 30 28 38-22 4-46 6-70 6z"/>
                      </svg>
                      <span className="font-medium truncate">{m}</span>
                      {model === `ollama:${m}` && (
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 ml-auto" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
