'use client';

import { Calendar, Clock, Plus } from 'lucide-react';

export default function SchedulePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-gray-500 mt-1">Manage your scheduled posts</p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border">
        <Calendar className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Calendar view coming soon</h3>
        <p className="text-gray-500 mt-1 text-center max-w-md">
          Schedule and manage your posts with a drag-and-drop calendar. Connect Instagram and Facebook to start scheduling.
        </p>
      </div>
    </div>
  );
}
