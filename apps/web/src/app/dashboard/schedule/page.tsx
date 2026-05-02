'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core';
import { Calendar, Clock, Plus, X, Loader2, CheckCircle2, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface Post {
  id: string;
  platform: string;
  status: string;
  caption: string;
  hashtags: string[];
  cta: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  error: string | null;
  assets: Array<{ url: string; alt_text: string | null }>;
  campaign: { title: string };
  created_at: string;
}

interface OptimalTimeSlot {
  dayOfWeek: number;
  dayName: string;
  hour: number;
  timeLabel: string;
  avgEngagementRate: number;
  postCount: number;
  platform: string;
  isEstimate?: boolean;
}

interface PlatformOptimalTimes {
  platform: string;
  slots: OptimalTimeSlot[];
  overallBestSlot: OptimalTimeSlot | null;
}

async function fetchScheduledPosts(): Promise<Post[]> {
  const res = await fetch('/api/posts?status=scheduled');
  if (!res.ok) throw new Error('Failed to fetch scheduled posts');
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

async function fetchOptimalTimes(platform?: string): Promise<PlatformOptimalTimes[]> {
  const params = platform ? `?platform=${platform}` : '';
  const res = await fetch(`/api/analytics/optimal-times${params}`);
  if (!res.ok) throw new Error('Failed to fetch optimal times');
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

function getNextOptimalTime(
  slots: OptimalTimeSlot[]
): Date | null {
  if (!slots.length) return null;

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  for (const slot of slots) {
    if (slot.isEstimate) continue;

    let daysUntilDay = slot.dayOfWeek - currentDay;
    if (daysUntilDay < 0 || (daysUntilDay === 0 && slot.hour <= currentHour)) {
      daysUntilDay += 7;
    }

    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + daysUntilDay);
    candidate.setHours(slot.hour, 0, 0, 0);

    if (candidate > now) {
      return candidate;
    }
  }

  const best = slots[0];
  if (!best) return null;

  let daysUntilDay = best.dayOfWeek - currentDay;
  if (daysUntilDay < 0) daysUntilDay += 7;
  if (daysUntilDay === 0 && best.hour <= currentHour) daysUntilDay += 7;

  const candidate = new Date(now);
  candidate.setDate(candidate.getDate() + daysUntilDay);
  candidate.setHours(best.hour, 0, 0, 0);

  return candidate;
}

async function schedulePost(postId: string, scheduledAt: string) {
  const res = await fetch(`/api/posts/${postId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'schedule', scheduledAt }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

async function reschedulePost(postId: string, scheduledAt: string) {
  const res = await fetch(`/api/posts/${postId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reschedule', scheduledAt }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

async function cancelSchedule(postId: string) {
  const res = await fetch(`/api/posts/${postId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel_schedule' }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

const platformColors: Record<string, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  tiktok: '#000000',
  pinterest: '#E60023',
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 16);
}

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const calendarRef = useRef<FullCalendar>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const { data: posts, isLoading } = useQuery({
    queryKey: ['scheduled-posts'],
    queryFn: fetchScheduledPosts,
  });

  const { data: approvedPosts } = useQuery({
    queryKey: ['approved-posts'],
    queryFn: async () => {
      const res = await fetch('/api/posts?status=approved');
      if (!res.ok) throw new Error('Failed to fetch approved posts');
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.data || [];
    },
  });

  const { data: optimalTimes } = useQuery({
    queryKey: ['optimal-posting-times', selectedPost?.platform],
    queryFn: () => fetchOptimalTimes(selectedPost?.platform),
    enabled: showModal && !!selectedPost,
  });

  const bestTimeForSelected = useMemo(() => {
    if (!optimalTimes || !selectedPost) return null;
    const platformData = optimalTimes.find((p) => p.platform === selectedPost.platform);
    if (!platformData) return null;
    return getNextOptimalTime(platformData.slots);
  }, [optimalTimes, selectedPost]);

  const platformDataForSelected = useMemo(() => {
    if (!optimalTimes || !selectedPost) return null;
    return optimalTimes.find((p) => p.platform === selectedPost.platform);
  }, [optimalTimes, selectedPost]);

  const scheduleMutation = useMutation({
    mutationFn: ({ postId, date }: { postId: string; date: string }) =>
      schedulePost(postId, date),
    onSuccess: () => {
      toast.success('Post scheduled successfully');
      setShowModal(false);
      setSelectedPost(null);
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
      queryClient.invalidateQueries({ queryKey: ['approved-posts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ postId, date }: { postId: string; date: string }) =>
      reschedulePost(postId, date),
    onSuccess: () => {
      toast.success('Post rescheduled');
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSchedule,
    onSuccess: () => {
      toast.success('Schedule cancelled');
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
      queryClient.invalidateQueries({ queryKey: ['approved-posts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const events = (posts || [])
    .filter((post) => post.scheduled_at)
    .map((post) => ({
      id: post.id,
      title: `${post.platform} — ${post.campaign.title}`,
      start: post.scheduled_at as string,
      backgroundColor: platformColors[post.platform] || '#6B7280',
      borderColor: platformColors[post.platform] || '#6B7280',
      extendedProps: { post },
    }));

  const handleEventClick = useCallback((info: EventClickArg) => {
    const post = info.event.extendedProps.post as Post;
    setSelectedPost(post);
    setScheduleDate(post.scheduled_at ? formatDate(new Date(post.scheduled_at)) : '');
    setShowModal(true);
  }, []);

  const handleEventDrop = useCallback((info: EventDropArg) => {
    const post = info.event.extendedProps.post as Post;
    const newDate = info.event.start;
    if (!newDate) {
      info.revert();
      return;
    }
    rescheduleMutation.mutate({
      postId: post.id,
      date: formatDate(newDate),
    });
  }, [rescheduleMutation]);

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    if (approvedPosts && approvedPosts.length > 0) {
      setScheduleDate(formatDate(info.start));
      setSelectedPost(approvedPosts[0]);
      setShowModal(true);
    } else {
      toast.info('No approved posts available to schedule');
    }
  }, [approvedPosts]);

  const handleSchedule = () => {
    if (!selectedPost || !scheduleDate) return;
    setIsScheduling(true);
    const action = selectedPost.status === 'scheduled' ? rescheduleMutation : scheduleMutation;
    action.mutate(
      { postId: selectedPost.id, date: scheduleDate },
      { onSettled: () => setIsScheduling(false) }
    );
  };

  const handleCancel = () => {
    if (!selectedPost) return;
    cancelMutation.mutate(selectedPost.id);
    setShowModal(false);
    setSelectedPost(null);
  };

  const handleUseBestTime = () => {
    if (!bestTimeForSelected) {
      toast.info('No optimal time data available yet. Publish more posts to get personalized suggestions.');
      return;
    }
    setScheduleDate(formatDate(bestTimeForSelected));
    toast.success('Best posting time selected');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-gray-500">Loading schedule...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-gray-500 mt-1">Manage your scheduled posts</p>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          select={handleDateSelect}
          height="auto"
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: 'short',
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: 'short',
          }}
        />
      </div>

      {showModal && selectedPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {selectedPost.status === 'scheduled' ? 'Reschedule Post' : 'Schedule Post'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedPost(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: platformColors[selectedPost.platform] }}
                />
                <span className="text-sm font-medium capitalize">{selectedPost.platform}</span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{selectedPost.caption}</p>
              <p className="text-xs text-gray-400 mt-1">{selectedPost.campaign.title}</p>
            </div>

            {platformDataForSelected && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Best posting times</span>
                  {platformDataForSelected.overallBestSlot?.isEstimate && (
                    <span className="text-xs text-amber-600 ml-auto">based on industry data</span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {platformDataForSelected.slots.slice(0, 5).map((slot, i) => {
                    const date = new Date();
                    const currentDay = date.getDay();
                    let daysUntilDay = slot.dayOfWeek - currentDay;
                    if (daysUntilDay < 0 || (daysUntilDay === 0 && slot.hour <= date.getHours())) {
                      daysUntilDay += 7;
                    }
                    const slotDate = new Date(date);
                    slotDate.setDate(slotDate.getDate() + daysUntilDay);
                    slotDate.setHours(slot.hour, 0, 0, 0);

                    return (
                      <button
                        key={i}
                        onClick={() => setScheduleDate(formatDate(slotDate))}
                        className={`p-2 rounded text-xs text-center transition-colors ${
                          slot.isEstimate
                            ? 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-100'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        } ${
                          scheduleDate === formatDate(slotDate)
                            ? 'ring-2 ring-amber-500'
                            : ''
                        }`}
                      >
                        <div className="font-medium">{slot.dayName.slice(0, 3)}</div>
                        <div>{slot.timeLabel}</div>
                        {!slot.isEstimate && slot.postCount > 0 && (
                          <div className="text-[10px] text-amber-600 mt-0.5">
                            {(slot.avgEngagementRate * 100).toFixed(1)}%
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {bestTimeForSelected && (
                  <button
                    onClick={handleUseBestTime}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-100 rounded hover:bg-amber-200 transition-colors"
                  >
                    <Zap className="w-3 h-3" />
                    Schedule at best time ({bestTimeForSelected.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {bestTimeForSelected.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})
                  </button>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Date & Time</label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div className="flex items-center gap-3">
              {selectedPost.status === 'scheduled' && (
                <button
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              )}
              <button
                onClick={handleSchedule}
                disabled={isScheduling || !scheduleDate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {isScheduling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {selectedPost.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(posts || []).length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center py-12 bg-white rounded-xl border">
          <Calendar className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No scheduled posts</h3>
          <p className="text-gray-500 mt-1 text-center max-w-md">
            {approvedPosts && approvedPosts.length > 0
              ? 'Click on a date to schedule an approved post, or drag approved posts onto the calendar'
              : 'Approve some posts from your content library to start scheduling'}
          </p>
        </div>
      )}
    </div>
  );
}
