import { prisma } from "@/lib/prisma";

export interface GymBranding {
  name: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  phone: string | null;
  website: string | null;
}

const DEFAULT_BRANDING: GymBranding = {
  name: "MatFlow",
  logo: null,
  primaryColor: "#0fe69b",
  secondaryColor: null,
  phone: null,
  website: null,
};

export async function getGymBranding(gymId: string): Promise<GymBranding> {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: {
      name: true,
      logo: true,
      primaryColor: true,
      secondaryColor: true,
      phone: true,
      website: true,
    },
  });

  if (!gym) return DEFAULT_BRANDING;

  return {
    name: gym.name,
    logo: gym.logo,
    primaryColor: gym.primaryColor || DEFAULT_BRANDING.primaryColor,
    secondaryColor: gym.secondaryColor,
    phone: gym.phone,
    website: gym.website,
  };
}
