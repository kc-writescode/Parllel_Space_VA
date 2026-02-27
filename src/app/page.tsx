import Link from "next/link";
import { Phone, Zap, DollarSign, BarChart3, ShoppingBag, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Phone className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-bold">Parallel Space</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center py-20 px-6">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Never miss a phone order
          <span className="text-blue-600"> again</span>
        </h1>
        <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
          AI voice agents that answer your restaurant&apos;s phone, take orders
          conversationally, and send them straight to your kitchen. No busy signals.
          No missed revenue.
        </p>
        <div className="mt-10 flex gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg" className="text-lg px-8 py-6">
              Start Free
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-400">
          Set up in under 5 minutes. No credit card required.
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto py-20 px-6">
        <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          <FeatureCard
            icon={<Phone className="h-8 w-8 text-blue-600" />}
            title="AI Answers Every Call"
            description="Your dedicated phone number is powered by an AI voice agent that handles unlimited simultaneous calls. No more busy signals."
          />
          <FeatureCard
            icon={<ShoppingBag className="h-8 w-8 text-green-600" />}
            title="Takes Orders Naturally"
            description="The AI knows your menu, handles modifiers, special requests, and calculates totals. Pickup or delivery — it covers both."
          />
          <FeatureCard
            icon={<Clock className="h-8 w-8 text-orange-600" />}
            title="Orders in Real-Time"
            description="Orders appear instantly on your dashboard and kitchen display. Customers get an SMS payment link right after the call."
          />
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-3">
          <FeatureCard
            icon={<Zap className="h-8 w-8 text-yellow-600" />}
            title="5-Minute Setup"
            description="Just paste your website URL — we'll scan your menu automatically. Get a phone number and go live in minutes."
          />
          <FeatureCard
            icon={<DollarSign className="h-8 w-8 text-green-600" />}
            title="Cost Effective"
            description="Pay only for what you use. Way cheaper than hiring staff to answer phones, and it never calls in sick."
          />
          <FeatureCard
            icon={<BarChart3 className="h-8 w-8 text-purple-600" />}
            title="Full Visibility"
            description="Dashboard with real-time orders, call history, transcripts, and analytics. Know exactly what's happening."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto text-center py-20 px-6">
        <h2 className="text-3xl font-bold mb-4">Ready to stop missing orders?</h2>
        <p className="text-gray-600 mb-8">
          Join restaurants using AI to capture every phone order.
        </p>
        <Link href="/signup">
          <Button size="lg" className="text-lg px-8 py-6">
            Get Started Free
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6 text-center text-sm text-gray-400">
        &copy; {new Date().getFullYear()} Parallel Space. All rights reserved.
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
