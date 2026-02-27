"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Sign up the user — store restaurant name in user metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          restaurant_name: restaurantName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // If we have a session (email confirmation disabled), create the restaurant
    // directly via the browser client — no API round-trip needed, and avoids
    // the server-side undici network timeout issue.
    if (authData.session) {
      const slug =
        restaurantName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") +
        "-" +
        Date.now().toString(36);

      const { data: newRestaurant, error: restaurantError } = await supabase.rpc(
        "create_restaurant_for_user",
        { p_name: restaurantName, p_slug: slug }
      );

      if (restaurantError || !newRestaurant) {
        setError(restaurantError?.message || "Failed to create restaurant. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } else {
      // Email confirmation required — show confirmation message
      setEmailSent(true);
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription>
            We&apos;ve sent a confirmation link to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-gray-600">
            Click the link in the email to confirm your account, then sign in to continue setup.
          </p>
          <Link href="/login">
            <Button variant="outline">Go to Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Get Started</CardTitle>
        <CardDescription>
          Set up your AI phone ordering agent in minutes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="restaurantName">Restaurant Name</Label>
            <Input
              id="restaurantName"
              placeholder="Joe's Pizza"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Setting up..." : "Create Account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
