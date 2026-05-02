import * as React from "react";
import { cn } from "./utils";

const Tabs = ({ children, defaultValue, value, onValueChange }: {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) => {
  const [activeTab, setActiveTab] = React.useState(value ?? defaultValue ?? "");

  React.useEffect(() => {
    if (value !== undefined) {
      setActiveTab(value);
    }
  }, [value]);

  const handleTabChange = (newValue: string) => {
    setActiveTab(newValue);
    onValueChange?.(newValue);
  };

  return (
    <div data-active={activeTab} data-on-change={handleTabChange}>
      {children}
    </div>
  );
};

const TabsList = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)}>
    {children}
  </div>
);

const TabsTrigger = ({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) => {
  const parent = React.useContext(TabsContext);
  const isActive = parent?.active === value;
  
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive && "bg-background text-foreground shadow",
        className
      )}
      onClick={() => parent?.onChange(value)}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) => {
  const parent = React.useContext(TabsContext);
  if (parent?.active !== value) return null;
  
  return (
    <div className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}>
      {children}
    </div>
  );
};

const TabsContext = React.createContext<{ active: string; onChange: (value: string) => void } | null>(null);

export { Tabs, TabsList, TabsTrigger, TabsContent };
