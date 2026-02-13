import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getLocationFromIP(ip: string) {
  try {
    // Skip local/private IPs
    if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return { city: "Unknown", country: "Unknown", latitude: 0, longitude: 0 };
    }
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) return { city: "Unknown", country: "Unknown", latitude: 0, longitude: 0 };
    const data = await res.json();
    return {
      city: data.city || "Unknown",
      country: data.country_name || "Unknown",
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
    };
  } catch {
    return { city: "Unknown", country: "Unknown", latitude: 0, longitude: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { recipe_id } = await req.json();
    if (!recipe_id) {
      return new Response(JSON.stringify({ error: "recipe_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from auth header (optional)
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    // Get IP from headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "";

    // Check existing like
    let existingLike;
    if (userId) {
      const { data } = await supabase
        .from("recipe_likes")
        .select("id")
        .eq("recipe_id", recipe_id)
        .eq("user_id", userId)
        .maybeSingle();
      existingLike = data;
    } else if (ip) {
      const { data } = await supabase
        .from("recipe_likes")
        .select("id")
        .eq("recipe_id", recipe_id)
        .is("user_id", null)
        .eq("ip_address", ip)
        .maybeSingle();
      existingLike = data;
    }

    if (existingLike) {
      // Unlike
      await supabase.from("recipe_likes").delete().eq("id", existingLike.id);
      return new Response(JSON.stringify({ liked: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get location data
    const location_data = await getLocationFromIP(ip);

    // Insert like
    await supabase.from("recipe_likes").insert({
      recipe_id,
      user_id: userId,
      ip_address: ip || null,
      location_data,
    });

    return new Response(JSON.stringify({ liked: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in toggle-like:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
