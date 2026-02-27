import { Toaster } from "@/components/ui/sonner";

export default function TabletLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {children}
      <Toaster theme="dark" />
    </div>
  );
}
