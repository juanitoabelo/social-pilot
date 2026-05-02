"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, AlertCircle, ArrowLeft } from "lucide-react";

export default function CampaignGenerationPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("starting");
  const [message, setMessage] = useState("Initializing content generation...");

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/campaigns/${params.id}/progress`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setStatus(data.status);
      setMessage(data.message);

      if (data.status === "completed") {
        eventSource.close();
        setTimeout(() => {
          router.push(`/dashboard/campaigns/${params.id}`);
        }, 1500);
      }

      if (data.status === "failed") {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setStatus("failed");
      setMessage("Connection lost. Check your dashboard for status.");
    };

    return () => {
      eventSource.close();
    };
  }, [params.id, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md text-center space-y-6">
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to campaigns
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Generating Content</h1>
          <p className="text-gray-500">{message}</p>
        </div>

        <div className="relative">
          <div className="w-24 h-24 mx-auto">
            {status === "failed" ? (
              <AlertCircle className="w-24 h-24 text-red-500" />
            ) : status === "completed" ? (
              <CheckCircle className="w-24 h-24 text-green-500" />
            ) : (
              <Loader2 className="w-24 h-24 text-primary animate-spin" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                status === "failed"
                  ? "bg-red-500"
                  : status === "completed"
                  ? "bg-green-500"
                  : "bg-primary"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">{progress}% complete</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Progress
          </p>
          <ul className="space-y-1 text-sm">
            <li
              className={
                progress >= 20 ? "text-green-600" : "text-gray-400"
              }
            >
              {progress >= 20 ? "✓" : "○"} Initializing...
            </li>
            <li
              className={
                progress >= 40 ? "text-green-600" : "text-gray-400"
              }
            >
              {progress >= 40 ? "✓" : "○"} Generating copy...
            </li>
            <li
              className={
                progress >= 60 ? "text-green-600" : "text-gray-400"
              }
            >
              {progress >= 60 ? "✓" : "○"} Creating images...
            </li>
            <li
              className={
                progress >= 80 ? "text-green-600" : "text-gray-400"
              }
            >
              {progress >= 80 ? "✓" : "○"} Resizing & uploading...
            </li>
            <li
              className={
                progress >= 100 ? "text-green-600" : "text-gray-400"
              }
            >
              {progress >= 100 ? "✓" : "○"} Finalizing...
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
