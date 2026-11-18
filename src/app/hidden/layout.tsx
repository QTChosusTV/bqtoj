"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { supabase } from "@/utils/supabaseClient"; // adjust to your supabase client path

export default function HiddenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    async function verifyRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthorized(false);
        return;
      }

      const { data, error } = await supabase.rpc("is_admin_or_owner");
      if (error || !data) {
        setAuthorized(false);
      } else {
        setAuthorized(true);
      }
    }
    verifyRole();
  }, []);

  // Render nothing while verifying so admin UI never flashes
  if (authorized === null) return null;

  // Trigger standard 404 page if unauthorized
  if (!authorized) {
    notFound();
  }

  return <>{children}</>;
}