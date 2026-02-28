import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PhoneCall } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="flex justify-center">
          <div className="p-4 bg-blue-100 rounded-full">
            <PhoneCall className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h1 className="text-5xl font-bold text-gray-900">404</h1>
        <p className="text-xl font-semibold text-gray-700">Page not found</p>
        <p className="text-gray-500 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
