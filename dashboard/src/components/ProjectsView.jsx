import React, { useState, useEffect } from 'react';
import { Folder, Film, Trash2, Clock, Calendar, BarChart3, ExternalLink, ChevronRight, Loader2 } from 'lucide-react';
import { getApiUrl } from '../config';

export default function ProjectsView({ onSelectProject }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadProjects = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(getApiUrl('/api/projects'));
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setProjects(data.projects || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadProjects(); }, []);

    const handleDelete = async (pid, e) => {
        e.stopPropagation();
        if (!confirm('Delete this project and all its clips?')) return;
        try {
            await fetch(getApiUrl(`/api/projects/${pid}`), { method: 'DELETE' });
            setProjects(p => p.filter(x => x.id !== pid));
        } catch (e) {
            alert('Delete failed: ' + e.message);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={24} className="animate-spin text-zinc-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-red-400 text-sm mb-4">{error}</p>
                <button onClick={loadProjects} className="text-sm text-primary hover:underline">Retry</button>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Folder className="text-primary" size={22} />
                    Projects
                </h2>
                <button onClick={loadProjects} className="text-xs text-zinc-500 hover:text-white transition-colors">
                    Refresh
                </button>
            </div>

            {projects.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
                    <Film size={40} className="text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-500 text-sm">No projects yet. Process a video first!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {projects.map(p => (
                        <div
                            key={p.id}
                            onClick={() => onSelectProject(p)}
                            className="bg-surface border border-white/5 hover:border-white/20 rounded-xl p-4 cursor-pointer transition-all group flex items-center gap-4"
                        >
                            <div className="w-14 h-14 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                                {p.thumbnail ? (
                                    <img src={getApiUrl(p.thumbnail)} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <Film size={22} className="text-zinc-600" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-white truncate">{p.title || 'Untitled'}</h3>
                                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                    <span className="flex items-center gap-1">
                                        <Film size={12} /> {p.clip_count || 0} clips
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock size={12} /> {formatDate(p.created_at)}
                                    </span>
                                    {p.lang && <span className="text-primary/60">{p.lang}</span>}
                                    {p.cost_data && (() => {
                                        try {
                                            const c = JSON.parse(p.cost_data);
                                            return <span>${c.total_cost?.toFixed(5)}</span>;
                                        } catch { return null; }
                                    })()}
                                </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={(e) => handleDelete(p.id, e)}
                                    className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <ChevronRight size={18} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
