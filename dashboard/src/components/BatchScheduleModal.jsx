import React, { useState } from 'react';
import { X, Calendar, Clock, Youtube, Loader2, CheckCircle2, AlertTriangle, Globe } from 'lucide-react';
import { getApiUrl } from '../config';

const TIMEZONES = [
    { value: 'UTC', label: 'UTC (GMT+00:00)' },
    { value: 'Europe/London', label: 'London (GMT+00:00)' },
    { value: 'Europe/Paris', label: 'Paris (GMT+01:00)' },
    { value: 'Europe/Berlin', label: 'Berlin (GMT+01:00)' },
    { value: 'Europe/Moscow', label: 'Moscow (GMT+03:00)' },
    { value: 'Asia/Dubai', label: 'Dubai (GMT+04:00)' },
    { value: 'Asia/Kolkata', label: 'India (GMT+05:30)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (GMT+07:00)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (GMT+08:00)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (GMT+09:00)' },
    { value: 'Australia/Sydney', label: 'Sydney (GMT+10:00)' },
    { value: 'America/New_York', label: 'New York (GMT-05:00)' },
    { value: 'America/Chicago', label: 'Chicago (GMT-06:00)' },
    { value: 'America/Denver', label: 'Denver (GMT-07:00)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-08:00)' },
    { value: 'America/Sao_Paulo', label: 'Sao Paulo (GMT-03:00)' },
];

function detectTimezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatLocalDateTime(offsetMinutes) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + offsetMinutes);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function clipTitle(clip) {
    return clip.title || `Clip #${(clip.clip_index != null ? clip.clip_index : 0) + 1}`;
}

function clipDescription(clip) {
    return [clip.hook_text, clip.description_tiktok, clip.description_instagram]
        .filter(Boolean).join('\n\n');
}

export default function BatchScheduleModal({ clips, selectedIndices, projectId, onClose, onSaved }) {
    const [mode, setMode] = useState('interval');
    const [startFrom, setStartFrom] = useState(formatLocalDateTime(60));
    const [intervalHours, setIntervalHours] = useState(4);
    const [timezone, setTimezone] = useState(detectTimezone);
    const [privacy, setPrivacy] = useState('public');
    const [saving, setSaving] = useState(false);
    const [results, setResults] = useState(null);
    const [success, setSuccess] = useState(false);

    const [exactTimes, setExactTimes] = useState(() => {
        const m = {};
        clips.forEach((_, i) => {
            m[i] = formatLocalDateTime((i + 1) * 60);
        });
        return m;
    });

    const preview = [];
    if (mode === 'interval') {
        const base = new Date(startFrom);
        clips.forEach((clip, i) => {
            const d = new Date(base.getTime() + i * intervalHours * 3600000);
            preview.push({ idx: i, time: d, title: clipTitle(clip) });
        });
    }

    const handleSave = async () => {
        setSaving(true);
        setResults(null);

        const clipIds = clips.map(c => c.id).filter(Boolean);

        if (clipIds.length === 0) {
            setResults([{ error: 'No clip IDs found. Save and reopen the project.' }]);
            setSaving(false);
            return;
        }

        try {
            const body = {
                clip_ids: clipIds,
                mode,
                start_from: mode === 'interval' ? new Date(startFrom).toISOString() : null,
                interval_hours: intervalHours,
                timezone,
                privacy_status: privacy,
                youtube_refresh_token: localStorage.getItem('youtubeRefreshToken_v1') || '',
                youtube_client_id: localStorage.getItem('youtubeClientId_v1') || '',
                youtube_client_secret: localStorage.getItem('youtubeClientSecret_v1') || '',
            };

            if (mode === 'exact') {
                body.exact_schedules = Object.entries(exactTimes).map(([idx, dt]) => ({
                    clip_id: clipIds[parseInt(idx)],
                    scheduled_for: new Date(dt).toISOString(),
                }));
            }

            const res = await fetch(getApiUrl('/api/schedules/batch'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(err);
            }

            const data = await res.json();
            setResults(data.schedules || []);
            setSuccess(true);
            setTimeout(() => { onSaved(); }, 2000);
        } catch (e) {
            setResults([{ error: e.message }]);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-[#121214] border border-white/10 p-6 rounded-2xl w-full max-w-xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button onClick={onClose} disabled={saving} className="absolute top-4 right-4 text-zinc-500 hover:text-white z-10">
                    <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                        <Calendar size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Schedule Uploads</h3>
                        <p className="text-xs text-zinc-500">{clips.length} clips selected</p>
                    </div>
                </div>

                {success ? (
                    <div className="text-center py-8 space-y-3">
                        <CheckCircle2 size={40} className="text-green-400 mx-auto" />
                        <p className="text-sm text-zinc-300">{results?.length || clips.length} clips scheduled!</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Mode</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setMode('interval')}
                                    className={`p-2.5 rounded-lg border text-center text-xs font-medium transition-all ${
                                        mode === 'interval' ? 'bg-primary/20 border-primary text-white' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                                    }`}>
                                    <Clock size={14} className="inline mr-1" /> Every N hours
                                </button>
                                <button onClick={() => setMode('exact')}
                                    className={`p-2.5 rounded-lg border text-center text-xs font-medium transition-all ${
                                        mode === 'exact' ? 'bg-primary/20 border-primary text-white' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                                    }`}>
                                    <Calendar size={14} className="inline mr-1" /> Manual times
                                </button>
                            </div>
                        </div>

                        {mode === 'interval' ? (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Start Date/Time</label>
                                        <input type="datetime-local" value={startFrom} onChange={e => setStartFrom(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Every (hours)</label>
                                        <input type="number" min="0.5" max="168" step="0.5" value={intervalHours}
                                            onChange={e => setIntervalHours(parseFloat(e.target.value))}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Timezone</label>
                                    <select value={timezone} onChange={e => setTimezone(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50">
                                        {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Preview</label>
                                    <div className="bg-black/30 rounded-lg border border-white/5 max-h-40 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                        {preview.map((p, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                                                <span className="text-zinc-500 font-mono w-6 shrink-0">#{i + 1}</span>
                                                <Clock size={10} className="shrink-0" />
                                                <span className="font-mono text-zinc-300 shrink-0">{p.time.toLocaleString()}</span>
                                                <span className="truncate text-zinc-500">{p.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Set time for each clip</label>
                                {clips.map((clip, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs text-zinc-500 w-12 shrink-0 truncate">{clipTitle(clip)}</span>
                                        <input type="datetime-local" value={exactTimes[i] || ''}
                                            onChange={e => setExactTimes(prev => ({ ...prev, [i]: e.target.value }))}
                                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Privacy */}
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Privacy</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['public', 'unlisted', 'private'].map(p => (
                                    <button key={p} onClick={() => setPrivacy(p)}
                                        className={`p-2 rounded-lg border text-center text-xs font-medium transition-all ${
                                            privacy === p ? 'bg-red-500/20 border-red-500 text-white' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                                        }`}>
                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleSave} disabled={saving}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                            {saving ? <Loader2 size={20} className="animate-spin" /> : <Calendar size={20} />}
                            {saving ? 'Saving...' : `Schedule ${clips.length} Clips`}
                        </button>

                        {results && (
                            <div className="mt-3 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                {results.map((r, i) => (
                                    <div key={i} className={`flex items-center gap-2 text-xs ${r.id ? 'text-green-400' : 'text-red-400'}`}>
                                        {r.id ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                        {r.error || `Scheduled at ${new Date(r.scheduled_for).toLocaleString()}`}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
