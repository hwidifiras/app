export type SportDto = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  stats?: {
    activeGroups: number;
    activePlans: number;
    activeSubscriptions: number;
    coaches: number;
    activeOffers: number;
  };
  createdAt: string;
  updatedAt: string;
};
