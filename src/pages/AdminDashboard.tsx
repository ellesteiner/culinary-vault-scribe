import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ShieldAlert, MapPin, Heart, Clock } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface LikeRow {
  id: string;
  recipe_id: string;
  ip_address: string | null;
  location_data: {
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  } | null;
  created_at: string;
  recipes: { title: string } | null;
}

interface LocationGroup {
  city: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  recipes: Record<string, { title: string; count: number }>;
  lastLike: string;
}

function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['is-admin', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      return !!data;
    },
  });
}

function useAdminLikes(timeFilter: string, recipeFilter: string, countryFilter: string) {
  return useQuery({
    queryKey: ['admin-likes', timeFilter, recipeFilter, countryFilter],
    queryFn: async () => {
      let query = supabase
        .from('recipe_likes')
        .select('id, recipe_id, ip_address, location_data, created_at, recipes(title)')
        .order('created_at', { ascending: false });

      if (timeFilter !== 'all') {
        const now = new Date();
        const hours = timeFilter === '24h' ? 24 : timeFilter === '7d' ? 168 : 720;
        const since = new Date(now.getTime() - hours * 3600000).toISOString();
        query = query.gte('created_at', since);
      }

      if (recipeFilter !== 'all') {
        query = query.eq('recipe_id', recipeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let likes = (data || []) as unknown as LikeRow[];

      if (countryFilter !== 'all') {
        likes = likes.filter(l => (l.location_data as any)?.country === countryFilter);
      }

      return likes;
    },
  });
}

function useRecipeList() {
  return useQuery({
    queryKey: ['recipe-list-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title')
        .order('title');
      if (error) throw error;
      return data || [];
    },
  });
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  const { data: recipeList = [] } = useRecipeList();

  const [timeFilter, setTimeFilter] = useState('all');
  const [recipeFilter, setRecipeFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  const { data: likes = [], isLoading } = useAdminLikes(timeFilter, recipeFilter, countryFilter);

  const locationGroups = useMemo(() => {
    const groups: Record<string, LocationGroup> = {};
    likes.forEach((like) => {
      const loc = like.location_data as any;
      if (!loc?.latitude || !loc?.longitude) return;
      const key = `${loc.latitude},${loc.longitude}`;
      if (!groups[key]) {
        groups[key] = {
          city: loc.city || 'Unknown',
          country: loc.country || 'Unknown',
          lat: loc.latitude,
          lng: loc.longitude,
          count: 0,
          recipes: {},
          lastLike: like.created_at,
        };
      }
      groups[key].count++;
      const title = like.recipes?.title || 'Unknown';
      if (!groups[key].recipes[like.recipe_id]) {
        groups[key].recipes[like.recipe_id] = { title, count: 0 };
      }
      groups[key].recipes[like.recipe_id].count++;
      if (like.created_at > groups[key].lastLike) {
        groups[key].lastLike = like.created_at;
      }
    });
    return Object.values(groups);
  }, [likes]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    likes.forEach(l => {
      const country = (l.location_data as any)?.country;
      if (country && country !== 'Unknown') set.add(country);
    });
    return Array.from(set).sort();
  }, [likes]);

  const tableData = useMemo(() => {
    return locationGroups
      .map((g) => {
        const topRecipe = Object.values(g.recipes).sort((a, b) => b.count - a.count)[0];
        return {
          location: `${g.city}, ${g.country}`,
          likes: g.count,
          topRecipe: topRecipe?.title || 'N/A',
          lastLike: new Date(g.lastLike).toLocaleString(),
        };
      })
      .sort((a, b) => b.likes - a.likes);
  }, [locationGroups]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h1 className="font-serif text-3xl font-bold">403 – Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Recipes
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">Like Analytics</h1>
              <p className="text-sm text-muted-foreground">{likes.length} total likes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={recipeFilter} onValueChange={setRecipeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All recipes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Recipes</SelectItem>
              {recipeList.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {countries.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Map */}
        <div className="rounded-xl overflow-hidden border border-border shadow-md" style={{ height: 450 }}>
          <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {locationGroups.map((g, i) => (
              <CircleMarker
                key={i}
                center={[g.lat, g.lng]}
                radius={Math.min(6 + g.count * 2, 20)}
                pathOptions={{ color: 'hsl(350, 65%, 35%)', fillColor: 'hsl(350, 65%, 45%)', fillOpacity: 0.7 }}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    <p className="font-bold">{g.city}, {g.country}</p>
                    <p className="flex items-center gap-1"><Heart className="w-3 h-3" /> {g.count} likes</p>
                    <div>
                      {Object.values(g.recipes).slice(0, 5).map((r, j) => (
                        <p key={j} className="text-xs text-muted-foreground">{r.title} ({r.count})</p>
                      ))}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Data Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium"><MapPin className="w-4 h-4 inline mr-1" />Location</th>
                <th className="text-left p-3 font-medium"><Heart className="w-4 h-4 inline mr-1" />Likes</th>
                <th className="text-left p-3 font-medium">Top Recipe</th>
                <th className="text-left p-3 font-medium"><Clock className="w-4 h-4 inline mr-1" />Last Like</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
              ) : tableData.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No likes found</td></tr>
              ) : (
                tableData.map((row, i) => (
                  <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3">{row.location}</td>
                    <td className="p-3">{row.likes}</td>
                    <td className="p-3">{row.topRecipe}</td>
                    <td className="p-3 text-muted-foreground">{row.lastLike}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
