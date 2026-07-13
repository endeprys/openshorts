import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Youtube, CheckCircle2, AlertTriangle, Loader2, Trash2, ExternalLink, Calendar as CalendarIcon, Send } from 'lucide-react';
import { getApiUrl } from '../config';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS = {
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' },
    uploading: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
    done: { bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-400' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-400' },
    overdue: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', dot: 'bg-zinc-400' },
};

export default function ScheduleCalendar({ youtubeRefreshToken, youtubeClientId, youtubeClientSecret }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [editingTime, setEditingTime] = useState('');
    const [publishingId, setPublishingId] = useState(null);
    const [expandedDay, setExpandedDay] = useState(null);

    const dateFrom = new Date(year, month, 1).toISOString();
    const dateTo = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const loadCalendar = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(getApiUrl(`/api/schedules/calendar?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`));
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setEntries(data.entries || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadCalendar(); }, [year, month]);

    // Build calendar grid
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const entriesByDay = {};
    entries.forEach(e => {
        const d = new Date(e.scheduled_for);
        const key = d.getDate();
        if (!entriesByDay[key]) entriesByDay[key] = [];
        entriesByDay[key].push(e);
    });

    const handlePrev = () => {
        if (month === 0) { setYear(y => y - 1); setMonth(11); }
        else setMonth(m => m - 1);
    };
    const handleNext = () => {
        if (month === 11) { setYear(y => y + 1); setMonth(0); }
        else setMonth(m => m + 1);
    };

    const handleDeleteEntry = async (id) => {
        if (!confirm('Remove this scheduled upload?')) return;
        try {
            await fetch(getApiUrl(`/api/schedules/${id}`), { method: 'DELETE' });
            loadCalendar();
            setSelectedEntry(null);
        } catch (e) {
            alert('Failed: ' + e.message);
        }
    };

    const handleReschedule = async (id) => {
        if (!editingTime) return;
        try {
            const formData = new FormData();
            formData.append('scheduled_for', new Date(editingTime).toISOString());
            await fetch(getApiUrl(`/api/schedules/${id}`), { method: 'PATCH', body: formData });
            loadCalendar();
            setSelectedEntry(null);
            setEditingTime('');
        } catch (e) {
            alert('Failed: ' + e.message);
        }
    };

    const handlePublishNow = async (id) => {
        setPublishingId(id);
        try {
            const headers = {};
            if (youtubeRefreshToken) headers['X-Youtube-Refresh-Token'] = youtubeRefreshToken;
            if (youtubeClientId) headers['X-Youtube-Client-Id'] = youtubeClientId;
            if (youtubeClientSecret) headers['X-Youtube-Client-Secret'] = youtubeClientSecret;
            const res = await fetch(getApiUrl(`/api/schedules/${id}/publish`), { method: 'POST', headers });
            if (!res.ok) throw new Error(await res.text());
            await loadCalendar();
            setSelectedEntry(null);
        } catch (e) {
            alert('Publish failed: ' + e.message);
        } finally {
            setPublishingId(null);
        }
    };

    const pad = n => String(n).padStart(2, '0');
    const formatTime = (iso) => {
        const d = new Date(iso);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <CalendarIcon className="text-primary" size={22} />
                    Schedule Calendar
                </h2>
                <button onClick={loadCalendar} className="text-xs text-zinc-500 hover:text-white transition-colors">
                    Refresh
                </button>
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-6">
                <button onClick={handlePrev} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all">
                    <ChevronLeft size={20} />
                </button>
                <h3 className="text-lg font-semibold text-white">{MONTHS[month]} {year}</h3>
                <button onClick={handleNext} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all">
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {DAYS.map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider py-2">{d}</div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
                {/* Empty cells */}
                {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayEntries = entriesByDay[day] || [];
                    const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
                    const isExpanded = expandedDay === day;
                    const visibleEntries = isExpanded ? dayEntries : dayEntries.slice(0, 3);
                    const hasMore = dayEntries.length > 3;
                    return (
                        <div
                            key={day}
                            className={`rounded-xl border p-1.5 flex flex-col transition-all ${
                                isExpanded ? 'border-primary/40 bg-primary/5 row-span-3' : 'aspect-square'
                            } ${isToday && !isExpanded ? 'border-primary/40 bg-primary/5' : 'border-white/5 bg-white/[0.02] hover:border-white/20'}`}
                        >
                            <span className={`text-[11px] font-medium ${isToday ? 'text-primary' : 'text-zinc-400'}`}>{day}</span>
                            <div className={`flex-1 space-y-0.5 mt-1 ${isExpanded ? '' : 'overflow-hidden'}`}>
                                {visibleEntries.map(entry => {
                                    const sc = STATUS_COLORS[entry.status] || STATUS_COLORS.pending;
                                    return (
                                        <button
                                            key={entry.id}
                                            onClick={() => { setSelectedEntry(entry); setEditingTime(''); }}
                                            className={`w-full text-left ${sc.bg} ${sc.text} rounded px-1 py-0.5 text-[9px] font-medium truncate hover:opacity-80 transition-opacity`}
                                        >
                                            {formatTime(entry.scheduled_for)} {entry.project_title?.slice(0, 12)}
                                        </button>
                                    );
                                })}
                                {hasMore && !isExpanded && (
                                    <button onClick={() => setExpandedDay(day)}
                                        className="text-[9px] text-primary/70 hover:text-primary pl-1 transition-colors">
                                        +{dayEntries.length - 3} more
                                    </button>
                                )}
                                {hasMore && isExpanded && (
                                    <button onClick={() => setExpandedDay(null)}
                                        className="text-[9px] text-zinc-500 hover:text-white pl-1 transition-colors">
                                        Show less
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-6 text-xs text-zinc-500">
                {Object.entries(STATUS_COLORS).map(([key, val]) => (
                    <span key={key} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${val.dot}`} />
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                    </span>
                ))}
            </div>

            {loading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-zinc-500" />
                </div>
            )}

            {error && (
                <div className="text-center py-4">
                    <p className="text-red-400 text-xs">{error}</p>
                </div>
            )}

            {/* Entry detail modal */}
            {selectedEntry && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedEntry(null)}>
                    <div className="bg-[#121214] border border-white/10 p-5 rounded-xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-white">Scheduled Upload</h4>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                STATUS_COLORS[selectedEntry.status]?.bg || 'bg-zinc-500/20'
                            } ${STATUS_COLORS[selectedEntry.status]?.text || 'text-zinc-400'}`}>
                                {selectedEntry.status}
                            </span>
                        </div>

                        <div className="space-y-2 text-xs text-zinc-400">
                            <p><span className="text-zinc-500">Project:</span> {selectedEntry.project_title || 'Untitled'}</p>
                            <p><span className="text-zinc-500">Clip:</span> #{selectedEntry.clip_index != null ? selectedEntry.clip_index + 1 : '?'}</p>
                            <p><span className="text-zinc-500">Title:</span> {selectedEntry.title || '—'}</p>
                            <p><span className="text-zinc-500">Scheduled:</span> {new Date(selectedEntry.scheduled_for).toLocaleString()}</p>
                            {selectedEntry.video_url && (
                                <p className="flex items-center gap-1">
                                    <Youtube size={12} className="text-red-400" />
                                    <a href={selectedEntry.video_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Watch on YouTube</a>
                                </p>
                            )}
                            {selectedEntry.error && (
                                <p className="text-red-400 flex items-center gap-1">
                                    <AlertTriangle size={12} /> {selectedEntry.error}
                                </p>
                            )}
                        </div>

                        {/* Publish Now */}
                        {selectedEntry.status === 'overdue' || selectedEntry.status === 'failed' ? (
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <button onClick={() => handlePublishNow(selectedEntry.id)}
                                    disabled={publishingId === selectedEntry.id}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-xs font-bold hover:bg-green-500/30 transition-all disabled:opacity-50">
                                    {publishingId === selectedEntry.id ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Send size={14} />
                                    )}
                                    {publishingId === selectedEntry.id ? 'Publishing...' : 'Publish Now'}
                                </button>
                            </div>
                        ) : null}

                        {/* Reschedule */}
                        {selectedEntry.status === 'pending' || selectedEntry.status === 'overdue' ? (
                            <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase">Reschedule</label>
                                <input type="datetime-local" value={editingTime || editingTimeFromEntry(selectedEntry.scheduled_for)}
                                    onChange={e => setEditingTime(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
                                <div className="flex gap-2">
                                    <button onClick={() => handleReschedule(selectedEntry.id)}
                                        className="flex-1 py-2 bg-primary/20 border border-primary/30 text-primary rounded-lg text-xs font-bold hover:bg-primary/30 transition-all">
                                        Update Time
                                    </button>
                                    <button onClick={() => handleDeleteEntry(selectedEntry.id)}
                                        className="py-2 px-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-all">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        <button onClick={() => setSelectedEntry(null)} className="w-full mt-3 text-xs text-zinc-500 hover:text-white py-2 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function editingTimeFromEntry(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
