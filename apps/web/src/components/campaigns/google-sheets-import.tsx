"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  FileSpreadsheet,
  ChevronDown,
  Check,
  AlertTriangle,
  X,
  ArrowRight,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

type Spreadsheet = {
  id: string;
  name: string;
  modifiedTime: string;
};

type SheetTab = {
  name: string;
  gid: string;
};

type ColumnMapping = Record<string, string | null>;

export function GoogleSheetsImportModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [step, setStep] = useState<"connect" | "select" | "preview" | "mapping" | "importing">("connect");
  const [selectedSheet, setSelectedSheet] = useState<Spreadsheet | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("");
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [defaultPlatform, setDefaultPlatform] = useState("instagram");
  const [scheduleMode, setScheduleMode] = useState<"pending_review" | "scheduled" | "draft">("pending_review");
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: spreadsheets, isLoading: loadingSheets } = useQuery<Spreadsheet[]>({
    queryKey: ["google-sheets"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/google/sheets");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message);
      return json.data || [];
    },
    enabled: step === "select",
  });

  const { data: sheetData, isLoading: loadingPreview } = useQuery<{
    headers: string[];
    rows: Array<{ row: Record<string, string>; rowIndex: number }>;
    totalRows: number;
    columnMapping: ColumnMapping;
    tab: string;
    tabs: SheetTab[];
  }>({
    queryKey: ["sheet-preview", selectedSheet?.id, selectedTab],
    queryFn: async () => {
      const params = new URLSearchParams({
        spreadsheetId: selectedSheet!.id,
        tab: selectedTab,
      });
      const res = await fetch(`/api/integrations/google/sheets?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message);
      return json.data;
    },
    enabled: !!selectedSheet && !!selectedTab && step === "preview",
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/google/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId: selectedSheet!.id,
          tab: selectedTab,
          columnMapping,
          defaultPlatform,
          scheduleMode,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message);
      return json.data;
    },
    onSuccess: (data) => {
      setStep("importing");
      toast.success(`Importing ${data.totalRows} rows from spreadsheet`);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        onClose();
      }, 2000);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSelectSheet = (sheet: Spreadsheet) => {
    setSelectedSheet(sheet);
    const tabs = sheetData?.tabs || [];
    if (tabs.length > 0) {
      setSelectedTab(tabs[0].name);
    }
    setStep("preview");
  };

  const handleConfirmMapping = () => {
    if (!columnMapping.caption) {
      toast.error("Caption column is required");
      return;
    }
    setStep("mapping");
  };

  const handleStartImport = () => {
    importMutation.mutate();
  };

  if (step === "connect") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Import from Google Sheets</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center py-8">
            <FileSpreadsheet className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Google Sheets</h3>
            <p className="text-sm text-gray-500 mb-6">
              Authorize access to your Google Sheets to import post content
            </p>
            <button
              onClick={() => (window.location.href = "/api/integrations/google/connect")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 mx-auto"
            >
              Connect with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "select" && loadingSheets) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (step === "select") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Select Spreadsheet</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {spreadsheets?.map((sheet) => (
              <button
                key={sheet.id}
                onClick={() => handleSelectSheet(sheet)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left transition-colors"
              >
                <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{sheet.name}</p>
                  <p className="text-xs text-gray-500">
                    Modified {new Date(sheet.modifiedTime).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}

            {spreadsheets?.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No spreadsheets found</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === "preview" && loadingPreview) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (step === "preview" && sheetData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">{selectedSheet?.name}</h2>
              <p className="text-sm text-gray-500">{sheetData.totalRows} rows found</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {sheetData.tabs.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Tab</label>
              <div className="relative">
                <button
                  onClick={() => setTabDropdownOpen(!tabDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  <span>{selectedTab || sheetData.tab}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {tabDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
                    {sheetData.tabs.map((tab) => (
                      <button
                        key={tab.name}
                        onClick={() => {
                          setSelectedTab(tab.name);
                          setTabDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        {tab.name === selectedTab && <Check className="w-4 h-4 text-green-600" />}
                        {tab.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  {sheetData.headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheetData.rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {sheetData.headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                        {r.row[h] || ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {sheetData.rows.length > 5 && (
              <p className="text-xs text-gray-400 mt-2">Showing 5 of {sheetData.rows.length} rows</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Default platform:</label>
              <select
                value={defaultPlatform}
                onChange={(e) => setDefaultPlatform(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="twitter">X / Twitter</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
                <option value="pinterest">Pinterest</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Import as:</label>
              <select
                value={scheduleMode}
                onChange={(e) => setScheduleMode(e.target.value as any)}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="pending_review">Review queue</option>
                <option value="scheduled">Scheduled (if dates set)</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              onClick={() => setStep("select")}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Back
            </button>
            <button
              onClick={() => {
                setColumnMapping(sheetData.columnMapping);
                setStep("mapping");
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              Map Columns & Import
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "mapping") {
    const fields = [
      { key: "caption", label: "Caption / Post Text", required: true },
      { key: "date", label: "Date" },
      { key: "time", label: "Time" },
      { key: "platform", label: "Platform" },
      { key: "hashtags", label: "Hashtags" },
      { key: "media_url", label: "Media URL (image/video)" },
    ];

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Map Columns</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {!columnMapping.caption && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                No caption column detected. Please select one manually.
              </p>
            </div>
          )}

          <div className="space-y-3 mb-6">
            {fields.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                  value={columnMapping[field.key] || ""}
                  onChange={(e) =>
                    setColumnMapping((prev) => ({
                      ...prev,
                      [field.key]: e.target.value || null,
                    }))
                  }
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">— Skip —</option>
                  {sheetData?.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setStep("preview")}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Back
            </button>
            <button
              onClick={handleStartImport}
              disabled={importMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import {sheetData?.totalRows} Posts
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Importing...</h3>
          <p className="text-sm text-gray-500">
            Your posts are being created in the background. You'll see them in the campaigns page shortly.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
