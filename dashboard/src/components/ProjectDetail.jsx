import React, { useState, useEffect, useCallback } from 'react';
import { Film, ArrowLeft, Youtube, Calendar, Trash2, ExternalLink, Loader2, CheckSquare, Square, Clock, Type, Edit3, Save, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getApiUrl } from '../config';
import BatchScheduleModal from './BatchScheduleModal';
import RemotionPreview from './RemotionPreview';
import { renderInBrowser } from '../lib/renderInBrowser';

const SUBTITLE_FONTS = ['Verdana', 'Arial', 'Impact', 'Helvetica', 'Georgia', 'Courier New'];

export default function ProjectDetail({ project, onBack }) {
    const [clips, setClips] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [showSchedule, setShowSchedule] = useState(false);

    // Subtitle modal state (per clip)
    const [subClipIndex, setSubClipIndex] = useState(null);
    const [subSettings, setSubSettings] = useState({
        position: 'bottom', font_size: 24, font_name: 'Verdana',
        font_color: '#FFFFFF', highlight_color: '#FFDD00',
        border_color: '#000000', border_width: 2,
        bg_color: '#000000', bg_opacity: 0.0, animation: 'pop',
    });
    const [subRendering, setSubRendering] = useState(false);
    const [subError, setSubError] = useState(null);
    const [subCaptions, setSubCaptions] = useState([]);
    const [subCaptionsLoading, setSubCaptionsLoading] = useState(false);
    const [subDurationSec, setSubDurationSec] = useState(30);
    const [subUseRemotion, setSubUseRemotion] = useState(false);

    // Edit modal state (per clip)
    const [editClipIndex, setEditClipIndex] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', description_tiktok: '', description_instagram: '', hook_text: '' });
    const [editSaving, setEditSaving] = useState(false);

    const loadClips = useCallback(async () => {
        if (!project?.id) return;
        setLoading(true);
        try {
            const res = await fetch(getApiUrl(`/api/projects/${project.id}`));
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setClips(data.clips || []);
        } catch (e) {
            console.error('Failed to load clips', e);
        } finally {
            setLoading(false);
        }
    }, [project?.id]);

    useEffect(() => { loadClips(); }, [loadClips]);

    const toggleAll = () => {
        if (selected.size === clips.length) setSelected(new Set());
        else setSelected(new Set(clips.map((_, i) => i)));
    };

    const toggleOne = (i) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });
    };

    const handleDelete = async () => {
        if (!confirm(`Delete project "${project.title}" and all its clips?`)) return;
        try {
            await fetch(getApiUrl(`/api/projects/${project.id}`), { method: 'DELETE' });
            onBack();
        } catch (e) {
            alert('Delete failed: ' + e.message);
        }
    };

    const openSubtitle = (i) => {
        setSubClipIndex(i);
        setSubError(null);
        setSubCaptions([]);
        setSubUseRemotion(false);
    };

    // Fetch captions when subtitle modal opens
    useEffect(() => {
        if (subClipIndex === null || !project?.id) return;
        const clip = clips[subClipIndex];
        if (!clip) return;
        setSubCaptionsLoading(true);
        fetch(getApiUrl(`/api/clip/${project.id}/${subClipIndex}/transcript`))
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && data.captions && data.captions.length > 0) {
                    setSubCaptions(data.captions);
                    setSubDurationSec(data.durationSec || clip.duration || 30);
                    setSubUseRemotion(true);
                } else {
                    setSubUseRemotion(false);
                }
            })
            .catch(() => setSubUseRemotion(false))
            .finally(() => setSubCaptionsLoading(false));
    }, [subClipIndex, project?.id]);

    const handleRenderSubtitle = async () => {
        const clip = clips[subClipIndex];
        if (!clip) return;
        const caps = subCaptions.length > 0 ? subCaptions : null;
        if (!caps) {
            setSubError('No captions found for this clip — cannot generate animated subtitles');
            return;
        }
        setSubRendering(true);
        setSubError(null);
        try {
            const subtitleConfig = {
                captions: caps,
                position: subSettings.position,
                style: {
                    fontFamily: subSettings.font_name,
                    fontSize: subSettings.font_size * 2.2,
                    fontColor: subSettings.font_color,
                    highlightColor: subSettings.highlight_color,
                    borderColor: subSettings.border_color,
                    borderWidth: subSettings.border_width * 1.5,
                    bgColor: subSettings.bg_color,
                    bgOpacity: subSettings.bg_opacity,
                    animation: subSettings.animation,
                },
            };

            const videoUrl = getApiUrl(clip.video_url);
            const blobUrl = await renderInBrowser({
                videoUrl,
                durationInSeconds: durationSec,
                subtitles: subtitleConfig,
                hook: null,
                effects: null,
            });

            const blobRes = await fetch(blobUrl);
            const blob = await blobRes.blob();
            const formData = new FormData();
            formData.append('job_id', project.id);
            formData.append('clip_index', subClipIndex);
            formData.append('file', blob, `clip-${subClipIndex + 1}.mp4`);

            const persistRes = await fetch(getApiUrl('/api/video/persist-blob'), {
                method: 'POST',
                body: formData,
            });

            if (!persistRes.ok) {
                const errText = await persistRes.text();
                throw new Error(errText);
            }

            const persistData = await persistRes.json();
            await loadClips();
            setSubClipIndex(null);
        } catch (e) {
            setSubError(e.message);
        } finally {
            setSubRendering(false);
        }
    };

    const openEdit = (i) => {
        const clip = clips[i];
        setEditClipIndex(i);
        setEditForm({
            title: clip.title || '',
            description_tiktok: clip.description_tiktok || '',
            description_instagram: clip.description_instagram || '',
            hook_text: clip.hook_text || '',
        });
    };

    const handleSaveEdit = async () => {
        const clip = clips[editClipIndex];
        if (!clip) return;
        setEditSaving(true);
        try {
            const res = await fetch(getApiUrl(`/api/clips/${clip.id}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            if (!res.ok) throw new Error(await res.text());
            await loadClips();
            setEditClipIndex(null);
        } catch (e) {
            alert('Edit failed: ' + e.message);
        } finally {
            setEditSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={24} className="animate-spin text-zinc-500" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Film className="text-primary" size={20} />
                        {project.title || 'Untitled Project'}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                        {clips.length} clips
                        {project.lang && <> &middot; {project.lang}</>}
                        {project.created_at && <> &middot; {new Date(project.created_at).toLocaleDateString()}</>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {selected.size > 0 && (
                        <button onClick={() => setShowSchedule(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 border border-primary/30 text-primary rounded-lg text-xs font-bold hover:bg-primary/30 transition-all">
                            <Calendar size={14} />
                            Schedule ({selected.size})
                        </button>
                    )}
                    <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-all">
                        <Trash2 size={14} />
                        Delete
                    </button>
                </div>
            </div>

            {/* Clip grid */}
            {clips.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
                    <Film size={40} className="text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-500 text-sm">No clips in this project.</p>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
                            {selected.size === clips.length ? <CheckSquare size={14} /> : <Square size={14} />}
                            {selected.size === clips.length ? 'Deselect all' : `Select all (${clips.length})`}
                        </button>
                        {selected.size > 0 && selected.size !== clips.length && (
                            <span className="text-xs text-zinc-500">{selected.size} selected</span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {clips.map((clip, i) => (
                            <div key={clip.id || i}
                                className={`bg-surface border rounded-xl overflow-hidden transition-all group ${
                                    selected.has(i) ? 'border-primary/50 ring-1 ring-primary/30' : 'border-white/5 hover:border-white/20'
                                }`}>
                                <div className="relative aspect-[9/16] bg-black">
                                    {clip.video_url && (
                                        <video src={getApiUrl(clip.video_url)}
                                            className="w-full h-full object-contain" muted playsInline
                                            onMouseEnter={e => e.target.play().catch(() => {})}
                                            onMouseLeave={e => e.target.pause()} />
                                    )}
                                    <button onClick={() => toggleOne(i)}
                                        className="absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all z-10 ${
                                            selected.has(i) ? 'bg-primary border-primary text-white' : 'bg-black/60 border-white/40 hover:border-white'}">
                                        {selected.has(i) && <CheckSquare size={14} />}
                                    </button>
                                    <div className="absolute top-2 right-2 bg-black/70 text-[10px] text-zinc-400 px-2 py-0.5 rounded-full">
                                        #{i + 1}
                                    </div>
                                    {clip.start_time != null && (
                                        <div className="absolute bottom-2 left-2 bg-black/70 text-[10px] text-zinc-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Clock size={10} />
                                            {clip.start_time.toFixed(1)}s – {clip.end_time?.toFixed(1)}s
                                        </div>
                                    )}
                                    {clip.duration > 0 && (
                                        <div className="absolute bottom-2 right-2 bg-black/70 text-[10px] text-zinc-400 px-2 py-0.5 rounded-full">
                                            {clip.duration.toFixed(0)}s
                                        </div>
                                    )}
                                    {/* Action buttons */}
                                    <div className="absolute bottom-0 left-0 right-0 p-1.5 flex gap-1 bg-gradient-to-t from-black/80 to-transparent pt-4">
                                        <button onClick={() => openSubtitle(i)}
                                            className="flex-1 py-1 bg-yellow-500/80 hover:bg-yellow-400 text-black text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1">
                                            <Type size={10} /> Subs
                                        </button>
                                        <button onClick={() => openEdit(i)}
                                            className="flex-1 py-1 bg-white/10 hover:bg-white/20 text-zinc-200 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1">
                                            <Edit3 size={10} /> Edit
                                        </button>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <p className="text-xs font-medium text-white truncate">{clip.title || `Clip #${i + 1}`}</p>
                                    {clip.hook_text && (
                                        <p className="text-[10px] text-primary/70 mt-1 truncate">&quot;{clip.hook_text}&quot;</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Subtitle Modal */}
            {subClipIndex !== null && (() => {
                const clip = clips[subClipIndex] || {};
                const videoUrl = clip.video_url ? getApiUrl(clip.video_url) : '';
                const subtitleConfig = subUseRemotion ? {
                    captions: subCaptions,
                    position: subSettings.position,
                    style: {
                        fontFamily: subSettings.font_name,
                        fontSize: subSettings.font_size * 2.2,
                        fontColor: subSettings.font_color,
                        highlightColor: subSettings.highlight_color,
                        borderColor: subSettings.border_color,
                        borderWidth: subSettings.border_width * 1.5,
                        bgColor: subSettings.bg_color,
                        bgOpacity: subSettings.bg_opacity,
                        animation: subSettings.animation,
                    },
                } : null;

                const bw = Math.max(subSettings.border_width, 0);
                const bc = subSettings.border_color;
                const outlineShadow = bw > 0 ? [
                    `-${bw}px -${bw}px 0 ${bc}`, `${bw}px -${bw}px 0 ${bc}`,
                    `-${bw}px ${bw}px 0 ${bc}`, `${bw}px ${bw}px 0 ${bc}`,
                    `0 -${bw}px 0 ${bc}`, `0 ${bw}px 0 ${bc}`,
                    `-${bw}px 0 0 ${bc}`, `${bw}px 0 0 ${bc}`,
                ].join(', ') : 'none';

                return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-[#121214] border border-white/10 p-6 rounded-2xl w-full max-w-5xl shadow-2xl relative flex flex-col md:flex-row gap-6 max-h-[90vh]">
                        <button onClick={() => { setSubClipIndex(null); setSubError(null); }} disabled={subRendering}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white z-10">
                            <X size={20} />
                        </button>

                        {/* Left: Preview */}
                        <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-lg border border-white/5 overflow-hidden relative aspect-[9/16] max-h-[600px]">
                            {subCaptionsLoading ? (
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span className="text-sm">Loading preview...</span>
                                </div>
                            ) : subUseRemotion && subtitleConfig ? (
                                <RemotionPreview
                                    videoUrl={videoUrl}
                                    durationInSeconds={subDurationSec}
                                    subtitles={subtitleConfig}
                                />
                            ) : (
                                <>
                                    <video src={videoUrl} className="w-full h-full object-contain opacity-50" muted playsInline />
                                    <div className={`absolute w-full px-8 text-center transition-all duration-300 pointer-events-none flex flex-col items-center justify-center ${subSettings.position === 'top' ? 'top-20' : ''} ${subSettings.position === 'middle' ? 'top-0 bottom-0' : ''} ${subSettings.position === 'bottom' ? 'bottom-20' : ''}`}>
                                        <span style={{
                                            fontFamily: subSettings.font_name,
                                            color: subSettings.font_color,
                                            fontSize: '20px',
                                            fontWeight: 'bold',
                                            maxWidth: '85%',
                                            padding: '6px 12px',
                                            borderRadius: '4px',
                                            textAlign: 'center',
                                            lineHeight: '1.3',
                                            textShadow: outlineShadow,
                                        }}>
                                            {subCaptions.length > 0
                                                ? subCaptions.slice(0, 8).map(w => w.text).join(' ') + (subCaptions.length > 8 ? '...' : '')
                                                : 'This is how your subtitles\nwill appear on the video'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right: Controls */}
                        <div className="w-full md:w-80 flex flex-col">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 shrink-0">
                                <Type className="text-yellow-400" /> Subtitles — Clip #{subClipIndex + 1}
                            </h3>
                            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                                <div>
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Position</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['top', 'middle', 'bottom'].map(pos => (
                                            <button key={pos} onClick={() => setSubSettings(s => ({ ...s, position: pos }))}
                                                className={`p-2 rounded-lg border text-center text-xs font-medium transition-all ${subSettings.position === pos ? 'bg-primary/20 border-primary text-white' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'}`}>
                                                {pos.charAt(0).toUpperCase() + pos.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Animation</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[{ value: 'pop', label: 'Pop' }, { value: 'word-highlight', label: 'Glow' },
                                          { value: 'karaoke', label: 'Karaoke' }, { value: 'none', label: 'None' }].map(opt => (
                                            <button key={opt.value} onClick={() => setSubSettings(s => ({ ...s, animation: opt.value }))}
                                                className={`p-2 rounded-lg border text-center text-xs font-medium transition-all ${subSettings.animation === opt.value ? 'bg-primary/20 border-primary text-white' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Font</label>
                                    <select value={subSettings.font_name} onChange={e => setSubSettings(s => ({ ...s, font_name: e.target.value }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white">
                                        {SUBTITLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Font Size: {subSettings.font_size}px</label>
                                    <input type="range" min="12" max="48" value={subSettings.font_size}
                                        onChange={e => setSubSettings(s => ({ ...s, font_size: parseInt(e.target.value) }))}
                                        className="w-full accent-primary" />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Font</label>
                                        <input type="color" value={subSettings.font_color}
                                            onChange={e => setSubSettings(s => ({ ...s, font_color: e.target.value }))}
                                            className="w-full h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Glow</label>
                                        <input type="color" value={subSettings.highlight_color}
                                            onChange={e => setSubSettings(s => ({ ...s, highlight_color: e.target.value }))}
                                            className="w-full h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Border</label>
                                        <input type="color" value={subSettings.border_color}
                                            onChange={e => setSubSettings(s => ({ ...s, border_color: e.target.value }))}
                                            className="w-full h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Border Width</label>
                                    <input type="range" min="0" max="5" value={subSettings.border_width}
                                        onChange={e => setSubSettings(s => ({ ...s, border_width: parseInt(e.target.value) }))}
                                        className="w-full accent-primary" />
                                </div>

                                {subError && (
                                    <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                        <span>{subError}</span>
                                    </div>
                                )}
                            </div>

                            <button onClick={handleRenderSubtitle} disabled={subRendering || subCaptionsLoading || !subUseRemotion}
                                className="w-full py-3 mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                                {subRendering ? <Loader2 size={20} className="animate-spin" /> : <Type size={20} />}
                                {subRendering ? 'Rendering...' : 'Generate Subtitles'}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Edit Modal */}
            {editClipIndex !== null && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-[#121214] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
                        <button onClick={() => setEditClipIndex(null)} disabled={editSaving}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white z-10">
                            <X size={20} />
                        </button>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Edit3 className="text-blue-400" /> Edit Clip #{editClipIndex + 1}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Title</label>
                                <input type="text" value={editForm.title}
                                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Hook Text</label>
                                <textarea value={editForm.hook_text}
                                    onChange={e => setEditForm(f => ({ ...f, hook_text: e.target.value }))}
                                    rows={2} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">TikTok Description</label>
                                <textarea value={editForm.description_tiktok}
                                    onChange={e => setEditForm(f => ({ ...f, description_tiktok: e.target.value }))}
                                    rows={2} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Instagram Description</label>
                                <textarea value={editForm.description_instagram}
                                    onChange={e => setEditForm(f => ({ ...f, description_instagram: e.target.value }))}
                                    rows={2} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none" />
                            </div>

                            <button onClick={handleSaveEdit} disabled={editSaving}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                                {editSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                {editSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Schedule Modal */}
            {showSchedule && (
                <BatchScheduleModal
                    clips={clips.filter((_, i) => selected.has(i))}
                    selectedIndices={Array.from(selected)}
                    projectId={project.id}
                    projectTitle={project.title}
                    onClose={() => setShowSchedule(false)}
                    onSaved={() => { setShowSchedule(false); setSelected(new Set()); }}
                />
            )}
        </div>
    );
}
