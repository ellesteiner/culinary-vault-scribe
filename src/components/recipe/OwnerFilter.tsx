import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

interface OwnerFilterProps {
  ownerFilter: string;
  onOwnerFilterChange: (value: string) => void;
  ownerNameFilter: string;
  onOwnerNameFilterChange: (value: string) => void;
  owners: { user_id: string; owner_name: string }[];
}

export function OwnerFilter({
  ownerFilter,
  onOwnerFilterChange,
  ownerNameFilter,
  onOwnerNameFilterChange,
  owners,
}: OwnerFilterProps) {
  const { user } = useAuth();

  return (
    <div className="flex gap-3 flex-wrap">
      <Select value={ownerFilter} onValueChange={onOwnerFilterChange}>
        <SelectTrigger className="w-[160px] input-cookbook">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Recipes</SelectItem>
          {user && <SelectItem value="mine">My Recipes</SelectItem>}
        </SelectContent>
      </Select>

      {owners.length > 0 && (
        <Select value={ownerNameFilter} onValueChange={onOwnerNameFilterChange}>
          <SelectTrigger className="w-[180px] input-cookbook">
            <SelectValue placeholder="Filter by chef" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chefs</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.user_id} value={o.user_id}>
                {o.owner_name || 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
