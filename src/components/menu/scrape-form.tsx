"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Globe } from "lucide-react";
import type { ExtractedMenu } from "@/lib/scraper/ai-extractor";

interface ScrapeFormProps {
  onMenuExtracted: (menu: ExtractedMenu) => void;
}

export function ScrapeForm({ onMenuExtracted }: ScrapeFormProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/menu/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to scrape menu");
      }

      onMenuExtracted(data.menu);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Import Menu from Website
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleScrape} className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="url" className="sr-only">Website URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://yourrestaurant.com/menu"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Scanning...
              </>
            ) : (
              "Scan Menu"
            )}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {loading && (
          <p className="mt-2 text-sm text-gray-500">
            This may take 15-30 seconds. We&apos;re reading your website and extracting menu items...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
